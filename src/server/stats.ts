import "server-only";

import { ItemStatus, StatType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import type { ComputedStats } from "~/types/stats";
import {
  aggregateStatValues,
  calculateFinalStatsFromTotals,
  calculateLevelBaseStats,
  combineStatRecords,
  getDefaultStatGrowthRules,
  LEVEL_SCALED_STAT_TYPES,
  weaponAttackSpeedAdjustment,
  type StatGrowthRule,
} from "~/utils/stats";
import { getActiveFoodEffect } from "~/server/food-effects";
import { getEquippedUserItemIds } from "~/utils/itemEquipTo";
import {
  hydrateEffectiveItemStats,
  ITEM_BALANCE_RELATIONS,
} from "~/server/items/effectiveStats";

export type CharacterStatSnapshot = {
  baseStats: Record<StatType, number>;
  equipmentBonuses: Record<StatType, number>;
  temporaryBonuses: Record<StatType, number>;
  totals: Record<StatType, number>;
  finalStats: ComputedStats;
  equippedUserItemIds: number[];
  activeEffect: Awaited<ReturnType<typeof getActiveFoodEffect>>;
};

export const USABLE_EQUIPMENT_ITEM_STATUSES = [
  ItemStatus.IN_INVENTORY,
  ItemStatus.EQUIPPED,
];

/** Admin level-growth rules; stats without a saved rule use the defaults. */
export async function getStatGrowthRules(): Promise<
  Record<StatType, StatGrowthRule>
> {
  const rows = await prisma.characterStatGrowth.findMany();
  const rules = getDefaultStatGrowthRules();
  for (const row of rows) {
    if (!LEVEL_SCALED_STAT_TYPES.includes(row.statType)) continue;
    rules[row.statType] = {
      baseValue: row.baseValue,
      perLevel: row.perLevel,
      maxBonus: row.maxBonus,
    };
  }
  return rules;
}

/**
 * Level-scaled base stats plus the character's own additions. Resolved on
 * every read, so level-ups and growth edits apply without rewriting rows.
 */
export async function getCharacterBaseStats(
  userId: string,
): Promise<Record<StatType, number>> {
  return (await loadCharacterBase(userId)).baseStats;
}

async function loadCharacterBase(userId: string) {
  const [user, rules] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        level: true,
        baseStats: { select: { statType: true, value: true } },
      },
    }),
    getStatGrowthRules(),
  ]);

  return {
    rules,
    baseStats: combineStatRecords(
      calculateLevelBaseStats(user?.level ?? 1, rules),
      aggregateStatValues(user?.baseStats ?? []),
    ),
  };
}

/**
 * Server-authoritative character stats for gameplay systems.
 *
 * Equipment slot references decide which instances are equipped. Both current
 * IN_INVENTORY rows and legacy EQUIPPED rows are usable; LISTED/SOLD/DELETED
 * instances never contribute even if a stale slot reference remains.
 */
export async function getCharacterStatSnapshot(
  userId: string,
): Promise<CharacterStatSnapshot> {
  const [{ baseStats, rules }, equipment, activeEffect] = await Promise.all([
    loadCharacterBase(userId),
    prisma.equipment.findUnique({ where: { userId } }),
    getActiveFoodEffect(userId),
  ]);

  const referencedUserItemIds = getEquippedUserItemIds(equipment);
  const equippedItems =
    referencedUserItemIds.length > 0
      ? await prisma.userItem.findMany({
          where: {
            id: { in: referencedUserItemIds },
            userId,
            status: {
              in: USABLE_EQUIPMENT_ITEM_STATUSES,
            },
          },
          include: {
            itemTemplate: { include: ITEM_BALANCE_RELATIONS },
            statModifiers: {
              select: { statType: true, value: true },
            },
          },
        })
      : [];

  const effectiveEquippedItems = await hydrateEffectiveItemStats(equippedItems);

  const equipmentBonuses = aggregateStatValues(
    effectiveEquippedItems.flatMap((item) => item.stats),
  );
  const offhand = effectiveEquippedItems.find(
    (item) => item.id === equipment?.offhandItemId,
  );
  equipmentBonuses[StatType.ATTACK_SPEED] += weaponAttackSpeedAdjustment(
    effectiveEquippedItems.find((item) => item.id === equipment?.weaponItemId)
      ?.stats,
    rules[StatType.ATTACK_SPEED].baseValue,
    offhand && {
      equipTo: offhand.itemTemplate.equipTo,
      stats: offhand.stats,
    },
  );
  const temporaryBonuses = aggregateStatValues(
    activeEffect?.item.foodEffectStats ?? [],
  );
  const totals = combineStatRecords(
    baseStats,
    equipmentBonuses,
    temporaryBonuses,
  );

  return {
    baseStats,
    equipmentBonuses,
    temporaryBonuses,
    totals,
    finalStats: calculateFinalStatsFromTotals(totals),
    equippedUserItemIds: effectiveEquippedItems.map((item) => item.id),
    activeEffect,
  };
}

export async function getCompleteCharacterStats(
  userId: string,
): Promise<ComputedStats> {
  return (await getCharacterStatSnapshot(userId)).finalStats;
}
