import type {
  ItemEquipTo,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import type { PrismaClient } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import {
  type EnchantOverrideTemplate,
  type EnchantUnlockTemplate,
  resolveEffectiveItemStats,
} from "~/utils/itemInstanceStats";
import { loadEnchantBonuses } from "~/server/enchanting/config";

export const ITEM_BALANCE_RELATIONS = {
  stats: true,
  statEnchantUnlocks: true,
  statEnchantOverrides: true,
  toolEfficiencies: true,
} as const;

type BalanceDb = Pick<PrismaClient, "enchantLevelConfig">;

type ResolvableUserItem = {
  enchantLevel?: number;
  itemTemplate: {
    equipTo: ItemEquipTo | null;
    stats: ReadonlyArray<{
      statType: StatType;
      value: number;
      maxValue?: number | null;
    }>;
    statEnchantUnlocks: ReadonlyArray<EnchantUnlockTemplate>;
    statEnchantOverrides: ReadonlyArray<EnchantOverrideTemplate>;
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

  const enchantBonus = await loadEnchantBonuses(items, db);

  return items.map((item) => {
    const { statModifiers, ...rest } = item;
    const stats = resolveEffectiveItemStats({
      equipTo: item.itemTemplate.equipTo,
      stats: item.itemTemplate.stats,
      enchantUnlocks: item.itemTemplate.statEnchantUnlocks,
      enchantOverrides: item.itemTemplate.statEnchantOverrides,
      toolEfficiencies: item.itemTemplate.toolEfficiencies,
      instanceModifiers: statModifiers,
      enchantLevel: item.enchantLevel ?? 0,
      enchantBonusPercent: enchantBonus(item),
    });

    return { ...rest, stats } as Omit<T, "statModifiers"> & {
      stats: EffectiveStat[];
    };
  });
}
