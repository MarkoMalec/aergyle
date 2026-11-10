import { clamp } from "~/lib/utils";

export type ExpeditionRewardModifiers = {
  findModifierPercent: number;
  quantityModifierPercent: number;
  quantityScale: number;
};

/** A stored JSON number, or `fallback` when it is missing or not finite. */
export function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Shared Gathering/Hunting reward scaling. Skills and Luck improve discovery;
 * vocation efficiency improves both discovery and quantity. Callers retain
 * ownership of pool selection and fallback behavior.
 */
export function calculateExpeditionRewardModifiers(input: {
  skillLevel: number;
  luck: number;
  efficiency: number;
  quantityMultiplier: number;
}): ExpeditionRewardModifiers {
  const skillAboveOne = Math.max(0, Math.floor(input.skillLevel) - 1);
  const luck = clamp(input.luck, -100, 250);
  const efficiency = clamp(input.efficiency, 0, 250);

  const findModifierPercent = clamp(
    skillAboveOne * 0.5 + luck * 0.4 + efficiency,
    -50,
    150,
  );
  const quantityModifierPercent = clamp(
    skillAboveOne * 0.2 + Math.max(0, luck) * 0.1 + efficiency * 0.5,
    0,
    100,
  );

  return {
    findModifierPercent,
    quantityModifierPercent,
    quantityScale:
      clamp(input.quantityMultiplier, 0.1, 20) *
      (1 + quantityModifierPercent / 100),
  };
}

export function calculateExpeditionEffectiveFindChance(
  baseChance: number,
  findModifierPercent: number,
) {
  if (!Number.isFinite(baseChance) || baseChance <= 0) return 0;
  return clamp(baseChance * (1 + findModifierPercent / 100), 0.001, 0.95);
}
