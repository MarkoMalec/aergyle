import "server-only";

import { ItemType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import type { BalanceContent } from "~/game/balance/content";
import {
  ACTIVE_MONSTERS_WHERE,
  MONSTER_COMBAT_SELECT,
  toMonsterPoolEntry,
} from "~/server/dungeons/service";
import { GARDEN_TILE_COUNT } from "~/server/garden/service";
import { isFightableMonster } from "~/server/dungeons/resolver";
import { getStatGrowthRules } from "~/server/stats";
import { MAX_VOCATION_DURATION_SECONDS } from "~/server/vocations/constants";

/** Every balance input the admin simulators read, in one round of queries. */
export async function loadBalanceContent(): Promise<BalanceContent> {
  const [
    resources,
    gatheringTiers,
    huntingTiers,
    grounds,
    locations,
    seeds,
    dungeons,
    quests,
    items,
    rarities,
    statGrowth,
  ] = await Promise.all([
    prisma.vocationalResource.findMany({
      orderBy: [{ actionType: "asc" }, { requiredSkillLevel: "asc" }, { id: "asc" }],
      select: {
        id: true,
        actionType: true,
        name: true,
        itemId: true,
        requiredSkillLevel: true,
        requiredRecipeItemId: true,
        defaultSeconds: true,
        xpPerUnit: true,
        yieldPerUnit: true,
        requirements: { select: { itemId: true, quantityPerUnit: true } },
        locations: {
          where: { enabled: true },
          select: { location: { select: { requiredLevel: true } } },
        },
      },
    }),
    prisma.gatheringDuration.findMany({
      where: { enabled: true },
      orderBy: { durationSeconds: "asc" },
    }),
    prisma.huntingDuration.findMany({
      where: { enabled: true },
      orderBy: { durationSeconds: "asc" },
    }),
    prisma.huntingGround.findMany({
      where: { enabled: true },
      select: {
        name: true,
        requiredHuntingLevel: true,
        location: { select: { requiredLevel: true } },
      },
    }),
    prisma.location.findMany({
      orderBy: [{ requiredLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        requiredLevel: true,
        gatheringEnabled: true,
        gatheringRequiredLevel: true,
      },
    }),
    prisma.item.findMany({
      where: {
        itemType: ItemType.SEED,
        seedGrowSeconds: { gt: 0 },
        seedHarvestSeconds: { gt: 0 },
        seedYieldItemId: { not: null },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        seedXp: true,
        seedGrowSeconds: true,
        seedHarvestSeconds: true,
      },
    }),
    prisma.dungeon.findMany({
      where: { enabled: true },
      orderBy: [{ requiredLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        requiredLevel: true,
        durationSeconds: true,
        xpReward: true,
        packSize: true,
        location: { select: { name: true, requiredLevel: true } },
        monsters: {
          where: ACTIVE_MONSTERS_WHERE,
          select: {
            minCount: true,
            maxCount: true,
            creature: { select: MONSTER_COMBAT_SELECT },
          },
        },
      },
    }),
    prisma.quest.findMany({
      where: { enabled: true, npc: { enabled: true } },
      orderBy: [{ requiredLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        requiredLevel: true,
        rewardXp: true,
        repeat: true,
        npc: { select: { name: true } },
      },
    }),
    prisma.item.findMany({
      orderBy: [{ requiredLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        requiredLevel: true,
        itemType: true,
        equipTo: true,
        twoHanded: true,
        flipNegativeStatsWithRarity: true,
        stats: { select: { statType: true, value: true, maxValue: true } },
        statProgressions: {
          select: { statType: true, baseValue: true, unlocksAtRarity: true },
        },
        statRarityOverrides: {
          select: { statType: true, rarity: true, kind: true, value: true },
        },
      },
    }),
    prisma.rarityConfig.findMany({
      orderBy: { sortOrder: "asc" },
      select: { rarity: true, displayName: true, statMultiplier: true },
    }),
    getStatGrowthRules(),
  ]);

  return {
    resources: resources.map((resource) => {
      const locationLevels = resource.locations.map((row) => row.location.requiredLevel);
      return {
        id: resource.id,
        skill: resource.actionType,
        name: resource.name,
        itemId: resource.itemId,
        requiredSkillLevel: Math.max(1, resource.requiredSkillLevel),
        requiredCharacterLevel:
          locationLevels.length > 0 ? Math.max(1, Math.min(...locationLevels)) : null,
        baseSeconds: resource.defaultSeconds,
        xpPerUnit: Math.max(0, resource.xpPerUnit),
        yieldPerUnit: Math.max(1, resource.yieldPerUnit),
        recipeLocked: resource.requiredRecipeItemId !== null,
        inputs: resource.requirements.map((input) => ({
          itemId: input.itemId,
          quantity: input.quantityPerUnit,
        })),
      };
    }),
    expeditionTiers: [
      ...gatheringTiers.map((tier) => ({
        id: tier.id,
        skill: "GATHERING" as const,
        label: `Gathering ${tier.label}`,
        seconds: tier.durationSeconds,
        xp: Math.max(0, tier.xpReward),
        requiredSkillLevel: Math.max(1, tier.requiredGatheringLevel),
      })),
      ...huntingTiers.map((tier) => ({
        id: tier.id,
        skill: "HUNTING" as const,
        label: `Hunting ${tier.label}`,
        seconds: tier.durationSeconds,
        xp: Math.max(0, tier.xpReward),
        requiredSkillLevel: Math.max(1, tier.requiredHuntingLevel),
      })),
    ],
    expeditionAreas: [
      ...grounds.map((ground) => ({
        skill: "HUNTING" as const,
        name: ground.name,
        requiredSkillLevel: Math.max(1, ground.requiredHuntingLevel),
        requiredCharacterLevel: Math.max(1, ground.location.requiredLevel),
      })),
      ...locations
        .filter((location) => location.gatheringEnabled)
        .map((location) => ({
          skill: "GATHERING" as const,
          name: location.name,
          requiredSkillLevel: Math.max(1, location.gatheringRequiredLevel),
          requiredCharacterLevel: Math.max(1, location.requiredLevel),
        })),
    ],
    seeds: seeds.map((seed) => ({
      itemId: seed.id,
      name: seed.name,
      xp: Math.max(0, seed.seedXp ?? 1),
      growSeconds: seed.seedGrowSeconds ?? 0,
      harvestSeconds: seed.seedHarvestSeconds ?? 0,
    })),
    gardenTiles: GARDEN_TILE_COUNT,
    dungeons: dungeons.map((dungeon) => ({
      id: dungeon.id,
      name: dungeon.name,
      locationName: dungeon.location.name,
      requiredLevel: Math.max(1, dungeon.requiredLevel, dungeon.location.requiredLevel),
      seconds: dungeon.durationSeconds,
      xp: Math.max(0, dungeon.xpReward),
      packSize: dungeon.packSize,
      monsters: dungeon.monsters
        .map((row) => toMonsterPoolEntry(row, []))
        .filter(isFightableMonster),
    })),
    quests: quests.map((quest) => ({
      id: quest.id,
      name: quest.name,
      npcName: quest.npc.name,
      requiredLevel: Math.max(1, quest.requiredLevel),
      xp: Math.max(0, quest.rewardXp),
      repeat: quest.repeat,
    })),
    locations: locations.map((location) => ({
      ...location,
      requiredLevel: Math.max(1, location.requiredLevel),
    })),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      requiredLevel: Math.max(1, item.requiredLevel ?? 1),
      itemType: item.itemType,
      equipTo: item.equipTo,
      twoHanded: item.twoHanded,
      balance: item.equipTo
        ? {
            flip: item.flipNegativeStatsWithRarity,
            stats: item.stats,
            progressions: item.statProgressions,
            overrides: item.statRarityOverrides,
          }
        : null,
    })),
    rarities: rarities.map((rarity) => ({
      rarity: rarity.rarity,
      label: rarity.displayName,
      multiplier: rarity.statMultiplier,
    })),
    statGrowth,
    vocationMaxSeconds: MAX_VOCATION_DURATION_SECONDS,
  };
}
