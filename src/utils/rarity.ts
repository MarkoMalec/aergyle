import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType } from "@prisma/client";
import { ItemWithStats } from "~/types/stats";

/**
 * Rarity multipliers - stored in database but cached here for performance
 */
const RARITY_MULTIPLIERS: Record<ItemRarity, number> = {
  WORTHLESS: 0.5,
  BROKEN: 0.75,
  COMMON: 1.0,
  UNCOMMON: 1.15,
  RARE: 1.35,
  EXQUISITE: 1.5,
  EPIC: 1.7,
  ELITE: 1.9,
  UNIQUE: 2.1,
  LEGENDARY: 2.3,
  MYTHIC: 2.7,
  DIVINE: 3.0,
};

/**
 * Rarity colors - synced with database RarityConfig.color
 * Also exported in ~/utils/rarity-colors.ts for client-side usage
 */
export const RARITY_COLORS: Record<ItemRarity, string> = {
  WORTHLESS: "#4b5563",   // Dark Gray
  BROKEN: "#92400e",      // Brown
  COMMON: "#9ca3af",      // Gray
  UNCOMMON: "#22c55e",    // Green
  RARE: "#3b82f6",        // Blue
  EXQUISITE: "#06b6d4",   // Cyan
  EPIC: "#a855f7",        // Purple
  ELITE: "#ec4899",       // Pink
  UNIQUE: "#f59e0b",      // Amber
  LEGENDARY: "#eab308",   // Gold
  MYTHIC: "#ef4444",      // Red
  DIVINE: "#f8fafc",      // White
};

/**
 * Initialize rarity configurations in database
 */
export async function initializeRarityConfigs(): Promise<void> {
  const configs = [
    {
      rarity: ItemRarity.WORTHLESS,
      statMultiplier: 0.5,
      minStats: 1,
      maxStats: 1,
      bonusStatChance: 0,
      color: RARITY_COLORS.WORTHLESS,
      displayName: "Worthless",
      sortOrder: 1,
      upgradeEnabled: true,
      nextRarity: ItemRarity.BROKEN,
      upgradeCost: 50,
    },
    {
      rarity: ItemRarity.BROKEN,
      statMultiplier: 0.75,
      minStats: 1,
      maxStats: 2,
      bonusStatChance: 0,
      color: RARITY_COLORS.BROKEN,
      displayName: "Broken",
      sortOrder: 2,
      upgradeEnabled: true,
      nextRarity: ItemRarity.COMMON,
      upgradeCost: 75,
    },
    {
      rarity: ItemRarity.COMMON,
      statMultiplier: 1.0,
      minStats: 1,
      maxStats: 2,
      bonusStatChance: 0,
      color: RARITY_COLORS.COMMON,
      displayName: "Common",
      sortOrder: 3,
      upgradeEnabled: true,
      nextRarity: ItemRarity.UNCOMMON,
      upgradeCost: 100,
    },
    {
      rarity: ItemRarity.UNCOMMON,
      statMultiplier: 1.15,
      minStats: 2,
      maxStats: 3,
      bonusStatChance: 0.1,
      color: RARITY_COLORS.UNCOMMON,
      displayName: "Uncommon",
      sortOrder: 4,
      upgradeEnabled: true,
      nextRarity: ItemRarity.RARE,
      upgradeCost: 500,
    },
    {
      rarity: ItemRarity.RARE,
      statMultiplier: 1.35,
      minStats: 2,
      maxStats: 4,
      bonusStatChance: 0.25,
      color: RARITY_COLORS.RARE,
      displayName: "Rare",
      sortOrder: 5,
      upgradeEnabled: true,
      nextRarity: ItemRarity.EXQUISITE,
      upgradeCost: 2000,
    },
    {
      rarity: ItemRarity.EXQUISITE,
      statMultiplier: 1.5,
      minStats: 3,
      maxStats: 4,
      bonusStatChance: 0.35,
      color: RARITY_COLORS.EXQUISITE,
      displayName: "Exquisite",
      sortOrder: 6,
      upgradeEnabled: true,
      nextRarity: ItemRarity.EPIC,
      upgradeCost: 5000,
    },
    {
      rarity: ItemRarity.EPIC,
      statMultiplier: 1.7,
      minStats: 3,
      maxStats: 5,
      bonusStatChance: 0.5,
      color: RARITY_COLORS.EPIC,
      displayName: "Epic",
      sortOrder: 7,
      upgradeEnabled: true,
      nextRarity: ItemRarity.ELITE,
      upgradeCost: 10000,
    },
    {
      rarity: ItemRarity.ELITE,
      statMultiplier: 1.9,
      minStats: 3,
      maxStats: 6,
      bonusStatChance: 0.65,
      color: RARITY_COLORS.ELITE,
      displayName: "Elite",
      sortOrder: 8,
      upgradeEnabled: true,
      nextRarity: ItemRarity.UNIQUE,
      upgradeCost: 25000,
    },
    {
      rarity: ItemRarity.UNIQUE,
      statMultiplier: 2.1,
      minStats: 4,
      maxStats: 7,
      bonusStatChance: 0.75,
      color: RARITY_COLORS.UNIQUE,
      displayName: "Unique",
      sortOrder: 9,
      upgradeEnabled: true,
      nextRarity: ItemRarity.LEGENDARY,
      upgradeCost: 50000,
    },
    {
      rarity: ItemRarity.LEGENDARY,
      statMultiplier: 2.3,
      minStats: 4,
      maxStats: 8,
      bonusStatChance: 0.85,
      color: RARITY_COLORS.LEGENDARY,
      displayName: "Legendary",
      sortOrder: 10,
      upgradeEnabled: true,
      nextRarity: ItemRarity.MYTHIC,
      upgradeCost: 100000,
    },
    {
      rarity: ItemRarity.MYTHIC,
      statMultiplier: 2.7,
      minStats: 5,
      maxStats: 9,
      bonusStatChance: 0.95,
      color: RARITY_COLORS.MYTHIC,
      displayName: "Mythic",
      sortOrder: 11,
      upgradeEnabled: true,
      nextRarity: ItemRarity.DIVINE,
      upgradeCost: 250000,
    },
    {
      rarity: ItemRarity.DIVINE,
      statMultiplier: 3.0,
      minStats: 6,
      maxStats: 10,
      bonusStatChance: 1.0,
      color: RARITY_COLORS.DIVINE,
      displayName: "Divine",
      sortOrder: 12,
      upgradeEnabled: false,
      nextRarity: null,
      upgradeCost: null,
    },
  ];

  for (const config of configs) {
    await prisma.rarityConfig.upsert({
      where: { rarity: config.rarity },
      create: config,
      update: config,
    });
  }
}

/**
 * Get rarity configuration
 */
export async function getRarityConfig(rarity: ItemRarity) {
  return await prisma.rarityConfig.findUnique({
    where: { rarity },
  });
}

/**
 * Get all rarity configs sorted by order
 */
export async function getAllRarityConfigs() {
  return await prisma.rarityConfig.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Get rarity colors from database as a mapping
 * This ensures colors always match what's in the database
 */
export async function getRarityColorsFromDB(): Promise<Record<ItemRarity, string>> {
  const configs = await prisma.rarityConfig.findMany({
    select: { rarity: true, color: true },
  });
  
  const colorMap = {} as Record<ItemRarity, string>;
  configs.forEach(config => {
    colorMap[config.rarity] = config.color;
  });
  
  return colorMap;
}

/**
 * Apply rarity multiplier to item stats
 * This creates new ItemStat entries with multiplied values
 */
export async function applyRarityToItemStats(
  itemId: number,
  baseStats: Array<{ statType: StatType; value: number }>,
  rarity: ItemRarity
): Promise<void> {
  const multiplier = RARITY_MULTIPLIERS[rarity];

  // Delete existing stats
  await prisma.itemStat.deleteMany({
    where: { itemId },
  });

  // Create new stats with multiplier applied
  const statsWithMultiplier = baseStats.map((stat) => ({
    itemId,
    statType: stat.statType,
    value: stat.value * multiplier,
  }));

  await prisma.itemStat.createMany({
    data: statsWithMultiplier,
  });
}

/**
 * Calculate stats for an item based on its rarity
 * Returns what the stats WOULD be without modifying database
 */
export function calculateRarityStats(
  baseStats: Array<{ statType: StatType; value: number }>,
  rarity: ItemRarity
): Array<{ statType: StatType; value: number }> {
  const multiplier = RARITY_MULTIPLIERS[rarity];

  return baseStats.map((stat) => ({
    statType: stat.statType,
    value: Math.round(stat.value * multiplier * 100) / 100, // Round to 2 decimals
  }));
}

/**
 * Upgrade item to next rarity tier
 */
export async function upgradeItemRarity(
  itemId: number,
  userId: string
): Promise<{
  success: boolean;
  newRarity?: ItemRarity;
  newStats?: Array<{ statType: StatType; value: number }>;
  error?: string;
}> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { stats: true },
  });

  if (!item) {
    return { success: false, error: "Item not found" };
  }

  const currentConfig = await getRarityConfig(item.rarity);

  if (!currentConfig) {
    return { success: false, error: "Rarity configuration not found" };
  }

  if (!currentConfig.upgradeEnabled || !currentConfig.nextRarity) {
    return { success: false, error: "Item cannot be upgraded further" };
  }

  // TODO: Check if user has enough currency/materials

  // Get base stats (divide by current multiplier to get base)
  const currentMultiplier = RARITY_MULTIPLIERS[item.rarity];
  const baseStats = item.stats.map((stat) => ({
    statType: stat.statType,
    value: stat.value / currentMultiplier,
  }));

  // Apply new rarity
  const newRarity = currentConfig.nextRarity;
  await prisma.item.update({
    where: { id: itemId },
    data: { rarity: newRarity },
  });

  await applyRarityToItemStats(itemId, baseStats, newRarity);

  // Fetch updated stats
  const updatedStats = await prisma.itemStat.findMany({
    where: { itemId },
  });

  return {
    success: true,
    newRarity,
    newStats: updatedStats,
  };
}

/**
 * Get rarity multiplier
 */
export function getRarityMultiplier(rarity: ItemRarity): number {
  return RARITY_MULTIPLIERS[rarity];
}

/**
 * Compare two rarities
 */
export function compareRarity(rarity1: ItemRarity, rarity2: ItemRarity): number {
  const order = [
    ItemRarity.WORTHLESS,
    ItemRarity.BROKEN,
    ItemRarity.COMMON,
    ItemRarity.UNCOMMON,
    ItemRarity.RARE,
    ItemRarity.EXQUISITE,
    ItemRarity.EPIC,
    ItemRarity.ELITE,
    ItemRarity.UNIQUE,
    ItemRarity.LEGENDARY,
    ItemRarity.MYTHIC,
    ItemRarity.DIVINE,
  ];

  return order.indexOf(rarity1) - order.indexOf(rarity2);
}

/**
 * Recalculate item stats based on current rarity in database
 * Use this when rarity was changed manually without going through upgrade system
 */
export async function recalculateItemStats(itemId: number): Promise<{
  success: boolean;
  message: string;
  stats?: Array<{ statType: StatType; value: number }>;
}> {
  // Get item with current stats
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      stats: true,
    },
  });

  if (!item) {
    return { success: false, message: "Item not found" };
  }

  if (!item.stats || item.stats.length === 0) {
    return { success: false, message: "Item has no stats to recalculate" };
  }

  // Calculate what the base stats should be (assuming current stats are at some multiplier)
  // We need to determine the original base values
  // For simplicity, we'll assume the current stats are at COMMON (1.0x) multiplier
  // and recalculate to the target rarity
  
  const currentMultiplier = RARITY_MULTIPLIERS[item.rarity];
  
  // Delete existing stats
  await prisma.itemStat.deleteMany({
    where: { itemId },
  });

  // Recreate stats with correct multiplier
  const baseStats = item.stats.map((stat) => ({
    statType: stat.statType,
    value: stat.value, // Assuming these are base values
  }));

  await applyRarityToItemStats(itemId, baseStats, item.rarity);

  // Get updated stats
  const updatedStats = await prisma.itemStat.findMany({
    where: { itemId },
  });

  return {
    success: true,
    message: `Recalculated stats for ${item.rarity} rarity`,
    stats: updatedStats.map((s) => ({
      statType: s.statType,
      value: s.value,
    })),
  };
}

/**
 * Sync item stats to match its current rarity
 * This assumes you have base stats stored somewhere or can derive them
 */
export async function syncItemStatsToRarity(
  itemId: number,
  baseStats: Array<{ statType: StatType; value: number }>
): Promise<void> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  // Delete existing stats
  await prisma.itemStat.deleteMany({
    where: { itemId },
  });

  // Apply current rarity to base stats
  await applyRarityToItemStats(itemId, baseStats, item.rarity);
}

/**
 * Generate random item with rarity-appropriate stats
 */
export async function generateItemWithRarity(
  baseItemData: {
    name: string;
    price: number;
    sprite: string;
    equipTo: string | null;
    requiredLevel: number;
  },
  rarity: ItemRarity,
  baseStats: Array<{ statType: StatType; value: number }>
): Promise<number> {
  // Create item
  const item = await prisma.item.create({
    data: {
      ...baseItemData,
      rarity,
      minPhysicalDamage: 0,
      maxPhysicalDamage: 0,
      minMagicDamage: 0,
      maxMagicDamage: 0,
      armor: 0,
    },
  });

  // Apply rarity to stats
  await applyRarityToItemStats(item.id, baseStats, rarity);

  return item.id;
}
