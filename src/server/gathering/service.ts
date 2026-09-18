import "server-only";

import type { Prisma } from "~/generated/prisma/client";
import {
  ItemRarity,
  StatType,
  VocationalActionType,
  XpActionType,
} from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import {
  calculateGatheringRewards,
  type GatheringReward,
  type GatheringRewardPoolEntry,
} from "~/server/gathering/rewards";
import { getCharacterStatSnapshot } from "~/server/stats";
import { grantStackableItemToInventory } from "~/server/vocations/grantItem";
import { awardXp } from "~/utils/leveling";
import { awardTrackXp, getTrackXpProgress } from "~/utils/progression";

const MAX_EXPEDITION_SECONDS = 7 * 24 * 60 * 60;
const FALLBACK_RARITY_ORDER = Object.fromEntries(
  Object.values(ItemRarity).map((rarity, index) => [rarity, index]),
) as Record<ItemRarity, number>;

export type GatheringModifierSnapshot = {
  luck: number;
  gatheringEfficiency: number;
  sources: {
    equipmentLuck: number;
    equipmentGatheringEfficiency: number;
    activeEffect: null | {
      itemId: number;
      name: string;
      sprite: string;
      endsAt: string;
      luck: number;
      gatheringEfficiency: number;
    };
  };
};

export type GatheringExpeditionStatus = {
  expedition: null | {
    id: number;
    status: "ACTIVE" | "READY" | "CLAIMED";
    startedAt: string;
    endsAt: string;
    claimedAt: string | null;
    durationSeconds: number;
    location: { id: number; name: string };
    rewards: GatheringReward[];
  };
};

export async function getGatheringModifierSnapshot(
  userId: string,
): Promise<GatheringModifierSnapshot> {
  const character = await getCharacterStatSnapshot(userId);
  const equipmentLuck = character.equipmentBonuses[StatType.LUCK];
  const equipmentEfficiency =
    character.equipmentBonuses[StatType.GATHERING_EFFICIENCY];
  const effectLuck = character.temporaryBonuses[StatType.LUCK];
  const effectEfficiency =
    character.temporaryBonuses[StatType.GATHERING_EFFICIENCY];
  const activeEffect = character.activeEffect;

  return {
    luck: character.finalStats.luck,
    gatheringEfficiency: character.finalStats.gatheringEfficiency,
    sources: {
      equipmentLuck,
      equipmentGatheringEfficiency: equipmentEfficiency,
      activeEffect: activeEffect
        ? {
            itemId: activeEffect.item.id,
            name: activeEffect.item.name,
            sprite: activeEffect.item.sprite,
            endsAt: activeEffect.endsAt.toISOString(),
            luck: effectLuck,
            gatheringEfficiency: effectEfficiency,
          }
        : null,
    },
  };
}

function parseRewards(value: unknown): GatheringReward[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const rarity = row.rarity;
    if (
      typeof row.resourceId !== "number" ||
      typeof row.itemId !== "number" ||
      typeof row.name !== "string" ||
      typeof row.sprite !== "string" ||
      typeof row.quantity !== "number" ||
      !Object.values(ItemRarity).includes(rarity as ItemRarity)
    ) {
      return [];
    }
    return [
      {
        resourceId: row.resourceId,
        itemId: row.itemId,
        name: row.name,
        sprite: row.sprite,
        rarity: rarity as ItemRarity,
        quantity: Math.max(1, Math.floor(row.quantity)),
      },
    ];
  });
}

function parseRewardPool(value: unknown): GatheringRewardPoolEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const rarity = row.rarity;
    if (
      typeof row.resourceId !== "number" ||
      typeof row.itemId !== "number" ||
      typeof row.name !== "string" ||
      typeof row.sprite !== "string" ||
      typeof row.baseChance !== "number" ||
      typeof row.minQuantity !== "number" ||
      typeof row.maxQuantity !== "number" ||
      !Object.values(ItemRarity).includes(rarity as ItemRarity)
    ) {
      return [];
    }
    return [
      {
        resourceId: row.resourceId,
        itemId: row.itemId,
        name: row.name,
        sprite: row.sprite,
        rarity: rarity as ItemRarity,
        baseChance: row.baseChance,
        minQuantity: row.minQuantity,
        maxQuantity: row.maxQuantity,
      },
    ];
  });
}

function toStatus(
  expedition: {
    id: number;
    startedAt: Date;
    endsAt: Date;
    claimedAt: Date | null;
    durationSeconds: number;
    rewards: unknown;
    location: { id: number; name: string };
  } | null,
): GatheringExpeditionStatus {
  if (!expedition) return { expedition: null };
  const status = expedition.claimedAt
    ? "CLAIMED"
    : expedition.endsAt.getTime() <= Date.now()
      ? "READY"
      : "ACTIVE";
  return {
    expedition: {
      id: expedition.id,
      status,
      startedAt: expedition.startedAt.toISOString(),
      endsAt: expedition.endsAt.toISOString(),
      claimedAt: expedition.claimedAt?.toISOString() ?? null,
      durationSeconds: expedition.durationSeconds,
      location: expedition.location,
      rewards: parseRewards(expedition.rewards),
    },
  };
}

export async function getGatheringExpeditionStatus(
  userId: string,
): Promise<GatheringExpeditionStatus> {
  const expedition = await prisma.userGatheringExpedition.findUnique({
    where: { userId },
    select: {
      id: true,
      startedAt: true,
      endsAt: true,
      claimedAt: true,
      durationSeconds: true,
      rewards: true,
      location: { select: { id: true, name: true } },
    },
  });
  return toStatus(expedition);
}

export async function getGatheringPageData(userId: string) {
  const [user, skillProgress, durations, rarityConfigs, modifiers, status] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          level: true,
          currentLocation: {
            select: {
              id: true,
              name: true,
              requiredLevel: true,
              gatheringEnabled: true,
              gatheringRequiredLevel: true,
              resources: {
                where: {
                  enabled: true,
                  resource: { actionType: VocationalActionType.GATHERING },
                },
                select: {
                  resource: {
                    select: {
                      id: true,
                      name: true,
                      rarity: true,
                      requiredSkillLevel: true,
                      item: { select: { id: true, name: true, sprite: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      getTrackXpProgress({
        userId,
        trackType: "SKILL",
        trackKey: VocationalActionType.GATHERING,
      }),
      prisma.gatheringDuration.findMany({
        where: { enabled: true },
        select: {
          id: true,
          label: true,
          durationSeconds: true,
          xpReward: true,
          requiredGatheringLevel: true,
        },
        orderBy: [{ sortOrder: "asc" }, { durationSeconds: "asc" }],
      }),
      prisma.rarityConfig.findMany({
        select: { rarity: true, sortOrder: true },
      }),
      getGatheringModifierSnapshot(userId),
      getGatheringExpeditionStatus(userId),
    ]);

  if (!user) throw new Error("User not found");
  const rarityOrder = new Map<ItemRarity, number>(
    rarityConfigs.map((config) => [config.rarity, config.sortOrder]),
  );

  return {
    skillProgress: {
      trackKey: VocationalActionType.GATHERING,
      ...skillProgress,
    },
    modifiers,
    durations: durations.map((duration) => ({
      ...duration,
      unlocked: skillProgress.level >= duration.requiredGatheringLevel,
    })),
    location: user.currentLocation
      ? {
          id: user.currentLocation.id,
          name: user.currentLocation.name,
          gatheringEnabled: user.currentLocation.gatheringEnabled,
          requiredGatheringLevel: user.currentLocation.gatheringRequiredLevel,
          unlocked:
            user.currentLocation.gatheringEnabled &&
            user.level >= user.currentLocation.requiredLevel &&
            skillProgress.level >= user.currentLocation.gatheringRequiredLevel,
          resources: user.currentLocation.resources
            .map(({ resource }) => ({
              id: resource.id,
              itemId: resource.item.id,
              name: resource.item.name || resource.name,
              sprite: resource.item.sprite,
              rarity: resource.rarity,
              requiredGatheringLevel: resource.requiredSkillLevel,
            }))
            .sort((a, b) => {
              const rarityDiff =
                (rarityOrder.get(a.rarity) ?? FALLBACK_RARITY_ORDER[a.rarity]) -
                (rarityOrder.get(b.rarity) ?? FALLBACK_RARITY_ORDER[b.rarity]);
              return rarityDiff || a.name.localeCompare(b.name);
            })
            .map((resource) =>
              skillProgress.level >= resource.requiredGatheringLevel
                ? { ...resource, unlocked: true as const }
                : {
                    unlocked: false as const,
                    requiredGatheringLevel: resource.requiredGatheringLevel,
                  },
            ),
        }
      : null,
    ...status,
  };
}

export async function startGatheringExpedition(params: {
  userId: string;
  durationId: number;
}) {
  const { userId, durationId } = params;
  if (!Number.isInteger(durationId)) {
    throw new Error("Choose a valid expedition duration");
  }

  const [
    travel,
    vocation,
    garden,
    hunting,
    dungeon,
    existing,
    user,
    duration,
    skillProgress,
  ] =
    await Promise.all([
      prisma.userTravelActivity.findUnique({
        where: { userId },
        select: { id: true },
      }),
      prisma.userVocationalActivity.findUnique({
        where: { userId },
        select: { id: true },
      }),
      prisma.userGardenHarvestActivity.findUnique({
        where: { userId },
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
      prisma.userGatheringExpedition.findUnique({
        where: { userId },
        select: { id: true, claimedAt: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          level: true,
          currentLocationId: true,
          currentLocation: {
            select: {
              id: true,
              name: true,
              requiredLevel: true,
              gatheringEnabled: true,
              gatheringRequiredLevel: true,
              resources: {
                where: {
                  enabled: true,
                  resource: { actionType: VocationalActionType.GATHERING },
                },
                select: {
                  gatheringBaseChance: true,
                  gatheringMinQuantity: true,
                  gatheringMaxQuantity: true,
                  resource: {
                    select: {
                      id: true,
                      itemId: true,
                      name: true,
                      rarity: true,
                      requiredSkillLevel: true,
                      item: { select: { name: true, sprite: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.gatheringDuration.findUnique({ where: { id: durationId } }),
      getTrackXpProgress({
        userId,
        trackType: "SKILL",
        trackKey: VocationalActionType.GATHERING,
      }),
    ]);

  const hasActiveAction =
    Boolean(travel ?? vocation ?? garden ?? hunting ?? dungeon) ||
    existing?.claimedAt === null;
  if (hasActiveAction) {
    throw new Error("You already have an active activity");
  }
  if (!user) throw new Error("User not found");
  const location = user.currentLocation;
  if (!user.currentLocationId || !location) {
    throw new Error("Travel to a location before gathering");
  }
  if (!duration?.enabled)
    throw new Error("That expedition duration is unavailable");
  if (
    duration.durationSeconds < 60 ||
    duration.durationSeconds > MAX_EXPEDITION_SECONDS ||
    duration.rewardRolls < 1 ||
    duration.quantityMultiplier <= 0
  ) {
    throw new Error("That expedition duration is not configured correctly");
  }
  if (skillProgress.level < duration.requiredGatheringLevel) {
    throw new Error(
      `Requires Gathering level ${duration.requiredGatheringLevel} for that duration`,
    );
  }
  if (!location?.gatheringEnabled)
    throw new Error("That location is unavailable");
  if (user.level < location.requiredLevel) {
    throw new Error(`Requires character level ${location.requiredLevel}`);
  }
  if (skillProgress.level < location.gatheringRequiredLevel) {
    throw new Error(
      `Requires Gathering level ${location.gatheringRequiredLevel}`,
    );
  }

  const rewardPool: GatheringRewardPoolEntry[] = location.resources
    .filter(
      ({ resource }) => resource.requiredSkillLevel <= skillProgress.level,
    )
    .map((row) => ({
      resourceId: row.resource.id,
      itemId: row.resource.itemId,
      name: row.resource.item.name || row.resource.name,
      sprite: row.resource.item.sprite,
      rarity: row.resource.rarity,
      baseChance: Math.min(1, Math.max(0, row.gatheringBaseChance)),
      minQuantity: Math.max(1, row.gatheringMinQuantity),
      maxQuantity: Math.max(
        Math.max(1, row.gatheringMinQuantity),
        row.gatheringMaxQuantity,
      ),
    }))
    .filter((entry) => entry.baseChance > 0);
  if (rewardPool.length === 0) {
    throw new Error(
      "No resources are currently available for you at this location",
    );
  }

  const modifiers = await getGatheringModifierSnapshot(userId);
  const now = new Date();
  const endsAt = new Date(now.getTime() + duration.durationSeconds * 1000);

  await prisma.$transaction(async (tx) => {
    if (existing?.claimedAt) {
      await tx.userGatheringExpedition.delete({ where: { id: existing.id } });
    }
    await tx.userGatheringExpedition.create({
      data: {
        userId,
        locationId: location.id,
        durationId: duration.id,
        startedAt: now,
        endsAt,
        durationSeconds: duration.durationSeconds,
        rewardRolls: duration.rewardRolls,
        quantityMultiplier: duration.quantityMultiplier,
        xpReward: Math.max(0, duration.xpReward),
        skillLevelSnapshot: skillProgress.level,
        luckSnapshot: modifiers.luck,
        gatheringEfficiencySnapshot: modifiers.gatheringEfficiency,
        rewardPool: rewardPool as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return getGatheringExpeditionStatus(userId);
}

export async function claimGatheringExpedition(userId: string) {
  const expedition = await prisma.userGatheringExpedition.findUnique({
    where: { userId },
    select: {
      id: true,
      endsAt: true,
      claimedAt: true,
      rewardRolls: true,
      quantityMultiplier: true,
      xpReward: true,
      skillLevelSnapshot: true,
      luckSnapshot: true,
      gatheringEfficiencySnapshot: true,
      rewardPool: true,
    },
  });
  if (!expedition) throw new Error("No expedition to claim");
  if (expedition.claimedAt)
    throw new Error("This expedition was already claimed");
  if (expedition.endsAt.getTime() > Date.now()) {
    throw new Error("Your character has not returned yet");
  }

  const rewardPool = parseRewardPool(expedition.rewardPool);
  if (rewardPool.length === 0) {
    throw new Error("This expedition has no valid reward pool");
  }
  const rewards = calculateGatheringRewards({
    pool: rewardPool,
    rewardRolls: expedition.rewardRolls,
    quantityMultiplier: expedition.quantityMultiplier,
    skillLevel: expedition.skillLevelSnapshot,
    luck: expedition.luckSnapshot,
    gatheringEfficiency: expedition.gatheringEfficiencySnapshot,
  });
  if (rewards.length === 0)
    throw new Error("The expedition returned no rewards");

  const claimedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.userGatheringExpedition.updateMany({
      where: {
        id: expedition.id,
        userId,
        claimedAt: null,
        endsAt: { lte: claimedAt },
      },
      data: {
        claimedAt,
        rewards: rewards as unknown as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1)
      throw new Error("This expedition was already claimed");

    for (const reward of rewards) {
      const grant = await grantStackableItemToInventory({
        db: tx,
        userId,
        itemId: reward.itemId,
        rarity: reward.rarity,
        quantity: reward.quantity,
      });
      if (grant.remainingQuantity > 0) {
        throw new Error(
          "Make room in your inventory before claiming this haul",
        );
      }
    }
  });

  const [playerXp, gatheringXp] = await Promise.all([
    awardXp(
      userId,
      expedition.xpReward,
      XpActionType.VOCATION,
      VocationalActionType.GATHERING,
      "Gathering expedition",
      { expeditionId: expedition.id },
    ),
    awardTrackXp({
      userId,
      trackType: "SKILL",
      trackKey: VocationalActionType.GATHERING,
      amount: expedition.xpReward,
      description: "Gathering expedition",
    }),
  ]);

  return {
    rewards,
    xp: {
      character: playerXp.xpGained,
      gathering: gatheringXp.xpGained,
    },
    ...(await getGatheringExpeditionStatus(userId)),
  };
}

export async function cancelGatheringExpedition(userId: string) {
  const expedition = await prisma.userGatheringExpedition.findUnique({
    where: { userId },
    select: { id: true, endsAt: true, claimedAt: true },
  });
  if (!expedition || expedition.claimedAt) {
    throw new Error("No active Gathering expedition");
  }
  if (expedition.endsAt.getTime() <= Date.now()) {
    throw new Error(
      "Your character has returned; claim the expedition instead",
    );
  }
  await prisma.userGatheringExpedition.delete({ where: { id: expedition.id } });
  return { ok: true };
}
