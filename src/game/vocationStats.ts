import { StatType, VocationalActionType } from "~/generated/prisma/enums";

/**
 * The single mapping used when item instances are created and when vocation
 * runtime speed is calculated. Professions without a dedicated efficiency
 * stat intentionally return null.
 */
const VOCATIONAL_EFFICIENCY_STAT_TYPES: Partial<
  Record<VocationalActionType, StatType>
> = {
  [VocationalActionType.WOODCUTTING]: StatType.WOODCUTTING_EFFICIENCY,
  [VocationalActionType.MINING]: StatType.MINING_EFFICIENCY,
  [VocationalActionType.FISHING]: StatType.FISHING_EFFICIENCY,
  [VocationalActionType.GATHERING]: StatType.GATHERING_EFFICIENCY,
  [VocationalActionType.HUNTING]: StatType.HUNTING_EFFICIENCY,
};

export function getVocationalEfficiencyStatType(
  actionType: VocationalActionType,
): StatType | null {
  return VOCATIONAL_EFFICIENCY_STAT_TYPES[actionType] ?? null;
}
