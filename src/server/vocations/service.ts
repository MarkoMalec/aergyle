import { ItemType, VocationalActionType } from "~/generated/prisma/enums";
import type { ItemRarity } from "~/generated/prisma/enums";
import type { UserVocationalActivity } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import { MAX_VOCATION_DURATION_SECONDS } from "~/server/vocations/constants";
import { computeVocationalProgress } from "~/server/vocations/progress";
import {
  claimVocationalRewards,
  type VocationalCompletionSummary,
} from "~/server/vocations/claim";
import {
  computeEffectiveUnitSeconds,
  getToolEfficiencyForAction,
  assertRequiredToolEquipped,
} from "~/server/vocations/tools";
import { getTrackXpProgress } from "~/utils/progression";
import { normalizeInventorySlots } from "~/utils/inventorySlots";

export type VocationalStatus = {
  activity:
    | (UserVocationalActivity & {
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
      })
    | null;
  progress: ReturnType<typeof computeVocationalProgress> | null;
  skillProgress: {
    trackKey: string;
    level: number;
    currentXp: number;
    xpForNextLevel: number;
    xpProgress: number;
    xpRemaining: number;
  } | null;
  // One-time completion summaries generated during this call.
  // Intended for UX ("while you were away") dialogs.
  completionSummaries?: VocationalCompletionSummary[];
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

async function fetchVocationalStatusRaw(
  userId: string,
): Promise<VocationalStatus> {
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

export async function getVocationalStatus(
  userId: string,
): Promise<VocationalStatus> {
  const status = await fetchVocationalStatusRaw(userId);
  const { activity, progress } = status;

  if (!activity || !progress) {
    return { activity: null, progress: null, skillProgress: null };
  }

  // Settle anything due on status fetch ("refresh/visit" model). The claim also ends
  // an activity whose time is up, so the UI doesn't stay stuck at 100%.
  if (progress.unitsClaimable > 0 || progress.isComplete) {
    try {
      const claim = await claimVocationalRewards({ userId });
      const nextStatus = await fetchVocationalStatusRaw(userId);

      // UX note: summarize when the activity ended, but skip a plain finish that paid
      // nothing here (the daemon already granted it all live).
      const summary = claim.stopReason ? claim.summary : null;
      const worthShowing =
        summary &&
        (summary.stopReason !== "COMPLETED" || claim.claimedUnits > 0);

      return worthShowing
        ? { ...nextStatus, completionSummaries: [summary] }
        : nextStatus;
    } catch (error) {
      // Never take the page down over a failed claim; the next check retries it.
      console.error("[vocations] claim failed", error);
      return status;
    }
  }

  return status;
}

export async function getVocationalStatusDebug(
  userId: string,
): Promise<VocationalStatusDebug> {
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

  const [
    activeTravel,
    activeGardenHarvest,
    activeGatheringExpedition,
    activeHuntingExpedition,
    activeDungeonRun,
  ] =
    await Promise.all([
      prisma.userTravelActivity.findUnique({
        where: { userId },
        select: { id: true },
      }),
      prisma.userGardenHarvestActivity.findUnique({
        where: { userId },
        select: { id: true },
      }),
      prisma.userGatheringExpedition.findFirst({
        where: { userId, claimedAt: null },
        select: { id: true },
      }),
      prisma.userHuntingExpedition.findFirst({
        where: { userId, claimedAt: null },
        select: { id: true },
      }),
      prisma.userDungeonRun.findFirst({
        where: { userId, claimedAt: null },
        select: { id: true },
      }),
    ]);

  if (
    activeTravel ??
    activeGardenHarvest ??
    activeGatheringExpedition ??
    activeHuntingExpedition ??
    activeDungeonRun
  ) {
    throw new Error("You already have an active activity");
  }

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
      requiredRecipeItemId: true,
      defaultSeconds: true,
      yieldPerUnit: true,
      rarity: true,
      name: true,
    },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  if (
    resource.actionType === VocationalActionType.GATHERING ||
    resource.actionType === VocationalActionType.GARDENING ||
    resource.actionType === VocationalActionType.HUNTING
  ) {
    throw new Error("Use the dedicated skill page to start this activity");
  }

  if (resource.requiredRecipeItemId) {
    const learnedRecipe = await prisma.userLearnedRecipe.findUnique({
      where: {
        userId_recipeItemId: {
          userId,
          recipeItemId: resource.requiredRecipeItemId,
        },
      },
      select: { id: true },
    });

    if (!learnedRecipe) {
      throw new Error("You have not learned the required recipe");
    }
  }

  // Tool gate: some vocations require a specific tool to be equipped.
  await assertRequiredToolEquipped(
    userId,
    resource.actionType as VocationalActionType,
  );

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

  const secondsPerUnit = resource.defaultSeconds;

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
    if (!loc?.enabled) {
      throw new Error("Resource is not available at this location");
    }
  }

  const efficiency = await getToolEfficiencyForAction(
    userId,
    resource.actionType as VocationalActionType,
  );
  const { unitSeconds } = computeEffectiveUnitSeconds(
    secondsPerUnit,
    efficiency,
  );

  // Validate requirements before starting.
  // For fishing: must select a bait stack, must be in inventory, and must be BAIT.
  // For other actions: if VocationalRequirement rows exist, ensure at least 1 unit is craftable.
  const requirements = await prisma.vocationalRequirement.findMany({
    where: { resourceId: resource.id },
    select: { itemId: true, quantityPerUnit: true },
  });

  if (
    (resource.actionType as VocationalActionType) ===
    VocationalActionType.FISHING
  ) {
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
      if (
        requirements.length !== 1 ||
        requirements[0]!.itemId !== bait.itemId
      ) {
        throw new Error(
          "Selected bait does not match this fishing resource requirements",
        );
      }
      const baitPerUnit = Math.max(1, requirements[0]!.quantityPerUnit);
      if (bait.quantity < baitPerUnit) {
        throw new Error(`You need ${baitPerUnit} bait per catch`);
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
      totalByTemplateId.set(
        ui.itemId,
        (totalByTemplateId.get(ui.itemId) ?? 0) + ui.quantity,
      );
    }

    for (const req of requirements) {
      const needed = Math.max(1, req.quantityPerUnit);
      const available = totalByTemplateId.get(req.itemId) ?? 0;
      if (available < needed) {
        throw new Error(
          "You don't have the required materials to start this action",
        );
      }
    }
  }

  const durationSeconds = Math.min(
    MAX_VOCATION_DURATION_SECONDS,
    Math.max(
      1,
      Math.floor(params.durationSeconds ?? MAX_VOCATION_DURATION_SECONDS),
    ),
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
        (resource.actionType as VocationalActionType) ===
        VocationalActionType.FISHING
          ? params.baitUserItemId ?? null
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
