import { createExpeditionRandom } from "~/server/expeditions/random";
import {
  resolveDungeonRun,
  type DungeonCombatSnapshot,
  type DungeonDeathRules,
  type DungeonMonsterPoolEntry,
} from "./resolver";

/** Recommended health lets a character survive this share of runs. */
export const RECOMMENDED_HEALTH_SURVIVAL_RATE = 0.9;

const NO_DEATH_RULES: DungeonDeathRules = { keepChance: 0, quantityPercent: 0 };

function clampIterations(value: number, maximum: number) {
  return Math.max(1, Math.min(maximum, Math.floor(value)));
}

/**
 * Health needed to survive ~90% of runs with the given combat stats. Runs use
 * unlimited health and a fixed seed, so the estimate is stable between page
 * loads. Returns null when the dungeon cannot be cleared at all (the combat
 * round limit is reached too often).
 */
export function estimateRecommendedHealth(params: {
  pool: DungeonMonsterPoolEntry[];
  combat: DungeonCombatSnapshot;
  packSize: number;
  seed: string;
  iterations?: number;
}): number | null {
  const iterations = clampIterations(params.iterations ?? 200, 5_000);
  const random = createExpeditionRandom(params.seed);
  const damages: number[] = [];
  let overwhelmed = 0;
  for (let index = 0; index < iterations; index += 1) {
    const { report } = resolveDungeonRun({
      pool: params.pool,
      combat: params.combat,
      packSize: params.packSize,
      startingHealth: Number.POSITIVE_INFINITY,
      deathRules: NO_DEATH_RULES,
      random,
    });
    if (report.outcome === "DEFEATED") overwhelmed += 1;
    damages.push(report.damageTaken);
  }
  if (overwhelmed > iterations * (1 - RECOMMENDED_HEALTH_SURVIVAL_RATE)) {
    return null;
  }
  damages.sort((a, b) => a - b);
  const index = Math.min(
    damages.length - 1,
    Math.ceil(iterations * RECOMMENDED_HEALTH_SURVIVAL_RATE) - 1,
  );
  // Surviving requires health strictly above the damage taken.
  return Math.floor(damages[index] ?? 0) + 1;
}

export function runDungeonSimulation(params: {
  pool: DungeonMonsterPoolEntry[];
  combat: DungeonCombatSnapshot;
  packSize: number;
  startingHealth: number;
  deathRules: DungeonDeathRules;
  iterations: number;
}) {
  const iterations = clampIterations(params.iterations, 100_000);
  let cleared = 0;
  let totalDamage = 0;
  let clearedItems = 0;
  let defeatedItems = 0;
  for (let index = 0; index < iterations; index += 1) {
    const { rewards, report } = resolveDungeonRun(params);
    const items = rewards.reduce((sum, reward) => sum + reward.quantity, 0);
    totalDamage += report.damageTaken;
    if (report.outcome === "CLEARED") {
      cleared += 1;
      clearedItems += items;
    } else {
      defeatedItems += items;
    }
  }
  const defeated = iterations - cleared;
  return {
    iterations,
    survivalRate: cleared / iterations,
    averageDamage: totalDamage / iterations,
    averageItemsWhenCleared: cleared ? clearedItems / cleared : 0,
    averageItemsWhenDefeated: defeated ? defeatedItems / defeated : 0,
    recommendedHealth: estimateRecommendedHealth({
      pool: params.pool,
      combat: params.combat,
      packSize: params.packSize,
      seed: "admin-simulator",
    }),
  };
}
