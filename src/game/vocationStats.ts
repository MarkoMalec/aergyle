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

/**
 * Efficiency at which an action takes half its base time. Every point adds the
 * same amount of output, so 100 doubles it and 200 triples it, the same way
 * Movement Speed shortens travel. Time approaches zero but never reaches it.
 */
export const VOCATION_EFFICIENCY_HALF_TIME = 100;

export function computeEffectiveUnitSeconds(
  baseSeconds: number,
  efficiencyPercent: number,
): {
  unitSeconds: number;
  rawSeconds: number;
  appliedEfficiency: number;
} {
  const appliedEfficiency = Number.isFinite(efficiencyPercent)
    ? Math.max(0, efficiencyPercent)
    : 0;
  const rawSeconds =
    (Math.max(0, baseSeconds) * VOCATION_EFFICIENCY_HALF_TIME) /
    (VOCATION_EFFICIENCY_HALF_TIME + appliedEfficiency);
  const unitSeconds = Math.max(1, Math.round(rawSeconds));

  return {
    unitSeconds,
    rawSeconds,
    appliedEfficiency,
  };
}
