import { StatType } from "~/generated/prisma/enums";
import { STAT_METADATA, StatCategory } from "~/types/stats";
import type { ComputedStats, StatDisplay } from "~/types/stats";
import type { EquipmentSlotsWithItems } from "~/types/inventory";

export type StatValue = {
  statType: StatType;
  value: number;
};

export function getZeroStatRecord(): Record<StatType, number> {
  return Object.fromEntries(
    Object.values(StatType).map((statType) => [statType, 0]),
  ) as Record<StatType, number>;
}

/** Aggregate one source of stats without applying gameplay-specific caps. */
export function aggregateStatValues(
  stats: ReadonlyArray<StatValue>,
): Record<StatType, number> {
  const totals = getZeroStatRecord();
  for (const stat of stats) {
    if (Number.isFinite(stat.value)) totals[stat.statType] += stat.value;
  }
  return totals;
}

/** Combine base, equipment and temporary sources exactly once per source. */
export function combineStatRecords(
  ...sources: ReadonlyArray<Partial<Record<StatType, number>>>
): Record<StatType, number> {
  const totals = getZeroStatRecord();
  for (const source of sources) {
    for (const statType of Object.values(StatType)) {
      const value = source[statType];
      if (typeof value === "number" && Number.isFinite(value)) {
        totals[statType] += value;
      }
    }
  }
  return totals;
}

/** Level 1 base stats used when an admin has not saved a growth rule. */
export function getDefaultBaseStats(): Record<StatType, number> {
  return {
    // Offensive
    PHYSICAL_DAMAGE_MIN: 1,
    PHYSICAL_DAMAGE_MAX: 5,
    MAGIC_DAMAGE_MIN: 0,
    MAGIC_DAMAGE_MAX: 0,
    CRITICAL_CHANCE: 5,
    CRITICAL_DAMAGE: 150,
    ATTACK_SPEED: 1.0,
    ACCURACY: 10,

    // Defensive
    ARMOR: 0,
    MAGIC_RESIST: 0,
    EVASION_MELEE: 5,
    EVASION_RANGED: 5,
    EVASION_MAGIC: 5,
    BLOCK_CHANCE: 0,

    // Resistances
    FIRE_RESIST: 0,
    COLD_RESIST: 0,
    LIGHTNING_RESIST: 0,
    POISON_RESIST: 0,

    // Character
    HEALTH: 100,
    MANA: 50,
    HEALTH_REGEN: 1,
    MANA_REGEN: 1,

    // Special
    PRAYER_POINTS: 10,
    MOVEMENT_SPEED: 100,
    LUCK: 0,
    GOLD_FIND: 0,
    EXPERIENCE_GAIN: 100,
    LIFESTEAL: 0,
    THORNS: 0,
    CARRYING_CAPACITY: 0,

    // Vocation/tool
    WOODCUTTING_EFFICIENCY: 0,
    MINING_EFFICIENCY: 0,
    FISHING_EFFICIENCY: 0,
    GATHERING_EFFICIENCY: 0,
    HUNTING_EFFICIENCY: 0,
  };
}

/** How one character base stat grows with level. */
export type StatGrowthRule = {
  /** Value at level 1. */
  baseValue: number;
  /** Added for every level above 1. */
  perLevel: number;
  /** Ceiling on the total level bonus; null means no ceiling. */
  maxBonus: number | null;
};

/**
 * Stats an admin can scale with level. Carrying capacity is excluded because
 * it is materialized into Inventory.maxSlots only when equipment changes.
 */
export const LEVEL_SCALED_STAT_TYPES = Object.values(StatType).filter(
  (statType) => statType !== StatType.CARRYING_CAPACITY,
);

// Flat gains: every level adds the same amount, so each level is a shrinking
// share of the total and neighbouring levels stay close (level 50 is 3–4% above
// level 48). Chance-based stats are capped so gear stays their main source.
// Economy and vocation stats do not grow; unlisted stats never grow.
const DEFAULT_LEVEL_GROWTH: Partial<
  Record<StatType, Pick<StatGrowthRule, "perLevel" | "maxBonus">>
> = {
  PHYSICAL_DAMAGE_MIN: { perLevel: 0.2, maxBonus: null },
  PHYSICAL_DAMAGE_MAX: { perLevel: 0.3, maxBonus: null },
  CRITICAL_CHANCE: { perLevel: 0.1, maxBonus: 10 },
  CRITICAL_DAMAGE: { perLevel: 0.5, maxBonus: 50 },
  ATTACK_SPEED: { perLevel: 0.004, maxBonus: 0.4 },
  ACCURACY: { perLevel: 0.2, maxBonus: 20 },
  ARMOR: { perLevel: 0.5, maxBonus: null },
  MAGIC_RESIST: { perLevel: 0.3, maxBonus: null },
  EVASION_MELEE: { perLevel: 0.1, maxBonus: 10 },
  EVASION_RANGED: { perLevel: 0.1, maxBonus: 10 },
  EVASION_MAGIC: { perLevel: 0.1, maxBonus: 10 },
  FIRE_RESIST: { perLevel: 0.1, maxBonus: 10 },
  COLD_RESIST: { perLevel: 0.1, maxBonus: 10 },
  LIGHTNING_RESIST: { perLevel: 0.1, maxBonus: 10 },
  POISON_RESIST: { perLevel: 0.1, maxBonus: 10 },
  HEALTH: { perLevel: 5, maxBonus: null },
  // Same ratio as Health, so a full heal takes equally long at every level.
  HEALTH_REGEN: { perLevel: 0.05, maxBonus: null },
  MANA: { perLevel: 2, maxBonus: null },
  MANA_REGEN: { perLevel: 0.02, maxBonus: null },
};

export function getDefaultStatGrowthRules(): Record<StatType, StatGrowthRule> {
  const base = getDefaultBaseStats();
  return Object.fromEntries(
    Object.values(StatType).map((statType) => [
      statType,
      {
        baseValue: base[statType],
        perLevel: 0,
        maxBonus: null,
        ...DEFAULT_LEVEL_GROWTH[statType],
      },
    ]),
  ) as Record<StatType, StatGrowthRule>;
}

export function getLevelStatBonus(rule: StatGrowthRule, level: number) {
  const bonus = rule.perLevel * Math.max(0, Math.floor(level) - 1);
  return rule.maxBonus === null ? bonus : Math.min(bonus, rule.maxBonus);
}

/** Character base stats at a level, before equipment and effects. */
export function calculateLevelBaseStats(
  level: number,
  rules: Readonly<Record<StatType, StatGrowthRule>>,
): Record<StatType, number> {
  const stats = getZeroStatRecord();
  for (const statType of Object.values(StatType)) {
    const rule = rules[statType];
    stats[statType] = rule.baseValue + getLevelStatBonus(rule, level);
  }
  return stats;
}

/**
 * A weapon's Attack Speed is how fast that weapon strikes, so it takes the
 * place of the unarmed speed (the level 1 base value) instead of adding to
 * it. The main hand sets the pace: a weapon in the off hand adds its damage
 * but not its own speed. Returns what to add to equipment bonuses; level
 * growth, other gear (shields included) and food still add on top.
 */
export function weaponAttackSpeedAdjustment(
  weaponStats: ReadonlyArray<StatValue> | undefined,
  unarmedAttackSpeed: number,
  offhand?: {
    equipTo: string | null;
    stats?: ReadonlyArray<StatValue>;
  } | null,
): number {
  const speedOf = (stats: ReadonlyArray<StatValue> | undefined) =>
    stats?.find((stat) => stat.statType === StatType.ATTACK_SPEED)?.value ??
    0;
  const offhandWeaponSpeed =
    offhand?.equipTo === "weapon" ? speedOf(offhand.stats) : 0;
  return (
    (speedOf(weaponStats) > 0 ? -unarmedAttackSpeed : 0) - offhandWeaponSpeed
  );
}

/**
 * Calculate equipment bonuses from equipped items
 */
export function calculateEquipmentBonuses(
  equipment: EquipmentSlotsWithItems,
  unarmedAttackSpeed: number,
): Record<StatType, number> {
  const seenUserItemIds = new Set<number>();
  const stats: StatValue[] = [];

  for (const value of Object.values(equipment)) {
    if (!value || !("stats" in value)) continue;
    const item = value;
    if (seenUserItemIds.has(item.id)) continue;
    seenUserItemIds.add(item.id);
    stats.push(...(item.stats ?? []));
  }

  const totals = aggregateStatValues(stats);
  totals[StatType.ATTACK_SPEED] += weaponAttackSpeedAdjustment(
    equipment.weapon?.stats,
    unarmedAttackSpeed,
    equipment.offhand,
  );
  return totals;
}

/**
 * Calculate final character stats (base + equipment + future: skills)
 */
export function calculateFinalStats(
  baseStats: Record<StatType, number>,
  equipmentBonuses: Record<StatType, number>,
  temporaryBonuses: Partial<Record<StatType, number>> = {},
): ComputedStats {
  const totals = combineStatRecords(
    baseStats,
    equipmentBonuses,
    temporaryBonuses,
  );
  return calculateFinalStatsFromTotals(totals);
}

/** Apply character-wide caps and minimums to already combined stat totals. */
export function calculateFinalStatsFromTotals(
  totals: Readonly<Record<StatType, number>>,
): ComputedStats {
  const getStat = (statType: StatType): number => totals[statType];

  return {
    // Offensive
    minPhysicalDamage: Math.max(0, getStat(StatType.PHYSICAL_DAMAGE_MIN)),
    maxPhysicalDamage: Math.max(0, getStat(StatType.PHYSICAL_DAMAGE_MAX)),
    minMagicDamage: Math.max(0, getStat(StatType.MAGIC_DAMAGE_MIN)),
    maxMagicDamage: Math.max(0, getStat(StatType.MAGIC_DAMAGE_MAX)),
    criticalChance: Math.min(
      100,
      Math.max(0, getStat(StatType.CRITICAL_CHANCE)),
    ),
    criticalDamage: Math.max(0, getStat(StatType.CRITICAL_DAMAGE)),
    attackSpeed: Math.max(0.1, getStat(StatType.ATTACK_SPEED)),
    accuracy: Math.max(0, getStat(StatType.ACCURACY)),

    // Defensive
    armor: Math.max(0, getStat(StatType.ARMOR)),
    magicResist: Math.max(0, getStat(StatType.MAGIC_RESIST)),
    evasionMelee: Math.min(75, Math.max(0, getStat(StatType.EVASION_MELEE))),
    evasionRanged: Math.min(75, Math.max(0, getStat(StatType.EVASION_RANGED))),
    evasionMagic: Math.min(75, Math.max(0, getStat(StatType.EVASION_MAGIC))),
    blockChance: Math.min(75, Math.max(0, getStat(StatType.BLOCK_CHANCE))),

    // Resistances (capped at 75%)
    fireResist: Math.min(75, Math.max(-100, getStat(StatType.FIRE_RESIST))),
    coldResist: Math.min(75, Math.max(-100, getStat(StatType.COLD_RESIST))),
    lightningResist: Math.min(
      75,
      Math.max(-100, getStat(StatType.LIGHTNING_RESIST)),
    ),
    poisonResist: Math.min(75, Math.max(-100, getStat(StatType.POISON_RESIST))),

    // Character
    health: Math.max(1, getStat(StatType.HEALTH)),
    mana: Math.max(0, getStat(StatType.MANA)),
    healthRegen: Math.max(0, getStat(StatType.HEALTH_REGEN)),
    manaRegen: Math.max(0, getStat(StatType.MANA_REGEN)),

    // Special
    prayerPoints: Math.max(0, getStat(StatType.PRAYER_POINTS)),
    movementSpeed: Math.max(0, getStat(StatType.MOVEMENT_SPEED)),
    luck: getStat(StatType.LUCK),
    goldFind: getStat(StatType.GOLD_FIND),
    experienceGain: Math.max(0, getStat(StatType.EXPERIENCE_GAIN)),
    lifesteal: Math.min(100, Math.max(0, getStat(StatType.LIFESTEAL))),
    thorns: Math.max(0, getStat(StatType.THORNS)),
    carryingCapacity: Math.max(0, getStat(StatType.CARRYING_CAPACITY)),

    woodcuttingEfficiency: Math.max(
      0,
      getStat(StatType.WOODCUTTING_EFFICIENCY),
    ),
    miningEfficiency: Math.max(0, getStat(StatType.MINING_EFFICIENCY)),
    fishingEfficiency: Math.max(0, getStat(StatType.FISHING_EFFICIENCY)),
    gatheringEfficiency: Math.max(0, getStat(StatType.GATHERING_EFFICIENCY)),
    huntingEfficiency: Math.max(0, getStat(StatType.HUNTING_EFFICIENCY)),
  };
}

/**
 * One exhaustive bridge between database stat identifiers and the computed
 * names used by the UI. The Record type makes a missing computed stat a build
 * error instead of silently hiding it.
 */
export const COMPUTED_STAT_TYPE_MAP: Record<keyof ComputedStats, StatType> = {
  minPhysicalDamage: StatType.PHYSICAL_DAMAGE_MIN,
  maxPhysicalDamage: StatType.PHYSICAL_DAMAGE_MAX,
  minMagicDamage: StatType.MAGIC_DAMAGE_MIN,
  maxMagicDamage: StatType.MAGIC_DAMAGE_MAX,
  criticalChance: StatType.CRITICAL_CHANCE,
  criticalDamage: StatType.CRITICAL_DAMAGE,
  attackSpeed: StatType.ATTACK_SPEED,
  accuracy: StatType.ACCURACY,
  armor: StatType.ARMOR,
  magicResist: StatType.MAGIC_RESIST,
  evasionMelee: StatType.EVASION_MELEE,
  evasionRanged: StatType.EVASION_RANGED,
  evasionMagic: StatType.EVASION_MAGIC,
  blockChance: StatType.BLOCK_CHANCE,
  fireResist: StatType.FIRE_RESIST,
  coldResist: StatType.COLD_RESIST,
  lightningResist: StatType.LIGHTNING_RESIST,
  poisonResist: StatType.POISON_RESIST,
  health: StatType.HEALTH,
  mana: StatType.MANA,
  healthRegen: StatType.HEALTH_REGEN,
  manaRegen: StatType.MANA_REGEN,
  prayerPoints: StatType.PRAYER_POINTS,
  movementSpeed: StatType.MOVEMENT_SPEED,
  luck: StatType.LUCK,
  goldFind: StatType.GOLD_FIND,
  experienceGain: StatType.EXPERIENCE_GAIN,
  lifesteal: StatType.LIFESTEAL,
  thorns: StatType.THORNS,
  carryingCapacity: StatType.CARRYING_CAPACITY,
  woodcuttingEfficiency: StatType.WOODCUTTING_EFFICIENCY,
  miningEfficiency: StatType.MINING_EFFICIENCY,
  fishingEfficiency: StatType.FISHING_EFFICIENCY,
  gatheringEfficiency: StatType.GATHERING_EFFICIENCY,
  huntingEfficiency: StatType.HUNTING_EFFICIENCY,
};

/**
 * Format stat value for display
 */
export function formatStatValue(value: number, statType: StatType): string {
  const metadata = STAT_METADATA[statType];

  switch (metadata.formatType) {
    case "percentage":
      return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
    case "decimal":
      return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
    case "range":
      return value.toString();
    case "number":
    default:
      return `${value > 0 ? "+" : ""}${Math.floor(value)}`;
  }
}

/**
 * Format item stats for display (combines min/max damage into ranges)
 */
export function formatItemStatsForDisplay(
  stats: Array<{ statType: StatType; value: number }>,
): StatDisplay[] {
  const formatTwoDecimals = (n: number): string => {
    if (!Number.isFinite(n)) return "0.00";
    // Prevent artifacts like 8.100000000000001
    const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
    return rounded.toFixed(2);
  };

  const statMap = new Map<StatType, number>();
  stats.forEach((stat) => statMap.set(stat.statType, stat.value));

  const displays: StatDisplay[] = [];
  const processedStats = new Set<StatType>();

  // Handle damage ranges specially
  if (
    statMap.has(StatType.PHYSICAL_DAMAGE_MIN) ||
    statMap.has(StatType.PHYSICAL_DAMAGE_MAX)
  ) {
    const min = statMap.get(StatType.PHYSICAL_DAMAGE_MIN) ?? 0;
    const max = statMap.get(StatType.PHYSICAL_DAMAGE_MAX) ?? 0;
    if (min > 0 || max > 0) {
      displays.push({
        statType: StatType.PHYSICAL_DAMAGE_MIN,
        label: "Physical Damage",
        value: `${formatTwoDecimals(min)}-${formatTwoDecimals(max)}`,
        rawValue: min,
        color: STAT_METADATA[StatType.PHYSICAL_DAMAGE_MIN].color,
        icon: STAT_METADATA[StatType.PHYSICAL_DAMAGE_MIN].icon,
        category: StatCategory.OFFENSIVE,
        priority: STAT_METADATA[StatType.PHYSICAL_DAMAGE_MIN].priority,
      });
    }
    processedStats.add(StatType.PHYSICAL_DAMAGE_MIN);
    processedStats.add(StatType.PHYSICAL_DAMAGE_MAX);
  }

  if (
    statMap.has(StatType.MAGIC_DAMAGE_MIN) ||
    statMap.has(StatType.MAGIC_DAMAGE_MAX)
  ) {
    const min = statMap.get(StatType.MAGIC_DAMAGE_MIN) ?? 0;
    const max = statMap.get(StatType.MAGIC_DAMAGE_MAX) ?? 0;
    if (min > 0 || max > 0) {
      displays.push({
        statType: StatType.MAGIC_DAMAGE_MIN,
        label: "Magic Damage",
        value: `${formatTwoDecimals(min)}-${formatTwoDecimals(max)}`,
        rawValue: min,
        color: STAT_METADATA[StatType.MAGIC_DAMAGE_MIN].color,
        icon: STAT_METADATA[StatType.MAGIC_DAMAGE_MIN].icon,
        category: StatCategory.OFFENSIVE,
        priority: STAT_METADATA[StatType.MAGIC_DAMAGE_MIN].priority,
      });
    }
    processedStats.add(StatType.MAGIC_DAMAGE_MIN);
    processedStats.add(StatType.MAGIC_DAMAGE_MAX);
  }

  // Handle all other stats
  stats.forEach((stat) => {
    if (processedStats.has(stat.statType)) return;
    if (stat.value === 0) return; // Don't show zero stats

    const metadata = STAT_METADATA[stat.statType];
    displays.push({
      statType: stat.statType,
      label: metadata.label,
      value: formatStatValue(stat.value, stat.statType),
      rawValue: stat.value,
      color: metadata.color,
      icon: metadata.icon,
      category: metadata.category,
      priority: metadata.priority,
    });
  });

  // Sort by priority
  return displays.sort((a, b) => a.priority - b.priority);
}
