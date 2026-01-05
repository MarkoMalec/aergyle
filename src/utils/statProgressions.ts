import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType } from "~/generated/prisma/enums";

/**
 * Stat Progression Management
 * Define which stats unlock at which rarity for each item
 */

/**
 * Add stat progression to an item template
 */
export async function addStatProgression(
  itemId: number,
  statType: StatType,
  baseValue: number,
  unlocksAtRarity: ItemRarity
) {
  return await prisma.itemStatProgression.create({
    data: {
      itemId,
      statType,
      baseValue,
      unlocksAtRarity,
    },
  });
}

/**
 * Get all stat progressions for an item
 */
export async function getItemStatProgressions(itemId: number) {
  return await prisma.itemStatProgression.findMany({
    where: { itemId },
    orderBy: [
      { unlocksAtRarity: "asc" },
      { statType: "asc" },
    ],
  });
}

/**
 * Update stat progression
 */
export async function updateStatProgression(
  progressionId: number,
  data: {
    baseValue?: number;
    unlocksAtRarity?: ItemRarity;
  }
) {
  return await prisma.itemStatProgression.update({
    where: { id: progressionId },
    data,
  });
}

/**
 * Delete stat progression
 */
export async function deleteStatProgression(progressionId: number) {
  return await prisma.itemStatProgression.delete({
    where: { id: progressionId },
  });
}

/**
 * Set complete stat progression for an item
 * Replaces all existing progressions
 */
export async function setItemStatProgressions(
  itemId: number,
  progressions: Array<{
    statType: StatType;
    baseValue: number;
    unlocksAtRarity: ItemRarity;
  }>
) {
  // Delete existing progressions
  await prisma.itemStatProgression.deleteMany({
    where: { itemId },
  });

  // Create new progressions
  await prisma.itemStatProgression.createMany({
    data: progressions.map((prog) => ({
      itemId,
      ...prog,
    })),
  });

  return await getItemStatProgressions(itemId);
}

/**
 * Get stats that would be active at a specific rarity
 */
export function getStatsForRarity(
  progressions: Array<{
    statType: StatType;
    baseValue: number;
    unlocksAtRarity: ItemRarity;
  }>,
  rarity: ItemRarity,
  multiplier: number
): Array<{ statType: StatType; value: number }> {
  const rarityOrder = [
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

  const currentRarityIndex = rarityOrder.indexOf(rarity);

  return progressions
    .filter((prog) => {
      const unlockIndex = rarityOrder.indexOf(prog.unlocksAtRarity);
      return unlockIndex <= currentRarityIndex;
    })
    .map((prog) => ({
      statType: prog.statType,
      value: prog.baseValue * multiplier,
    }));
}

/**
 * Example: Set up stat progressions for a weapon
 * 
 * Usage:
 * await setItemStatProgressions(19, [ // Wooden Sword
 *   { statType: StatType.CRITICAL_CHANCE, baseValue: 5, unlocksAtRarity: ItemRarity.COMMON },
 *   { statType: StatType.ATTACK_SPEED, baseValue: 0.1, unlocksAtRarity: ItemRarity.MYTHIC },
 *   { statType: StatType.LIFESTEAL, baseValue: 3, unlocksAtRarity: ItemRarity.DIVINE },
 * ]);
 */

/**
 * Bulk import progressions from CSV-like data
 */
export async function importStatProgressions(
  itemId: number,
  progressionsData: string
) {
  // Parse CSV format: statType,baseValue,unlocksAtRarity
  const lines = progressionsData.trim().split("\n");
  const progressions: Array<{
    statType: StatType;
    baseValue: number;
    unlocksAtRarity: ItemRarity;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    // Skip header
    const line = lines[i];
    if (!line) continue;
    
    const [statTypeStr, baseValueStr, unlocksAtRarityStr] = line.split(",");

    if (!statTypeStr || !baseValueStr || !unlocksAtRarityStr) continue;

    progressions.push({
      statType: statTypeStr.trim() as StatType,
      baseValue: parseFloat(baseValueStr.trim()),
      unlocksAtRarity: unlocksAtRarityStr.trim() as ItemRarity,
    });
  }

  return await setItemStatProgressions(itemId, progressions);
}

/**
 * Export progressions to CSV format
 */
export async function exportStatProgressions(itemId: number): Promise<string> {
  const progressions = await getItemStatProgressions(itemId);

  const rows = progressions.map((prog) =>
    [prog.statType, prog.baseValue, prog.unlocksAtRarity].join(",")
  );

  return ["statType,baseValue,unlocksAtRarity", ...rows].join("\n");
}
