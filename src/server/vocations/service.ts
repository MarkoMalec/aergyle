import { ItemRarity, ItemType, VocationalActionType, XpActionType } from "~/generated/prisma/enums";
import type { UserVocationalActivity } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import { MAX_VOCATION_DURATION_SECONDS } from "~/server/vocations/constants";
import { computeVocationalProgress } from "~/server/vocations/progress";
import { grantStackableItemToInventory } from "~/server/vocations/grantItem";
import {
  computeEffectiveUnitSeconds,
  getToolEfficiencyForAction,
  assertRequiredToolEquipped,
} from "~/server/vocations/tools";
import { awardXp } from "~/utils/leveling";
import { awardTrackXp, getTrackXpProgress } from "~/utils/progression";
import { normalizeInventorySlots } from "~/utils/inventorySlots";

export type VocationalStatus = {
  activity: (UserVocationalActivity & {
    resource: {
      id: number;
      name: string;
      itemId: number;
      yieldPerUnit: number;
      xpPerUnit: number;
      rarity: ItemRarity;
      item: { sprite: string };
    };
    location: { id: number; name: string } | null;
  }) | null;
  progress: ReturnType<typeof computeVocationalProgress> | null;
  skillProgress:
    | {
        trackKey: string;
        level: number;
        currentXp: number;
        xpForNextLevel: number;
        xpProgress: number;
        xpRemaining: number;
      }
    | null;
  // One-time completion summaries generated during this call.
  // Intended for UX ("while you were away") dialogs.
  completionSummaries?: VocationalCompletionSummary[];
};

export type VocationalCompletionSummary = {
  kind: "VOCATION";
  actionType: VocationalActionType;
  resourceName: string;
  itemName: string;
  grantedQuantity: number;
  userXpGained: number;
  skillXpGained: number;
};

type VocationalDebugSnapshot = {
  nowIso: string;
  activity: null | {
    startedAtIso: string;
    endsAtIso: string;
    unitSeconds: number;
    unitsClaimed: number;
    resourceId: number;
    resourceName: string;
    yieldPerUnit: number;
    rarity: ItemRarity;
    itemId: number;
  };
  progress: null | {
    unitSeconds: number;
    elapsedSeconds: number;
    remainingSeconds: number;
    unitsTotal: number;
    unitsClaimable: number;
    unitProgress: number;
    isComplete: boolean;
  };
};

export type VocationalStatusDebug = VocationalStatus & {
  debug: {
    before: VocationalDebugSnapshot;
    claim: null | {
      claimedUnits: number;
      grantedQuantity: number;
      remainingClaimableUnits: number;
    };
    after: VocationalDebugSnapshot;
  };
};

async function fetchVocationalStatusRaw(userId: string): Promise<VocationalStatus> {
  const activity = await prisma.userVocationalActivity.findUnique({
    where: { userId },
    include: {
      resource: {
        select: {
          id: true,
          name: true,
          itemId: true,
          yieldPerUnit: true,
          xpPerUnit: true,
          rarity: true,
          item: { select: { sprite: true } },
        },
      },
      location: {
        select: { id: true, name: true },
      },
    },
  });

  if (!activity) {
    return { activity: null, progress: null, skillProgress: null };
  }

  const progress = computeVocationalProgress(activity);

  const trackKey = String(activity.actionType);
  const skillProgress = await getTrackXpProgress({
    userId,
    trackType: "SKILL",
    trackKey,
  });

  return {
    activity,
    progress,
    skillProgress: {
      trackKey,
      ...skillProgress,
    },
  };
}

function toDebugSnapshot(status: VocationalStatus): VocationalDebugSnapshot {
  const nowIso = new Date().toISOString();

  if (!status.activity || !status.progress) {
    return { nowIso, activity: null, progress: null };
  }

  return {
    nowIso,
    activity: {
      startedAtIso: status.activity.startedAt.toISOString(),
      endsAtIso: status.activity.endsAt.toISOString(),
      unitSeconds: status.activity.unitSeconds,
      unitsClaimed: status.activity.unitsClaimed,
      resourceId: status.activity.resource.id,
      resourceName: status.activity.resource.name,
      yieldPerUnit: status.activity.resource.yieldPerUnit,
      rarity: status.activity.resource.rarity,
      itemId: status.activity.resource.itemId,
    },
    progress: {
      unitSeconds: status.progress.unitSeconds,
      elapsedSeconds: status.progress.elapsedSeconds,
      remainingSeconds: status.progress.remainingSeconds,
      unitsTotal: status.progress.unitsTotal,
      unitsClaimable: status.progress.unitsClaimable,
      unitProgress: status.progress.unitProgress,
      isComplete: status.progress.isComplete,
    },
  };
}

export async function getVocationalStatus(userId: string): Promise<VocationalStatus> {
  const status = await fetchVocationalStatusRaw(userId);
  const { activity, progress } = status;

  if (!activity || !progress) {
    return { activity: null, progress: null, skillProgress: null };
  }

  // Auto-claim any newly completed units on status fetch ("refresh/visit" model).
  // UX note: only emit completion summaries when the activity is fully complete.
  if (progress.unitsClaimable > 0) {
    const wasComplete = progress.isComplete;
    const claim = await claimVocationalRewards({ userId });

    const nextStatus = await fetchVocationalStatusRaw(userId);
    const completionSummaries: VocationalCompletionSummary[] = [];

    if (wasComplete && claim.claimedUnits > 0 && claim.summary) {
      completionSummaries.push(claim.summary);
    }

    return completionSummaries.length > 0
      ? { ...nextStatus, completionSummaries }
      : nextStatus;
  }

  // If the activity has ended and there is nothing left to claim, clear it so the UI
  // doesn't remain stuck at 100% until the user presses Stop.
  if (progress.isComplete && progress.unitsClaimable === 0) {
    await prisma.userVocationalActivity.deleteMany({ where: { userId } });
    return { activity: null, progress: null, skillProgress: null };
  }

  return status;
}

export async function getVocationalStatusDebug(userId: string): Promise<VocationalStatusDebug> {
  const beforeStatus = await fetchVocationalStatusRaw(userId);
  const before = toDebugSnapshot(beforeStatus);

  let claim: VocationalStatusDebug["debug"]["claim"] = null;

  if (beforeStatus.progress && beforeStatus.progress.unitsClaimable > 0) {
    claim = await claimVocationalRewards({ userId });
  }

  const afterStatus = await fetchVocationalStatusRaw(userId);
  const after = toDebugSnapshot(afterStatus);

  return {
    activity: afterStatus.activity,
    progress: afterStatus.progress,
    skillProgress: afterStatus.skillProgress,
    debug: {
      before,
      claim,
      after,
    },
  };
}

export async function startVocationalActivity(params: {
  userId: string;
  resourceId: number;
  locationId?: number | null;
  durationSeconds?: number | null;
  replace?: boolean;
  baitUserItemId?: number | null;
}): Promise<VocationalStatus> {
  const { userId, resourceId, locationId } = params;

  const existing = await prisma.userVocationalActivity.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (existing) {
    const replace = params.replace !== false;
    if (!replace) {
      throw new Error("You already have an active activity");
    }

    // Replace existing activity: auto-grant what was earned, then stop.
    await stopVocationalActivity({ userId });
  }

  const resource = await prisma.vocationalResource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      actionType: true,
      itemId: true,
      requiredSkillLevel: true,
      defaultSeconds: true,
      yieldPerUnit: true,
      rarity: true,
      name: true,
    },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  // Tool gate: some vocations require a specific tool to be equipped.
  await assertRequiredToolEquipped(userId, resource.actionType as VocationalActionType);

  // Skill gate: player must meet the required skill level for this action type.
  const requiredLevel = Math.max(1, resource.requiredSkillLevel ?? 1);
  if (requiredLevel > 1) {
    const trackKey = String(resource.actionType);
    const skillProgress = await getTrackXpProgress({
      userId,
      trackType: "SKILL",
      trackKey,
    });

    if (skillProgress.level < requiredLevel) {
      throw new Error(`Requires ${trackKey} level ${requiredLevel}`);
    }
  }

  let secondsPerUnit = resource.defaultSeconds;

  if (locationId) {
    const loc = await prisma.locationVocationalResource.findUnique({
      where: {
        locationId_resourceId: {
          locationId,
          resourceId,
        },
      },
      select: { enabled: true },
    });

    // If a location is specified, this join table is the source of truth for
    // whether the resource exists at that location.
    if (!loc || !loc.enabled) {
      throw new Error("Resource is not available at this location");
    }
  }

  const efficiency = await getToolEfficiencyForAction(
    userId,
    resource.actionType as VocationalActionType,
  );
  const { unitSeconds } = computeEffectiveUnitSeconds(secondsPerUnit, efficiency);

  // Validate requirements before starting.
  // For fishing: must select a bait stack, must be in inventory, and must be BAIT.
  // For other actions: if VocationalRequirement rows exist, ensure at least 1 unit is craftable.
  const requirements = await prisma.vocationalRequirement.findMany({
    where: { resourceId: resource.id },
    select: { itemId: true, quantityPerUnit: true },
  });

  if ((resource.actionType as VocationalActionType) === VocationalActionType.FISHING) {
    const baitUserItemId = params.baitUserItemId ?? null;
    if (!baitUserItemId) {
      throw new Error("You must select a bait stack to fish");
    }

    const inventory = await prisma.inventory.findUnique({
      where: { userId },
      select: { slots: true },
    });

    const slots = normalizeInventorySlots(inventory?.slots, null);
    const baitInSlots = slots.some((slot) => slot.item?.id === baitUserItemId);
    if (!baitInSlots) {
      throw new Error("Selected bait is not in your inventory");
    }

    const bait = await prisma.userItem.findFirst({
      where: { id: baitUserItemId, userId, status: "IN_INVENTORY" },
      select: {
        id: true,
        itemId: true,
        quantity: true,
        itemTemplate: { select: { itemType: true } },
      },
    });

    if (!bait || bait.quantity <= 0) {
      throw new Error("Selected bait stack is empty");
    }

    if (bait.itemTemplate.itemType !== ItemType.BAIT) {
      throw new Error("Selected item is not bait");
    }

    // If requirements exist for this resource, they must match the selected bait template.
    if (requirements.length > 0) {
      if (requirements.length !== 1 || requirements[0]!.itemId !== bait.itemId) {
        throw new Error("Selected bait does not match this fishing resource requirements");
      }
    }
  } else if (requirements.length > 0) {
    const inventory = await prisma.inventory.findUnique({
      where: { userId },
      select: { slots: true },
    });

    const slots = normalizeInventorySlots(inventory?.slots, null);
    const userItemIds = slots
      .map((slot) => slot.item?.id)
      .filter((id): id is number => typeof id === "number");

    const userItems = await prisma.userItem.findMany({
      where: { id: { in: userItemIds }, userId, status: "IN_INVENTORY" },
      select: { id: true, itemId: true, quantity: true },
    });

    const totalByTemplateId = new Map<number, number>();
    for (const ui of userItems) {
      totalByTemplateId.set(ui.itemId, (totalByTemplateId.get(ui.itemId) ?? 0) + ui.quantity);
    }

    for (const req of requirements) {
      const needed = Math.max(1, req.quantityPerUnit);
      const available = totalByTemplateId.get(req.itemId) ?? 0;
      if (available < needed) {
        throw new Error("You don't have the required materials to start this action");
      }
    }
  }

  const durationSeconds = Math.min(
    MAX_VOCATION_DURATION_SECONDS,
    Math.max(1, Math.floor(params.durationSeconds ?? MAX_VOCATION_DURATION_SECONDS)),
  );

  const now = new Date();
  const endsAt = new Date(now.getTime() + durationSeconds * 1000);

  await prisma.userVocationalActivity.create({
    data: {
      userId,
      actionType: resource.actionType as VocationalActionType,
      resourceId: resource.id,
      locationId: locationId ?? null,
      startedAt: now,
      endsAt,
      unitSeconds,
      unitsClaimed: 0,
      baitUserItemId:
        (resource.actionType as VocationalActionType) === VocationalActionType.FISHING
          ? (params.baitUserItemId ?? null)
          : null,
    },
  });

  return await getVocationalStatus(userId);
}

export async function stopVocationalActivity(params: {
  userId: string;
}): Promise<VocationalStatus> {
  const { userId } = params;

  // Always grant any earned units before stopping.
  // This preserves the "auto-grant" model without exposing a manual claim option.
  await claimVocationalRewards({ userId });

  await prisma.userVocationalActivity.deleteMany({ where: { userId } });
  return { activity: null, progress: null, skillProgress: null };
}

export async function claimVocationalRewards(params: {
  userId: string;
  maxUnits?: number;
}): Promise<{
  claimedUnits: number;
  grantedQuantity: number;
  remainingClaimableUnits: number;
  userXpGained: number;
  skillXpGained: number;
  summary: VocationalCompletionSummary | null;
}> {
  const { userId, maxUnits } = params;

  const result = await prisma.$transaction(async (tx) => {
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
            item: { select: { name: true } },
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
        vocationalActionType: null,
        resourceName: null,
        itemName: null,
      };
    }

    const progress = computeVocationalProgress(activity);
    const claimableUnits = Math.min(
      progress.unitsClaimable,
      maxUnits === undefined ? progress.unitsClaimable : Math.max(0, Math.floor(maxUnits)),
    );

    if (claimableUnits <= 0) {
      const remaining = Math.max(0, progress.unitsTotal - activity.unitsClaimed);
      return {
        claimedUnits: 0,
        grantedQuantity: 0,
        remainingClaimableUnits: remaining,
        xpToAward: 0,
        vocationalActionType: activity.actionType,
        resourceName: activity.resource.name,
        itemName: activity.resource.item.name,
      };
    }

    // Load requirements for this resource.
    const requirements = await tx.vocationalRequirement.findMany({
      where: { resourceId: activity.resourceId },
      select: { itemId: true, quantityPerUnit: true },
    });

    // Load inventory slots + referenced UserItems so we can compute availability and consume.
    const inventory = await tx.inventory.findUnique({
      where: { userId },
      select: { slots: true },
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
        quantity: true,
        itemTemplate: { select: { itemType: true } },
      },
    });

    const userItemById = new Map<number, (typeof userItems)[number]>();
    for (const ui of userItems) userItemById.set(ui.id, ui);

    const totalByTemplateId = new Map<number, number>();
    for (const ui of userItems) {
      totalByTemplateId.set(ui.itemId, (totalByTemplateId.get(ui.itemId) ?? 0) + ui.quantity);
    }

    const isFishing = activity.actionType === VocationalActionType.FISHING;

    let maxUnitsByInputs = Infinity;

    if (isFishing) {
      const baitUserItemId = activity.baitUserItemId ?? null;
      if (!baitUserItemId) {
        // Invalid activity state; stop it.
        await tx.userVocationalActivity.delete({ where: { userId } });
        return {
          claimedUnits: 0,
          grantedQuantity: 0,
          remainingClaimableUnits: 0,
          xpToAward: 0,
          vocationalActionType: activity.actionType,
          resourceName: activity.resource.name,
          itemName: activity.resource.item.name,
        };
      }

      const baitSlotExists = slots.some((slot) => slot?.item?.id === baitUserItemId);
      const bait = userItemById.get(baitUserItemId);
      if (!baitSlotExists || !bait || bait.quantity <= 0) {
        await tx.userVocationalActivity.delete({ where: { userId } });
        return {
          claimedUnits: 0,
          grantedQuantity: 0,
          remainingClaimableUnits: 0,
          xpToAward: 0,
          vocationalActionType: activity.actionType,
          resourceName: activity.resource.name,
          itemName: activity.resource.item.name,
        };
      }

      if (bait.itemTemplate.itemType !== ItemType.BAIT) {
        await tx.userVocationalActivity.delete({ where: { userId } });
        return {
          claimedUnits: 0,
          grantedQuantity: 0,
          remainingClaimableUnits: 0,
          xpToAward: 0,
          vocationalActionType: activity.actionType,
          resourceName: activity.resource.name,
          itemName: activity.resource.item.name,
        };
      }

      const baitPerUnit = Math.max(1, requirements[0]?.quantityPerUnit ?? 1);
      maxUnitsByInputs = Math.floor(bait.quantity / baitPerUnit);
    } else if (requirements.length > 0) {
      for (const req of requirements) {
        const perUnit = Math.max(1, req.quantityPerUnit);
        const available = totalByTemplateId.get(req.itemId) ?? 0;
        maxUnitsByInputs = Math.min(maxUnitsByInputs, Math.floor(available / perUnit));
      }
    }

    const unitsToClaim = Math.min(claimableUnits, maxUnitsByInputs);

    // If time says we can claim but inputs are exhausted, auto-stop the activity.
    if (unitsToClaim <= 0) {
      if (claimableUnits > 0 && maxUnitsByInputs <= 0) {
        await tx.userVocationalActivity.delete({ where: { userId } });
        return {
          claimedUnits: 0,
          grantedQuantity: 0,
          remainingClaimableUnits: 0,
          xpToAward: 0,
          vocationalActionType: activity.actionType,
          resourceName: activity.resource.name,
          itemName: activity.resource.item.name,
        };
      }

      const remaining = Math.max(0, progress.unitsTotal - activity.unitsClaimed);
      return {
        claimedUnits: 0,
        grantedQuantity: 0,
        remainingClaimableUnits: remaining,
        xpToAward: 0,
        vocationalActionType: activity.actionType,
        resourceName: activity.resource.name,
        itemName: activity.resource.item.name,
      };
    }

    // Consume required inputs for the units we're about to award.
    const updatedSlots = [...slots];
    let slotsChanged = false;

    const consumeSpecificUserItem = async (userItemId: number, quantityToConsume: number) => {
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
      } else {
        await tx.userItem.update({ where: { id: userItemId }, data: { quantity: newQty } });
        ui.quantity = newQty;
      }
    };
    const consumeTemplateId = async (templateItemId: number, quantityToConsume: number) => {
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
        } else {
          await tx.userItem.update({ where: { id: userItemId }, data: { quantity: newQty } });
          ui.quantity = newQty;
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
      await tx.inventory.update({ where: { userId }, data: { slots: updatedSlots } });
    }

    const yieldPerUnit = Math.max(1, activity.resource.yieldPerUnit);
    const targetQuantity = unitsToClaim * yieldPerUnit;

    const grant = await grantStackableItemToInventory({
      db: tx,
      userId,
      itemId: activity.resource.itemId,
      rarity: activity.resource.rarity,
      quantity: targetQuantity,
    });

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

    // Fishing: if the selected bait stack was depleted, stop the activity immediately.
    if (isFishing && activity.baitUserItemId) {
      const baitStillExists = await tx.userItem.findFirst({
        where: { id: activity.baitUserItemId, userId, status: "IN_INVENTORY" },
        select: { id: true },
      });
      if (!baitStillExists) {
        await tx.userVocationalActivity.delete({ where: { userId } });
      }
    }

    // If completed and fully claimed, remove the activity.
    const done = progress.isComplete && remainingClaimableUnits === 0;
    if (done) {
      // Recompute against the updated row to ensure we don't delete prematurely.
      const updated = await tx.userVocationalActivity.findUnique({ where: { userId } });
      if (updated) {
        const updatedProgress = computeVocationalProgress(updated);
        if (updatedProgress.isComplete && updatedProgress.unitsClaimable === 0) {
          await tx.userVocationalActivity.delete({ where: { userId } });
        }
      }
    }

    return {
      claimedUnits,
      grantedQuantity,
      remainingClaimableUnits,
      xpToAward,
      vocationalActionType: activity.actionType,
      resourceName: activity.resource.name,
      itemName: activity.resource.item.name,
    };
  });

  const userXpGained = result.claimedUnits > 0 ? Math.max(0, result.xpToAward) : 0;
  const skillXpGained = userXpGained;

  if (result.claimedUnits > 0 && result.xpToAward > 0 && result.vocationalActionType) {
    await awardXp(
      userId,
      result.xpToAward,
      XpActionType.VOCATION,
      result.vocationalActionType,
      "Vocational activity",
    );

    await awardTrackXp({
      userId,
      trackType: "SKILL",
      trackKey: String(result.vocationalActionType),
      amount: result.xpToAward,
      description: "Vocational activity (skill XP)",
    });
  }

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
        }
      : null;

  return {
    claimedUnits: result.claimedUnits,
    grantedQuantity: result.grantedQuantity,
    remainingClaimableUnits: result.remainingClaimableUnits,
    userXpGained,
    skillXpGained,
    summary,
  };
}
