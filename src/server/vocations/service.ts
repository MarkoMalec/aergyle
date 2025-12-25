import {
  ItemRarity,
  VocationalActionType,
  XpActionType,
  type UserVocationalActivity,
} from "@prisma/client";
import { prisma } from "~/lib/prisma";
import { MAX_VOCATION_DURATION_SECONDS } from "~/server/vocations/constants";
import { computeVocationalProgress } from "~/server/vocations/progress";
import { grantStackableItemToInventory } from "~/server/vocations/grantItem";
import { awardXp } from "~/utils/leveling";
import { awardTrackXp, getTrackXpProgress } from "~/utils/progression";

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
  // Important: avoid infinite recursion if we cannot claim (e.g., inventory full).
  if (progress.unitsClaimable > 0) {
    const result = await claimVocationalRewards({ userId });
    if (result.claimedUnits > 0) {
      return await getVocationalStatus(userId);
    }
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
      defaultSeconds: true,
      yieldPerUnit: true,
      rarity: true,
      name: true,
    },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  let baseSeconds = resource.defaultSeconds;

  if (locationId) {
    const loc = await prisma.locationVocationalResource.findUnique({
      where: {
        locationId_resourceId: {
          locationId,
          resourceId,
        },
      },
      select: { enabled: true, baseSeconds: true },
    });

    if (loc) {
      if (!loc.enabled) {
        throw new Error("Resource is not available at this location");
      }
      baseSeconds = loc.baseSeconds;
    }
  }

  // TODO: apply tool/buff modifiers; for now, snapshot baseSeconds.
  const unitSeconds = Math.max(1, Math.floor(baseSeconds));

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
}> {
  const { userId, maxUnits } = params;

  const result = await prisma.$transaction(async (tx) => {
    const activity = await tx.userVocationalActivity.findUnique({
      where: { userId },
      include: {
        resource: {
          select: { itemId: true, yieldPerUnit: true, rarity: true, xpPerUnit: true },
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
      };
    }

    const yieldPerUnit = Math.max(1, activity.resource.yieldPerUnit);
    const targetQuantity = claimableUnits * yieldPerUnit;

    const grant = await grantStackableItemToInventory({
      db: tx as any,
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

    const remainingClaimableUnits = Math.max(0, claimableUnits - claimedUnits);

    const xpToAward =
      claimedUnits > 0
        ? claimedUnits * Math.max(0, activity.resource.xpPerUnit || 0)
        : 0;

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

    return { claimedUnits, grantedQuantity, remainingClaimableUnits, xpToAward, vocationalActionType: activity.actionType };
  });

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

  return {
    claimedUnits: result.claimedUnits,
    grantedQuantity: result.grantedQuantity,
    remainingClaimableUnits: result.remainingClaimableUnits,
  };
}
