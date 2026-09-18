import type {
  ItemRarity,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import type { PrismaClient } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import { resolveEffectiveItemStats } from "~/utils/itemInstanceStats";

export const ITEM_BALANCE_RELATIONS = {
  stats: true,
  statProgressions: true,
  statRarityOverrides: true,
  toolEfficiencies: true,
} as const;

type BalanceDb = Pick<PrismaClient, "rarityConfig">;

type ResolvableUserItem = {
  rarity: ItemRarity;
  itemTemplate: {
    flipNegativeStatsWithRarity: boolean;
    stats: ReadonlyArray<{
      statType: StatType;
      value: number;
      maxValue?: number | null;
    }>;
    statProgressions: ReadonlyArray<{
      statType: StatType;
      baseValue: number;
      unlocksAtRarity: ItemRarity;
    }>;
    statRarityOverrides: ReadonlyArray<{
      statType: StatType;
      rarity: ItemRarity;
      kind: "MULTIPLIER" | "ABSOLUTE";
      value: number;
    }>;
    toolEfficiencies: ReadonlyArray<{
      actionType: VocationalActionType;
      baseEfficiency: number;
    }>;
  };
  statModifiers: ReadonlyArray<{
    statType: StatType;
    value: number;
  }>;
};

export type EffectiveStat = { statType: StatType; value: number };

/**
 * Replaces persistence-derived stats with the current shared balance result.
 * Cost scales with the number of records being viewed, never with the total
 * number of copies owned by all players.
 */
export async function hydrateEffectiveItemStats<T extends ResolvableUserItem>(
  items: readonly T[],
  db: BalanceDb = prisma,
): Promise<Array<Omit<T, "statModifiers"> & { stats: EffectiveStat[] }>> {
  if (items.length === 0) return [];

  const rarities = [...new Set(items.map((item) => item.rarity))];
  const configs = await db.rarityConfig.findMany({
    where: { rarity: { in: rarities } },
    select: { rarity: true, statMultiplier: true },
  });
  const multiplierByRarity = new Map(
    configs.map((config) => [config.rarity, config.statMultiplier]),
  );

  return items.map((item) => {
    const { statModifiers, ...rest } = item;
    const stats = resolveEffectiveItemStats({
      rarity: item.rarity,
      rarityMultiplier: multiplierByRarity.get(item.rarity) ?? 1,
      flipNegativeStatsWithRarity:
        item.itemTemplate.flipNegativeStatsWithRarity,
      stats: item.itemTemplate.stats,
      statProgressions: item.itemTemplate.statProgressions,
      statRarityOverrides: item.itemTemplate.statRarityOverrides,
      toolEfficiencies: item.itemTemplate.toolEfficiencies,
      instanceModifiers: statModifiers,
    });

    return { ...rest, stats } as Omit<T, "statModifiers"> & {
      stats: EffectiveStat[];
    };
  });
}
