import { calculateExpeditionEffectiveFindChance } from "~/server/expeditions/rewards";
import {
  calculateGatheringRewardModifiers,
  calculateGatheringRewards,
  type GatheringRewardPoolEntry,
} from "./rewards";

export type GatheringSimulationInput = {
  pool: GatheringRewardPoolEntry[];
  durationSeconds: number;
  rewardRolls: number;
  quantityMultiplier: number;
  skillLevel: number;
  luck: number;
  gatheringEfficiency: number;
  iterations: number;
  random?: () => number;
};

export type GatheringSimulationResourceResult = GatheringRewardPoolEntry & {
  effectiveChance: number;
  foundExpeditions: number;
  expeditionFindRate: number;
  totalQuantity: number;
  averageQuantityPerExpedition: number;
  averageQuantityWhenFound: number;
  averageQuantityPerHour: number;
};

export type GatheringSimulationResult = {
  iterations: number;
  durationHours: number;
  findModifierPercent: number;
  quantityModifierPercent: number;
  quantityScale: number;
  averageItemsPerExpedition: number;
  averageItemsPerHour: number;
  averageDistinctResources: number;
  resources: GatheringSimulationResourceResult[];
};

/** Runs the live reward calculator repeatedly without reading or changing player data. */
export function runGatheringSimulation(
  input: GatheringSimulationInput,
): GatheringSimulationResult {
  const iterations = Math.max(
    1,
    Math.min(100_000, Math.floor(input.iterations)),
  );
  const durationHours = Math.max(1 / 60, input.durationSeconds / 3_600);
  const modifiers = calculateGatheringRewardModifiers(input);
  const totals = new Map<
    number,
    { foundExpeditions: number; totalQuantity: number }
  >(
    input.pool.map((resource) => [
      resource.resourceId,
      { foundExpeditions: 0, totalQuantity: 0 },
    ]),
  );

  let totalItems = 0;
  let totalDistinctResources = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const rewards = calculateGatheringRewards({
      pool: input.pool,
      rewardRolls: input.rewardRolls,
      quantityMultiplier: input.quantityMultiplier,
      skillLevel: input.skillLevel,
      luck: input.luck,
      gatheringEfficiency: input.gatheringEfficiency,
      random: input.random,
    });

    totalDistinctResources += rewards.length;
    for (const reward of rewards) {
      totalItems += reward.quantity;
      const resourceTotal = totals.get(reward.resourceId);
      if (!resourceTotal) continue;
      resourceTotal.foundExpeditions += 1;
      resourceTotal.totalQuantity += reward.quantity;
    }
  }

  return {
    iterations,
    durationHours,
    findModifierPercent: modifiers.findModifierPercent,
    quantityModifierPercent: modifiers.quantityModifierPercent,
    quantityScale: modifiers.quantityScale,
    averageItemsPerExpedition: totalItems / iterations,
    averageItemsPerHour: totalItems / iterations / durationHours,
    averageDistinctResources: totalDistinctResources / iterations,
    resources: input.pool.map((resource) => {
      const total = totals.get(resource.resourceId) ?? {
        foundExpeditions: 0,
        totalQuantity: 0,
      };
      return {
        ...resource,
        effectiveChance: calculateExpeditionEffectiveFindChance(
          resource.baseChance,
          modifiers.findModifierPercent,
        ),
        foundExpeditions: total.foundExpeditions,
        expeditionFindRate: total.foundExpeditions / iterations,
        totalQuantity: total.totalQuantity,
        averageQuantityPerExpedition: total.totalQuantity / iterations,
        averageQuantityWhenFound:
          total.foundExpeditions === 0
            ? 0
            : total.totalQuantity / total.foundExpeditions,
        averageQuantityPerHour:
          total.totalQuantity / iterations / durationHours,
      };
    }),
  };
}
