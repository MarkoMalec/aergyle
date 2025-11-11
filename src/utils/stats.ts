import { StatType } from "@prisma/client";
import { prisma } from "~/lib/prisma";
import {
  ComputedStats,
  ItemWithStats,
  StatDisplay,
  STAT_METADATA,
  StatCategory,
} from "~/types/stats";
import { EquipmentSlotsWithItems } from "~/types/inventory";

/**
 * Get default base stats for a new character
 */
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
  };
}

/**
 * Calculate equipment bonuses from equipped items
 */
export function calculateEquipmentBonuses(
  equipment: EquipmentSlotsWithItems
): Record<StatType, number> {
  const bonuses: Record<StatType, number> = {} as Record<StatType, number>;

  // Initialize all stats to 0
  Object.values(StatType).forEach((statType) => {
    bonuses[statType as StatType] = 0;
  });

  // Aggregate stats from all equipped items
  Object.values(equipment).forEach((item) => {
    if (item && "stats" in item) {
      const itemWithStats = item as unknown as ItemWithStats;
      itemWithStats.stats?.forEach((stat) => {
        bonuses[stat.statType] += stat.value;
      });
    }
  });

  return bonuses;
}

/**
 * Get character base stats from database
 */
export async function getCharacterBaseStats(
  userId: string
): Promise<Record<StatType, number>> {
  const baseStats = await prisma.characterBaseStat.findMany({
    where: { userId },
  });

  const stats: Record<StatType, number> = getDefaultBaseStats();

  // Override defaults with saved values
  baseStats.forEach((stat) => {
    stats[stat.statType] = stat.value;
  });

  return stats;
}

/**
 * Initialize base stats for a new character
 */
export async function initializeCharacterStats(
  userId: string
): Promise<void> {
  const defaultStats = getDefaultBaseStats();

  await prisma.characterBaseStat.createMany({
    data: Object.entries(defaultStats).map(([statType, value]) => ({
      userId,
      statType: statType as StatType,
      value,
    })),
    skipDuplicates: true,
  });
}

/**
 * Calculate final character stats (base + equipment + future: skills)
 */
export function calculateFinalStats(
  baseStats: Record<StatType, number>,
  equipmentBonuses: Record<StatType, number>
): ComputedStats {
  const getStat = (statType: StatType): number => {
    return (baseStats[statType] || 0) + (equipmentBonuses[statType] || 0);
  };

  return {
    // Offensive
    minPhysicalDamage: Math.max(0, getStat(StatType.PHYSICAL_DAMAGE_MIN)),
    maxPhysicalDamage: Math.max(0, getStat(StatType.PHYSICAL_DAMAGE_MAX)),
    minMagicDamage: Math.max(0, getStat(StatType.MAGIC_DAMAGE_MIN)),
    maxMagicDamage: Math.max(0, getStat(StatType.MAGIC_DAMAGE_MAX)),
    criticalChance: Math.min(100, Math.max(0, getStat(StatType.CRITICAL_CHANCE))),
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
    lightningResist: Math.min(75, Math.max(-100, getStat(StatType.LIGHTNING_RESIST))),
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
  };
}

/**
 * Get complete character stats including equipment
 */
export async function getCompleteCharacterStats(
  userId: string,
  equipment: EquipmentSlotsWithItems
): Promise<ComputedStats> {
  const baseStats = await getCharacterBaseStats(userId);
  const equipmentBonuses = calculateEquipmentBonuses(equipment);
  return calculateFinalStats(baseStats, equipmentBonuses);
}

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
  stats: Array<{ statType: StatType; value: number }>
): StatDisplay[] {
  const statMap = new Map<StatType, number>();
  stats.forEach((stat) => statMap.set(stat.statType, stat.value));

  const displays: StatDisplay[] = [];
  const processedStats = new Set<StatType>();

  // Handle damage ranges specially
  if (
    statMap.has(StatType.PHYSICAL_DAMAGE_MIN) ||
    statMap.has(StatType.PHYSICAL_DAMAGE_MAX)
  ) {
    const min = statMap.get(StatType.PHYSICAL_DAMAGE_MIN) || 0;
    const max = statMap.get(StatType.PHYSICAL_DAMAGE_MAX) || 0;
    if (min > 0 || max > 0) {
      displays.push({
        statType: StatType.PHYSICAL_DAMAGE_MIN,
        label: "Physical Damage",
        value: `${min}-${max}`,
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
    const min = statMap.get(StatType.MAGIC_DAMAGE_MIN) || 0;
    const max = statMap.get(StatType.MAGIC_DAMAGE_MAX) || 0;
    if (min > 0 || max > 0) {
      displays.push({
        statType: StatType.MAGIC_DAMAGE_MIN,
        label: "Magic Damage",
        value: `${min}-${max}`,
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

/**
 * Sync denormalized stat columns on Item when stats change
 */
export async function syncItemDenormalizedStats(itemId: number): Promise<void> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { stats: true },
  });

  if (!item) return;

  const getStat = (statType: StatType): number | null => {
    const stat = item.stats.find((s) => s.statType === statType);
    return stat ? stat.value : null;
  };

  await prisma.item.update({
    where: { id: itemId },
    data: {
      minPhysicalDamage: getStat(StatType.PHYSICAL_DAMAGE_MIN),
      maxPhysicalDamage: getStat(StatType.PHYSICAL_DAMAGE_MAX),
      minMagicDamage: getStat(StatType.MAGIC_DAMAGE_MIN),
      maxMagicDamage: getStat(StatType.MAGIC_DAMAGE_MAX),
      armor: getStat(StatType.ARMOR),
    },
  });
}
