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
} from "~/server/vocations/grantItem";
import { awardXp } from "~/utils/leveling";
import { awardTrackXp } from "~/utils/progression";
import { recordSkillWork } from "~/server/skills/metrics";
import { normalizeInventorySlots } from "~/utils/inventorySlots";

export type VocationalCompletionSummary = {
  kind: "VOCATION";
  actionType: VocationalActionType;
  resourceName: string;
  itemName: string;
  grantedQuantity: number;
  userXpGained: number;
  skillXpGained: number;
  stopReason: ActivityStopReason | null;
};

export type VocationalClaimResult = {
  claimedUnits: number;
  grantedQuantity: number;
  remainingClaimableUnits: number;
  userXpGained: number;
  skillXpGained: number;
  summary: VocationalCompletionSummary | null;
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

  const result = await prisma.$transaction(async (tx) => {
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
              select: { name: true, stackable: true, maxStackSize: true },
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
        xpToAward: 0,
        unitSeconds: 0,
        vocationalActionType: null,
        resourceName: null,
        itemName: null,
        stopReason: null,
        itemChanges: [] as ItemQuantityChange[],
        newStacks: false,
      };
    }

    const nothingClaimed = (
      remainingClaimableUnits: number,
      stopReason: ActivityStopReason | null = null,
    ) => ({
      claimedUnits: 0,
      grantedQuantity: 0,
      remainingClaimableUnits,
      xpToAward: 0,
      unitSeconds: activity.unitSeconds,
      vocationalActionType: activity.actionType,
      resourceName: activity.resource.name,
      itemName: activity.resource.item.name,
      stopReason,
      itemChanges: [] as ItemQuantityChange[],
      newStacks: false,
    });

    // Ends the activity when nothing more can come of it, so it doesn't sit at 100%
    // and the daemon doesn't retry it every tick.
    const endActivity = async (stopReason: ActivityStopReason) => {
      await tx.userVocationalActivity.delete({ where: { userId } });
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
    const inventory = await tx.inventory.findUnique({
      where: { userId },
      select: { slots: true, maxSlots: true },
    });

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

    const totalByTemplateId = new Map<number, number>();
    for (const ui of userItems) {
      totalByTemplateId.set(
        ui.itemId,
        (totalByTemplateId.get(ui.itemId) ?? 0) + ui.quantity,
      );
    }

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

    // Consume required inputs for the units we're about to award.
    const updatedSlots = [...slots];
    let slotsChanged = false;
    const itemChanges = new Map<number, number>();

    const consumeSpecificUserItem = async (
      userItemId: number,
      quantityToConsume: number,
    ) => {
      if (quantityToConsume <= 0) return;
      const ui = userItemById.get(userItemId);
      if (!ui || ui.quantity < quantityToConsume) {
        throw new Error("Insufficient materials");
      }

      const newQty = ui.quantity - quantityToConsume;
      if (newQty <= 0) {
        await tx.userItem.delete({ where: { id: userItemId } });
        userItemById.delete(userItemId);
        for (let i = 0; i < updatedSlots.length; i++) {
          if (updatedSlots[i]?.item?.id === userItemId) {
            const currentSlot = updatedSlots[i];
            if (currentSlot) {
              updatedSlots[i] = { ...currentSlot, item: null };
            }
            slotsChanged = true;
          }
        }
        itemChanges.set(userItemId, 0);
      } else {
        await tx.userItem.update({
          where: { id: userItemId },
          data: { quantity: newQty },
        });
        ui.quantity = newQty;
        itemChanges.set(userItemId, newQty);
      }
    };
    const consumeTemplateId = async (
      templateItemId: number,
      quantityToConsume: number,
    ) => {
      let remaining = quantityToConsume;
      if (remaining <= 0) return;

      for (let i = 0; i < updatedSlots.length; i++) {
        if (remaining <= 0) break;

        const userItemId = updatedSlots[i]?.item?.id;
        if (typeof userItemId !== "number") continue;

        const ui = userItemById.get(userItemId);
        if (!ui) continue;
        if (ui.itemId !== templateItemId) continue;

        const take = Math.min(ui.quantity, remaining);
        remaining -= take;

        const newQty = ui.quantity - take;
        if (newQty <= 0) {
          await tx.userItem.delete({ where: { id: userItemId } });
          userItemById.delete(userItemId);
          const currentSlot = updatedSlots[i];
          if (currentSlot) {
            updatedSlots[i] = { ...currentSlot, item: null };
          }
          slotsChanged = true;
          itemChanges.set(userItemId, 0);
        } else {
          await tx.userItem.update({
            where: { id: userItemId },
            data: { quantity: newQty },
          });
          ui.quantity = newQty;
          itemChanges.set(userItemId, newQty);
        }
      }

      if (remaining > 0) {
        throw new Error("Insufficient materials");
      }
    };

    if (isFishing) {
      const baitUserItemId = activity.baitUserItemId!;
      const baitPerUnit = Math.max(1, requirements[0]?.quantityPerUnit ?? 1);
      await consumeSpecificUserItem(baitUserItemId, unitsToClaim * baitPerUnit);
    } else if (requirements.length > 0) {
      for (const req of requirements) {
        const perUnit = Math.max(1, req.quantityPerUnit);
        await consumeTemplateId(req.itemId, unitsToClaim * perUnit);
      }
    }

    if (slotsChanged) {
      await tx.inventory.update({
        where: { userId },
        data: { slots: updatedSlots },
      });
    }

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

    if (claimedUnits > 0) {
      await tx.userVocationalActivity.update({
        where: { userId },
        data: { unitsClaimed: { increment: claimedUnits } },
      });
    }

    const remainingClaimableUnits = Math.max(0, unitsToClaim - claimedUnits);

    const xpToAward =
      claimedUnits > 0
        ? claimedUnits * Math.max(0, activity.resource.xpPerUnit || 0)
        : 0;

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

    // XP, skill metrics and track progress commit with the loot that earned
    // them. These used to run after the transaction, so anything interrupting
    // in between (a daemon restart on deploy, a dropped connection) left the
    // player holding the items with the tick already marked claimed and the XP
    // silently, unrecoverably lost.
    if (claimedUnits > 0) {
      await recordSkillWork({
        db: tx,
        userId,
        actionType: activity.actionType,
        items: grantedQuantity,
        seconds: claimedUnits * activity.unitSeconds,
      });

      if (xpToAward > 0) {
        await awardXp(
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

    return {
      claimedUnits,
      grantedQuantity,
      remainingClaimableUnits,
      xpToAward,
      unitSeconds: activity.unitSeconds,
      vocationalActionType: activity.actionType,
      resourceName: activity.resource.name,
      itemName: activity.resource.item.name,
      stopReason,
      itemChanges: [...itemChanges].map(([userItemId, quantity]) => ({
        userItemId,
        quantity,
      })),
      newStacks: grant.newStacks,
    };
  });

  const userXpGained =
    result.claimedUnits > 0 ? Math.max(0, result.xpToAward) : 0;
  const skillXpGained = userXpGained;

  const summary: VocationalCompletionSummary | null =
    result.vocationalActionType && result.resourceName && result.itemName
      ? {
          kind: "VOCATION",
          actionType: result.vocationalActionType,
          resourceName: result.resourceName,
          itemName: result.itemName,
          grantedQuantity: result.grantedQuantity,
          userXpGained,
          skillXpGained,
          stopReason: result.stopReason,
        }
      : null;

  return {
    claimedUnits: result.claimedUnits,
    grantedQuantity: result.grantedQuantity,
    remainingClaimableUnits: result.remainingClaimableUnits,
    userXpGained,
    skillXpGained,
    summary,
    stopReason: result.stopReason,
    itemChanges: result.itemChanges,
    newStacks: result.newStacks,
  };
}
