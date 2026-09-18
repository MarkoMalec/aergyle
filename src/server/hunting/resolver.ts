import {
  resolveCreatureStrike,
  type CharacterDefenses,
  type CreatureAttackProfile,
} from "~/server/combat/rules";
import {
  createLootTally,
  isObtainableDrop,
  rollCreatureDrops,
  rollDropQuantity,
  type CreatureDropPoolEntry,
  type CreatureLootReward,
} from "~/server/creatures/loot";
import { rollInclusive } from "~/server/expeditions/random";
import {
  calculateExpeditionRewardModifiers,
  clampNumber,
  type ExpeditionRewardModifiers,
} from "~/server/expeditions/rewards";

export type HuntingCreaturePoolEntry = CreatureAttackProfile & {
  creatureId: number;
  name: string;
  asset: string;
  encounterWeight: number;
  attackChance: number;
  drops: CreatureDropPoolEntry[];
};

export type HuntingDefenseSnapshot = CharacterDefenses & {
  movementSpeed: number;
  maxHealth: number;
};

export type HuntingReward = CreatureLootReward;

export type HuntingEncounterReport = {
  creatureId: number;
  name: string;
  asset: string;
  count: number;
  attacks: number;
  evaded: number;
  blocked: number;
  damageTaken: number;
};

export type HuntingReport = {
  encounters: HuntingEncounterReport[];
  accidents: {
    attempts: number;
    injuries: number;
    damageTaken: number;
  };
  totalDamage: number;
  modifiers: ExpeditionRewardModifiers;
};

export type HuntingResolution = {
  rewards: HuntingReward[];
  report: HuntingReport;
};

export type HuntingResolutionInput = {
  pool: HuntingCreaturePoolEntry[];
  encounterRolls: number;
  quantityMultiplier: number;
  dangerMultiplier: number;
  globalDangerMultiplier: number;
  damageEnabled: boolean;
  maxHealthLossPercent: number;
  accidentChance: number;
  accidentDamageMin: number;
  accidentDamageMax: number;
  skillLevel: number;
  luck: number;
  huntingEfficiency: number;
  defenses: HuntingDefenseSnapshot;
  random?: () => number;
};

export type HuntingSafetyControls = {
  damageEnabled: boolean;
  globalDangerMultiplier: number;
  maxHealthLossPercent: number;
  minimumRemainingHealthPercent: number;
};

/** Live safety controls may protect an active snapshot, but never make it harsher. */
export function applyLiveHuntingSafety(
  snapshot: HuntingSafetyControls,
  live: HuntingSafetyControls,
): HuntingSafetyControls {
  return {
    damageEnabled: snapshot.damageEnabled && live.damageEnabled,
    globalDangerMultiplier: Math.min(
      snapshot.globalDangerMultiplier,
      live.globalDangerMultiplier,
    ),
    maxHealthLossPercent: Math.min(
      snapshot.maxHealthLossPercent,
      live.maxHealthLossPercent,
    ),
    minimumRemainingHealthPercent: Math.max(
      snapshot.minimumRemainingHealthPercent,
      live.minimumRemainingHealthPercent,
    ),
  };
}

function chooseWeighted<T>(
  values: readonly T[],
  weight: (value: T) => number,
  random: () => number,
): T {
  const total = values.reduce(
    (sum, value) => sum + Math.max(0.001, weight(value)),
    0,
  );
  let cursor = clampNumber(random(), 0, 0.999999999) * total;
  for (const value of values) {
    cursor -= Math.max(0.001, weight(value));
    if (cursor <= 0) return value;
  }
  return values[values.length - 1]!;
}

function applyDamageBudget(damage: number, remainingBudget: number) {
  return Math.max(0, Math.min(remainingBudget, Math.round(damage)));
}

/**
 * Resolves a Hunting expedition from departure-time snapshots. Each roll picks
 * one weighted creature and independently resolves its drops, retaliation,
 * and a field mishap. A fully empty expedition receives one weighted fallback
 * material so a completed idle action never returns nothing.
 */
export function resolveHuntingExpedition(
  input: HuntingResolutionInput,
): HuntingResolution {
  const pool = input.pool.filter(
    (creature) =>
      creature.encounterWeight > 0 && creature.drops.some(isObtainableDrop),
  );
  if (pool.length === 0) {
    return {
      rewards: [],
      report: {
        encounters: [],
        accidents: { attempts: 0, injuries: 0, damageTaken: 0 },
        totalDamage: 0,
        modifiers: calculateExpeditionRewardModifiers({
          skillLevel: input.skillLevel,
          luck: input.luck,
          efficiency: input.huntingEfficiency,
          quantityMultiplier: input.quantityMultiplier,
        }),
      },
    };
  }

  const random = input.random ?? Math.random;
  const modifiers = calculateExpeditionRewardModifiers({
    skillLevel: input.skillLevel,
    luck: input.luck,
    efficiency: input.huntingEfficiency,
    quantityMultiplier: input.quantityMultiplier,
  });
  const dangerScale = clampNumber(
    input.dangerMultiplier * input.globalDangerMultiplier,
    0,
    10,
  );
  const damageBudget = input.damageEnabled
    ? Math.max(
        0,
        (input.defenses.maxHealth *
          clampNumber(input.maxHealthLossPercent, 0, 100)) /
          100,
      )
    : 0;
  let damageRemaining = damageBudget;

  const tally = createLootTally();
  const encounterByCreatureId = new Map<number, HuntingEncounterReport>();
  const accidents = { attempts: 0, injuries: 0, damageTaken: 0 };
  const rollCount = Math.max(
    1,
    Math.min(100, Math.floor(input.encounterRolls)),
  );

  for (let roll = 0; roll < rollCount; roll += 1) {
    const creature = chooseWeighted(
      pool,
      (entry) => entry.encounterWeight,
      random,
    );
    const encounter = encounterByCreatureId.get(creature.creatureId) ?? {
      creatureId: creature.creatureId,
      name: creature.name,
      asset: creature.asset,
      count: 0,
      attacks: 0,
      evaded: 0,
      blocked: 0,
      damageTaken: 0,
    };
    encounter.count += 1;

    const attackChance = clampNumber(
      creature.attackChance * dangerScale,
      0,
      0.95,
    );
    if (random() < attackChance) {
      encounter.attacks += 1;
      const strike = resolveCreatureStrike(creature, input.defenses, random);
      if (strike.evaded) {
        encounter.evaded += 1;
      } else {
        if (strike.blocked) encounter.blocked += 1;
        const damage = input.damageEnabled
          ? applyDamageBudget(strike.damage * dangerScale, damageRemaining)
          : 0;
        encounter.damageTaken += damage;
        damageRemaining -= damage;
      }
    }
    encounterByCreatureId.set(creature.creatureId, encounter);

    rollCreatureDrops(creature.drops, modifiers, random, tally);

    accidents.attempts += 1;
    const movementFactor = clampNumber(
      1 - (input.defenses.movementSpeed - 100) * 0.005,
      0.5,
      1.5,
    );
    const accidentChance = clampNumber(
      input.accidentChance * dangerScale * movementFactor,
      0,
      0.95,
    );
    if (random() < accidentChance) {
      accidents.injuries += 1;
      const damage = input.damageEnabled
        ? applyDamageBudget(
            rollInclusive(
              input.accidentDamageMin,
              input.accidentDamageMax,
              random,
            ) * dangerScale,
            damageRemaining,
          )
        : 0;
      accidents.damageTaken += damage;
      damageRemaining -= damage;
    }
  }

  if (tally.size === 0) {
    const encounteredPool = pool.filter((creature) =>
      encounterByCreatureId.has(creature.creatureId),
    );
    const creature = chooseWeighted(
      encounteredPool,
      (entry) => encounterByCreatureId.get(entry.creatureId)?.count ?? 1,
      random,
    );
    const drop = chooseWeighted(
      creature.drops.filter(isObtainableDrop),
      (entry) => entry.baseChance,
      random,
    );
    tally.add(drop, rollDropQuantity(drop, modifiers.quantityScale, random));
  }

  const rewards = tally.rewards();
  const encounters = [...encounterByCreatureId.values()];
  const totalDamage =
    encounters.reduce((sum, encounter) => sum + encounter.damageTaken, 0) +
    accidents.damageTaken;

  return {
    rewards,
    report: { encounters, accidents, totalDamage, modifiers },
  };
}
