import type { ItemRarity } from "~/generated/prisma/enums";
import {
  calculateExpeditionEffectiveFindChance,
  calculateExpeditionRewardModifiers,
  clampNumber,
  type ExpeditionRewardModifiers,
} from "~/server/expeditions/rewards";

export type GatheringRewardPoolEntry = {
  resourceId: number;
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  baseChance: number;
  minQuantity: number;
  maxQuantity: number;
};

export type GatheringReward = {
  resourceId: number;
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

export type GatheringRewardInput = {
  pool: GatheringRewardPoolEntry[];
  rewardRolls: number;
  quantityMultiplier: number;
  skillLevel: number;
  luck: number;
  gatheringEfficiency: number;
  random?: () => number;
};

function rollInclusive(min: number, max: number, random: () => number) {
  const low = Math.max(1, Math.ceil(Math.min(min, max)));
  const high = Math.max(low, Math.floor(Math.max(min, max)));
  return (
    low + Math.floor(clampNumber(random(), 0, 0.999999999) * (high - low + 1))
  );
}

function weightedFallback(
  pool: GatheringRewardPoolEntry[],
  random: () => number,
) {
  const totalWeight = pool.reduce(
    (total, entry) => total + clampNumber(entry.baseChance, 0.001, 1),
    0,
  );
  let cursor = clampNumber(random(), 0, 0.999999999) * totalWeight;
  for (const entry of pool) {
    cursor -= clampNumber(entry.baseChance, 0.001, 1);
    if (cursor <= 0) return entry;
  }
  return pool[pool.length - 1]!;
}

/**
 * Shared modifier calculation used by live expeditions and admin balance tools.
 * Luck and Gathering Efficiency are the final totals after equipment and active
 * effects have been applied.
 */
export function calculateGatheringRewardModifiers(
  input: Pick<
    GatheringRewardInput,
    "skillLevel" | "luck" | "gatheringEfficiency" | "quantityMultiplier"
  >,
): ExpeditionRewardModifiers {
  return calculateExpeditionRewardModifiers({
    skillLevel: input.skillLevel,
    luck: input.luck,
    efficiency: input.gatheringEfficiency,
    quantityMultiplier: input.quantityMultiplier,
  });
}

/**
 * One transparent, tuneable expedition formula:
 * - admin chance is multiplied by skill, Luck and Gathering Efficiency;
 * - every configured duration supplies a number of independent find rolls;
 * - successful quantities are multiplied by duration and a smaller stat bonus;
 * - every expedition returns at least one configured resource.
 */
export function calculateGatheringRewards(
  input: GatheringRewardInput,
): GatheringReward[] {
  const pool = input.pool.filter(
    (entry) =>
      Number.isFinite(entry.baseChance) &&
      entry.baseChance > 0 &&
      entry.minQuantity > 0 &&
      entry.maxQuantity >= entry.minQuantity,
  );
  if (pool.length === 0) return [];

  const random = input.random ?? Math.random;
  const { findModifierPercent, quantityScale } =
    calculateGatheringRewardModifiers(input);
  const rollCount = Math.max(1, Math.min(100, Math.floor(input.rewardRolls)));

  const quantities = new Map<number, number>();
  for (let roll = 0; roll < rollCount; roll += 1) {
    for (const entry of pool) {
      const effectiveChance = calculateExpeditionEffectiveFindChance(
        entry.baseChance,
        findModifierPercent,
      );
      if (random() >= effectiveChance) continue;

      const baseQuantity = rollInclusive(
        entry.minQuantity,
        entry.maxQuantity,
        random,
      );
      const scaledQuantity = Math.max(
        1,
        Math.round(baseQuantity * quantityScale),
      );
      quantities.set(
        entry.itemId,
        (quantities.get(entry.itemId) ?? 0) + scaledQuantity,
      );
    }
  }

  if (quantities.size === 0) {
    const entry = weightedFallback(pool, random);
    const quantity = Math.max(
      1,
      Math.round(
        rollInclusive(entry.minQuantity, entry.maxQuantity, random) *
          quantityScale,
      ),
    );
    quantities.set(entry.itemId, quantity);
  }

  return pool
    .filter((entry) => quantities.has(entry.itemId))
    .map((entry) => ({
      resourceId: entry.resourceId,
      itemId: entry.itemId,
      name: entry.name,
      sprite: entry.sprite,
      rarity: entry.rarity,
      quantity: quantities.get(entry.itemId) ?? 0,
    }));
}
