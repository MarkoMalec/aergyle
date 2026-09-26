/**
 * Vocation tick settlement: grants the units an activity has earned since the last claim.
 *
 * Imported by the realtime daemon, which runs as plain Node outside Next.js. Keep this
 * module and its imports free of `server-only` modules (e.g. ~/server/stats).
 */
import {
  ItemType,
  VocationalActionType,
  XpActionType,
} from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import type { ActivityStopReason, ItemQuantityChange } from "~/realtime/events";
import { computeVocationalProgress } from "~/server/vocations/progress";
import {
  getStackCapacity,
  grantStackableItemToInventory,
} from "~/server/items/grantItem";
import {
  countItems,
  saveInventorySlots,
  takeFromStack,
  takeFromStacks,
} from "~/server/items/consumeItems";
import { lockInventory } from "~/server/items/inventoryLock";
import {
  addToTotals,
  readTotals,
  recordSessionSummary,
  type SessionTotals,
} from "~/server/activitySummaries";
import { awardXp } from "~/utils/leveling";
import { awardTrackXp } from "~/utils/progression";
import { recordSkillWork } from "~/server/skills/metrics";
import { normalizeInventorySlots } from "~/utils/inventorySlots";

export type VocationalClaimResult = {
  claimedUnits: number;
  grantedQuantity: number;
  remainingClaimableUnits: number;
  /** The activity claimed for; null when there was none. */
  actionType: VocationalActionType | null;
  resourceName: string | null;
  /** Set when this claim ended the activity. */
  stopReason: ActivityStopReason | null;
  itemChanges: ItemQuantityChange[];
  newStacks: boolean;
};

export async function claimVocationalRewards(params: {
  userId: string;
  maxUnits?: number;
}): Promise<VocationalClaimResult> {
  const { userId, maxUnits } = params;

  return prisma.$transaction(async (tx): Promise<VocationalClaimResult> => {
    // The daemon, page loads and start/stop can all claim for the same player at once.
    // Locking the activity row makes them take turns instead of paying out twice.
    await tx.$queryRaw`SELECT id FROM UserVocationalActivity WHERE userId = ${userId} FOR UPDATE`;

    const activity = await tx.userVocationalActivity.findUnique({
      where: { userId },
      include: {
        resource: {
          select: {
            itemId: true,
            yieldPerUnit: true,
            rarity: true,
            xpPerUnit: true,
            name: true,
            item: {
              select: { stackable: true, maxStackSize: true },
            },
          },
        },
      },
    });

    if (!activity) {
      return {
        claimedUnits: 0,
        grantedQuantity: 0,
        remainingClaimableUnits: 0,
        actionType: null,
        resourceName: null,
        stopReason: null,
        itemChanges: [],
        newStacks: false,
      };
    }

    const nothingClaimed = (
      remainingClaimableUnits: number,
      stopReason: ActivityStopReason | null = null,
    ): VocationalClaimResult => ({
      claimedUnits: 0,
      grantedQuantity: 0,
      remainingClaimableUnits,
      actionType: activity.actionType,
      resourceName: activity.resource.name,
      stopReason,
      itemChanges: [],
      newStacks: false,
    });

    // The player's "while you were away" summary of the whole session.
    const summarize = (stopReason: ActivityStopReason, totals: SessionTotals) =>
      recordSessionSummary(tx, {
        userId,
        kind: "VOCATION",
        skill: activity.actionType,
        title: activity.resource.name,
        stopReason,
        startedAt: activity.startedAt,
        totals,
      });

    // Ends the activity when nothing more can come of it, so it doesn't sit at 100%
    // and the daemon doesn't retry it every tick.
    const endActivity = async (stopReason: ActivityStopReason) => {
      await tx.userVocationalActivity.delete({ where: { userId } });
      await summarize(stopReason, readTotals(activity.totals));
      return nothingClaimed(0, stopReason);
    };

    const progress = computeVocationalProgress(activity);
    const claimableUnits = Math.min(
      progress.unitsClaimable,
      maxUnits === undefined
        ? progress.unitsClaimable
        : Math.max(0, Math.floor(maxUnits)),
    );

    if (claimableUnits <= 0) {
      if (progress.isComplete && progress.unitsClaimable <= 0) {
        return endActivity("COMPLETED");
      }
      return nothingClaimed(
        Math.max(0, progress.unitsTotal - activity.unitsClaimed),
      );
    }

    // Load requirements for this resource.
    const requirements = await tx.vocationalRequirement.findMany({
      where: { resourceId: activity.resourceId },
      select: { itemId: true, quantityPerUnit: true },
    });

    // Load inventory slots + referenced UserItems so we can compute availability and consume.
    const inventory = await lockInventory(tx, userId);

    const slots = normalizeInventorySlots(inventory?.slots, null);
    const userItemIds = slots
      .map((slot) => slot.item?.id)
      .filter((id): id is number => typeof id === "number");

    const userItems = await tx.userItem.findMany({
      where: { id: { in: userItemIds }, userId, status: "IN_INVENTORY" },
      select: {
        id: true,
        itemId: true,
        rarity: true,
        quantity: true,
        itemTemplate: { select: { itemType: true } },
      },
    });

    const userItemById = new Map<number, (typeof userItems)[number]>();
    for (const ui of userItems) userItemById.set(ui.id, ui);

    const totalByTemplateId = countItems(userItems);

    const isFishing = activity.actionType === VocationalActionType.FISHING;

    let maxUnitsByInputs = Infinity;

    if (isFishing) {
      const baitUserItemId = activity.baitUserItemId ?? null;
      if (!baitUserItemId) {
        // Invalid activity state; stop it.
        return endActivity("OUT_OF_BAIT");
      }

      const baitSlotExists = slots.some(
        (slot) => slot?.item?.id === baitUserItemId,
      );
      const bait = userItemById.get(baitUserItemId);
      if (!baitSlotExists || !bait || bait.quantity <= 0) {
        return endActivity("OUT_OF_BAIT");
      }

      if (bait.itemTemplate.itemType !== ItemType.BAIT) {
        return endActivity("OUT_OF_BAIT");
      }

      const baitPerUnit = Math.max(1, requirements[0]?.quantityPerUnit ?? 1);
      maxUnitsByInputs = Math.floor(bait.quantity / baitPerUnit);
    } else if (requirements.length > 0) {
      for (const req of requirements) {
        const perUnit = Math.max(1, req.quantityPerUnit);
        const available = totalByTemplateId.get(req.itemId) ?? 0;
        maxUnitsByInputs = Math.min(
          maxUnitsByInputs,
          Math.floor(available / perUnit),
        );
      }
    }

    // Room for the output, using the grant's own filling rules against the slots it
    // will see. Consuming inputs can only free space, so this never overestimates.
    const yieldPerUnit = Math.max(1, activity.resource.yieldPerUnit);
    const outputRoom = getStackCapacity({
      stackable: activity.resource.item.stackable,
      maxStackSize: activity.resource.item.maxStackSize,
      stackQuantities: userItems
        .filter(
          (ui) =>
            ui.itemId === activity.resource.itemId &&
            ui.rarity === activity.resource.rarity,
        )
        .map((ui) => ui.quantity),
      emptySlots: normalizeInventorySlots(
        inventory?.slots,
        inventory?.maxSlots,
      ).filter((slot) => slot.item === null).length,
    });
    const maxUnitsBySpace = Math.floor(outputRoom / yieldPerUnit);

    const unitsToClaim = Math.min(
      claimableUnits,
      maxUnitsByInputs,
      maxUnitsBySpace,
    );
    const limitedBySpace =
      maxUnitsBySpace < Math.min(claimableUnits, maxUnitsByInputs);
    const inputStopReason: ActivityStopReason = isFishing
      ? "OUT_OF_BAIT"
      : "OUT_OF_MATERIALS";

    // Time says units are due but none can be produced: the bag is full or inputs ran out.
    if (unitsToClaim <= 0) {
      return endActivity(limitedBySpace ? "INVENTORY_FULL" : inputStopReason);
    }

    // Consume required inputs for the units we're about to award, in slot order.
    let consumed: ItemQuantityChange[];
    if (isFishing) {
      const bait = userItemById.get(activity.baitUserItemId!);
      if (!bait) throw new Error("Insufficient materials");
      const baitPerUnit = Math.max(1, requirements[0]?.quantityPerUnit ?? 1);
      consumed = [
        await takeFromStack(tx, slots, bait, unitsToClaim * baitPerUnit),
      ];
    } else {
      const stacks = slots.flatMap((slot) => {
        const stack = slot.item ? userItemById.get(slot.item.id) : undefined;
        return stack ? [stack] : [];
      });
      consumed = await takeFromStacks({
        db: tx,
        slots,
        stacks,
        items: requirements.map((req) => ({
          itemId: req.itemId,
          quantity: unitsToClaim * Math.max(1, req.quantityPerUnit),
        })),
        order: "slot",
      });
    }
    if (consumed.some((change) => change.quantity === 0)) {
      await saveInventorySlots(tx, userId, slots);
    }
    const itemChanges = new Map(
      consumed.map((change) => [change.userItemId, change.quantity]),
    );

    const grant = await grantStackableItemToInventory({
      db: tx,
      userId,
      itemId: activity.resource.itemId,
      rarity: activity.resource.rarity,
      quantity: unitsToClaim * yieldPerUnit,
      unitSize: yieldPerUnit,
    });

    // Material consumption and output insertion are one transaction. Never
    // consume a full batch while only granting part of it (room was checked above).
    if (grant.remainingQuantity > 0) {
      throw new Error("Not enough inventory space for the crafted output");
    }
    for (const change of grant.itemChanges) {
      itemChanges.set(change.userItemId, change.quantity);
    }

    const claimedUnits = Math.floor(grant.addedQuantity / yieldPerUnit);
    const grantedQuantity = claimedUnits * yieldPerUnit;
    const remainingClaimableUnits = Math.max(0, unitsToClaim - claimedUnits);

    const xpToAward =
      claimedUnits > 0
        ? claimedUnits * Math.max(0, activity.resource.xpPerUnit || 0)
        : 0;

    // XP, skill metrics and track progress commit with the loot that earned
    // them. These used to run after the transaction, so anything interrupting
    // in between (a daemon restart on deploy, a dropped connection) left the
    // player holding the items with the tick already marked claimed and the XP
    // silently, unrecoverably lost.
    let characterXp = 0;
    if (claimedUnits > 0) {
      await recordSkillWork({
        db: tx,
        userId,
        actionType: activity.actionType,
        items: grantedQuantity,
        seconds: claimedUnits * activity.unitSeconds,
      });

      if (xpToAward > 0) {
        const awarded = await awardXp(
          userId,
          xpToAward,
          XpActionType.VOCATION,
          activity.actionType,
          "Vocational activity",
          undefined,
          // Ticks fire every few seconds per player; only a level-up is worth
          // an audit row.
          { db: tx, log: "levelUpOnly" },
        );
        characterXp = awarded.xpGained;

        await awardTrackXp({
          db: tx,
          userId,
          trackType: "SKILL",
          trackKey: String(activity.actionType),
          amount: xpToAward,
          description: "Vocational activity (skill XP)",
        });
      }
    }

    const totals = addToTotals(activity.totals, {
      items: [
        {
          itemId: activity.resource.itemId,
          rarity: activity.resource.rarity,
          quantity: grantedQuantity,
        },
      ],
      xp: characterXp,
      skillXp: xpToAward,
    });
    if (claimedUnits > 0) {
      await tx.userVocationalActivity.update({
        where: { userId },
        data: { unitsClaimed: { increment: claimedUnits }, totals },
      });
    }

    let stopReason: ActivityStopReason | null = null;

    // Fishing: if the selected bait stack was depleted, stop the activity immediately.
    if (isFishing && activity.baitUserItemId) {
      const baitStillExists = await tx.userItem.findFirst({
        where: { id: activity.baitUserItemId, userId, status: "IN_INVENTORY" },
        select: { id: true },
      });
      if (!baitStillExists) {
        await tx.userVocationalActivity.delete({ where: { userId } });
        stopReason = "OUT_OF_BAIT";
      }
    }

    // Some due units couldn't be produced: stop now rather than on the next tick.
    if (!stopReason && unitsToClaim < claimableUnits) {
      await tx.userVocationalActivity.delete({ where: { userId } });
      stopReason = limitedBySpace ? "INVENTORY_FULL" : inputStopReason;
    }

    // If completed and fully claimed, remove the activity.
    const done = progress.isComplete && remainingClaimableUnits === 0;
    if (!stopReason && done) {
      // Recompute against the updated row to ensure we don't delete prematurely.
      const updated = await tx.userVocationalActivity.findUnique({
        where: { userId },
      });
      if (updated) {
        const updatedProgress = computeVocationalProgress(updated);
        if (
          updatedProgress.isComplete &&
          updatedProgress.unitsClaimable === 0
        ) {
          await tx.userVocationalActivity.delete({ where: { userId } });
          stopReason = "COMPLETED";
        }
      }
    }

    if (stopReason) await summarize(stopReason, totals);

    return {
      claimedUnits,
      grantedQuantity,
      remainingClaimableUnits,
      actionType: activity.actionType,
      resourceName: activity.resource.name,
      stopReason,
      itemChanges: [...itemChanges].map(([userItemId, quantity]) => ({
        userItemId,
        quantity,
      })),
      newStacks: grant.newStacks,
    };
  });
}
