import {
  resolveHuntingExpedition,
  type HuntingResolutionInput,
} from "./resolver";

export function runHuntingSimulation(
  input: HuntingResolutionInput & { iterations: number },
) {
  const iterations = Math.max(
    1,
    Math.min(100_000, Math.floor(input.iterations)),
  );
  let totalItems = 0;
  let totalDamage = 0;
  let injuredExpeditions = 0;
  const encounterCounts = new Map<number, number>();

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const result = resolveHuntingExpedition(input);
    totalItems += result.rewards.reduce(
      (sum, reward) => sum + reward.quantity,
      0,
    );
    totalDamage += result.report.totalDamage;
    if (result.report.totalDamage > 0) injuredExpeditions += 1;
    for (const encounter of result.report.encounters) {
      encounterCounts.set(
        encounter.creatureId,
        (encounterCounts.get(encounter.creatureId) ?? 0) + encounter.count,
      );
    }
  }

  return {
    iterations,
    averageItems: totalItems / iterations,
    averageDamage: totalDamage / iterations,
    injuryRate: injuredExpeditions / iterations,
    encounters: input.pool.map((creature) => ({
      creatureId: creature.creatureId,
      name: creature.name,
      averageEncounters:
        (encounterCounts.get(creature.creatureId) ?? 0) / iterations,
    })),
  };
}
