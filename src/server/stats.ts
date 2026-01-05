import "server-only";

import { StatType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import type { EquipmentSlotsWithItems } from "~/types/inventory";
import type { ComputedStats } from "~/types/stats";
import {
  calculateEquipmentBonuses,
  calculateFinalStats,
  getDefaultBaseStats,
} from "~/utils/stats";

export async function getCharacterBaseStats(
  userId: string,
): Promise<Record<StatType, number>> {
  const baseStats = await prisma.characterBaseStat.findMany({
    where: { userId },
  });

  const stats: Record<StatType, number> = getDefaultBaseStats();

  for (const stat of baseStats) {
    stats[stat.statType] = stat.value;
  }

  return stats;
}

export async function initializeCharacterStats(userId: string): Promise<void> {
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

export async function getCompleteCharacterStats(
  userId: string,
  equipment: EquipmentSlotsWithItems,
): Promise<ComputedStats> {
  const baseStats = await getCharacterBaseStats(userId);
  const equipmentBonuses = calculateEquipmentBonuses(equipment);
  return calculateFinalStats(baseStats, equipmentBonuses);
}
