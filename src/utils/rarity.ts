import { prisma } from "~/lib/prisma";
import { ItemRarity } from "~/generated/prisma/enums";
import { FALLBACK_RARITY_COLORS as RARITY_COLORS } from "~/utils/rarity-colors";

/**
 * Initialize rarity configurations in database
 */
export async function initializeRarityConfigs(): Promise<void> {
  const configs = [
    {
      rarity: ItemRarity.WORTHLESS,
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
 * Get rarity colors from database as a mapping
 * This ensures colors always match what's in the database
 */
export async function getRarityColorsFromDB(): Promise<
  Record<ItemRarity, string>
> {
  const configs = await prisma.rarityConfig.findMany({
    select: { rarity: true, color: true },
  });

  const colorMap = {} as Record<ItemRarity, string>;
  configs.forEach((config) => {
    colorMap[config.rarity] = config.color;
  });

  return colorMap;
}
