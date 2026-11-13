import type {
  ItemEquipTo,
  ItemRarity,
  StatType,
} from "../../src/generated/prisma/enums";
import { statScalesWithEnchant } from "../../src/utils/itemInstanceStats";

/**
 * The stat multiplier each rarity had until 2026-11-13, when rarity stopped
 * changing stats (prisma/rebalance/backup-before-enchant-scaling.json). The
 * content files were authored as Common values; the live items were baked with
 * these, so the seeds bake the same way and re-seeding reproduces them.
 *
 * shortcut: frozen numbers, kept only so old content re-seeds identically. New
 * content should write its real stats and skip this.
 */
const LEGACY_RARITY_MULTIPLIER: Record<ItemRarity, number> = {
  WORTHLESS: 0.5,
  BROKEN: 0.75,
  COMMON: 1,
  UNCOMMON: 1.1,
  RARE: 1.15,
  EXQUISITE: 1.2,
  EPIC: 1.25,
  ELITE: 1.3,
  UNIQUE: 1.35,
  LEGENDARY: 1.45,
  MYTHIC: 1.6,
  DIVINE: 1.8,
};

/** One authored Common value as the old rarity scaling resolved it. */
export function legacyRarityStat(
  statType: StatType,
  value: number,
  item: { rarity: ItemRarity; equipTo: ItemEquipTo | null },
  maxValue?: number | null,
) {
  const multiplier = statScalesWithEnchant(statType, item.equipTo)
    ? LEGACY_RARITY_MULTIPLIER[item.rarity]
    : 1;
  const scaled = Math.min(value * multiplier, maxValue ?? Infinity);
  return Math.round(scaled * 1_000_000) / 1_000_000;
}

type StatRecord = Partial<Record<StatType, number>>;
type StatList = ReadonlyArray<{
  statType: StatType;
  value: number;
  maxValue?: number | null;
}>;

function bakeStats<S extends StatRecord | StatList>(
  stats: S,
  item: { rarity: ItemRarity; equipTo: ItemEquipTo | null },
): S {
  if (Array.isArray(stats)) {
    return (stats as StatList).map((stat) => ({
      ...stat,
      value: legacyRarityStat(stat.statType, stat.value, item, stat.maxValue),
    })) as unknown as S;
  }
  return Object.fromEntries(
    Object.entries(stats as StatRecord).map(([statType, value]) => [
      statType,
      legacyRarityStat(statType as StatType, value, item),
    ]),
  ) as S;
}

/**
 * The definitions with every stat baked by its item's rarity. Types are kept,
 * so `as const` literals still read as authored; the values are the baked ones.
 */
export function bakeLegacyRarity<
  T extends ReadonlyArray<{
    rarity: ItemRarity;
    equipTo?: ItemEquipTo | null;
    stats?: StatRecord | StatList;
  }>,
>(definitions: T): T {
  return definitions.map((definition) =>
    definition.stats
      ? {
          ...definition,
          stats: bakeStats(definition.stats, {
            rarity: definition.rarity,
            equipTo: definition.equipTo ?? null,
          }),
        }
      : definition,
  ) as unknown as T;
}
