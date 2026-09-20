import {
  criticalMultiplier,
  percentChance,
  protectionMultiplier,
  resolveCreatureStrike,
  type CharacterDefenses,
  type CreatureAttackProfile,
} from "~/server/combat/rules";
import {
  createLootTally,
  rollCreatureDrops,
  type CreatureDropPoolEntry,
  type CreatureLootReward,
} from "~/server/creatures/loot";
import { rollInclusive } from "~/server/expeditions/random";
import {
  calculateExpeditionRewardModifiers,
  clampNumber,
} from "~/server/expeditions/rewards";
import type { ComputedStats } from "~/types/stats";

export type DungeonMonsterPoolEntry = CreatureAttackProfile & {
  creatureId: number;
  name: string;
  asset: string;
  minCount: number;
  maxCount: number;
  health: number;
  armor: number;
  magicResist: number;
  evasion: number;
  blockChance: number;
  drops: CreatureDropPoolEntry[];
};

/** Character combat stats captured when the run starts. */
export type DungeonCombatSnapshot = CharacterDefenses & {
  maxHealth: number;
  physicalDamageMin: number;
  physicalDamageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  criticalChance: number;
  criticalDamage: number;
  attackSpeed: number;
  luck: number;
};

export type DungeonDeathRules = {
  /** Chance (0-1) that each looted stack survives a defeat. */
  keepChance: number;
  /** Share (0-100) of a surviving stack's quantity that is kept, minimum 1. */
  quantityPercent: number;
};

export type DungeonOutcome = "CLEARED" | "DEFEATED";

export type DungeonEncounterReport = {
  creatureId: number;
  name: string;
  asset: string;
  damageTaken: number;
};

// Deliberately contains no monster counts: players never learn how many
// creatures a dungeon holds.
export type DungeonReport = {
  outcome: DungeonOutcome;
  encounters: DungeonEncounterReport[];
  defeatedBy: { creatureId: number; name: string; asset: string } | null;
  damageTaken: number;
  evaded: number;
  blocked: number;
  criticalHits: number;
};

export type DungeonResolution = {
  rewards: CreatureLootReward[];
  report: DungeonReport;
  /** Monsters slain per creature, for quests. Never part of the report. */
  kills: Array<{ creatureId: number; count: number }>;
};

export type DungeonResolutionInput = {
  pool: DungeonMonsterPoolEntry[];
  combat: DungeonCombatSnapshot;
  startingHealth: number;
  /** Monsters fighting the character at once; 1 = one at a time. */
  packSize: number;
  deathRules: DungeonDeathRules;
  random?: () => number;
};

// Bounds a run whose monsters cannot realistically be defeated; reaching it
// counts as the character being overwhelmed.
export const MAX_DUNGEON_COMBAT_ROUNDS = 10_000;
export const MAX_DUNGEON_PACK_SIZE = 10;
const MAX_ATTACKS_PER_ROUND = 10;

/** The dungeon-relevant part of a character's final stats. */
export function combatSnapshotFromStats(
  stats: ComputedStats,
): DungeonCombatSnapshot {
  return {
    maxHealth: stats.health,
    physicalDamageMin: stats.minPhysicalDamage,
    physicalDamageMax: stats.maxPhysicalDamage,
    magicDamageMin: stats.minMagicDamage,
    magicDamageMax: stats.maxMagicDamage,
    criticalChance: stats.criticalChance,
    criticalDamage: stats.criticalDamage,
    attackSpeed: stats.attackSpeed,
    armor: stats.armor,
    magicResist: stats.magicResist,
    evasionMelee: stats.evasionMelee,
    evasionRanged: stats.evasionRanged,
    evasionMagic: stats.evasionMagic,
    blockChance: stats.blockChance,
    fireResist: stats.fireResist,
    coldResist: stats.coldResist,
    lightningResist: stats.lightningResist,
    poisonResist: stats.poisonResist,
    luck: stats.luck,
  };
}

export function isFightableMonster(
  monster: Pick<DungeonMonsterPoolEntry, "health" | "minCount" | "maxCount">,
) {
  return (
    monster.health >= 1 &&
    monster.maxCount >= 1 &&
    monster.maxCount >= monster.minCount
  );
}

function rollRange(minimum: number, maximum: number, random: () => number) {
  const low = Math.max(0, Math.min(minimum, maximum));
  const high = Math.max(low, maximum);
  return low + random() * (high - low);
}

// Character stats are fractional (items scale with rarity), so their damage is
// rolled continuously rather than in whole numbers.
function characterStrike(
  monster: DungeonMonsterPoolEntry,
  combat: DungeonCombatSnapshot,
  random: () => number,
) {
  if (random() < percentChance(monster.evasion, 75)) {
    return { damage: 0, critical: false };
  }
  let damage =
    rollRange(combat.physicalDamageMin, combat.physicalDamageMax, random) *
      protectionMultiplier(monster.armor) +
    rollRange(combat.magicDamageMin, combat.magicDamageMax, random) *
      protectionMultiplier(monster.magicResist);
  const critical = random() < percentChance(combat.criticalChance, 100);
  if (critical) damage *= criticalMultiplier(combat.criticalDamage);
  if (random() < percentChance(monster.blockChance, 75)) damage *= 0.5;
  return { damage, critical };
}

/** A defeated character keeps only some stacks, each heavily reduced. */
export function applyDungeonDeathPenalty(
  rewards: readonly CreatureLootReward[],
  rules: DungeonDeathRules,
  random: () => number,
): CreatureLootReward[] {
  const keepChance = clampNumber(rules.keepChance, 0, 1);
  const share = clampNumber(rules.quantityPercent, 0, 100) / 100;
  return rewards.flatMap((reward) =>
    random() < keepChance
      ? [
          {
            ...reward,
            quantity: Math.max(1, Math.floor(reward.quantity * share)),
          },
        ]
      : [],
  );
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function creatureRef(monster: DungeonMonsterPoolEntry) {
  return {
    creatureId: monster.creatureId,
    name: monster.name,
    asset: monster.asset,
  };
}

/**
 * Resolves a whole dungeon run from its entry snapshot.
 *
 * Monster counts are rolled per run and the lineup is shuffled. Up to
 * `packSize` monsters are engaged at once, refilled at the start of each
 * round. In a round the character strikes `attackSpeed` times at the first
 * engaged monster (leftover strikes move on to the next one), and every
 * monster engaged at the start of the round strikes back at the same time,
 * so each monster lands at least one attack even if it dies that round.
 *
 * Monsters slain in a round drop loot only if the character survives that
 * round. Reaching zero health ends the run and applies the death penalty to
 * the loot gathered so far.
 */
export function resolveDungeonRun(
  input: DungeonResolutionInput,
): DungeonResolution {
  const random = input.random ?? Math.random;
  const { combat } = input;
  // Luck improves monster drops through the shared expedition formula.
  const modifiers = calculateExpeditionRewardModifiers({
    skillLevel: 1,
    luck: combat.luck,
    efficiency: 0,
    quantityMultiplier: 1,
  });

  const lineup: DungeonMonsterPoolEntry[] = [];
  for (const monster of input.pool) {
    if (!isFightableMonster(monster)) continue;
    const count = rollInclusive(monster.minCount, monster.maxCount, random);
    for (let index = 0; index < count; index += 1) lineup.push(monster);
  }
  for (let index = lineup.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(
      clampNumber(random(), 0, 0.999999999) * (index + 1),
    );
    [lineup[index], lineup[swap]] = [lineup[swap]!, lineup[index]!];
  }

  const tally = createLootTally();
  const kills = new Map<number, number>();
  const encounters = new Map<number, DungeonEncounterReport>();
  const encounterFor = (monster: DungeonMonsterPoolEntry) => {
    let encounter = encounters.get(monster.creatureId);
    if (!encounter) {
      encounter = { ...creatureRef(monster), damageTaken: 0 };
      encounters.set(monster.creatureId, encounter);
    }
    return encounter;
  };
  const packSize = clampNumber(
    Math.floor(input.packSize),
    1,
    MAX_DUNGEON_PACK_SIZE,
  );
  const attackSpeed = clampNumber(
    combat.attackSpeed,
    0.1,
    MAX_ATTACKS_PER_ROUND,
  );
  const pack: Array<{ monster: DungeonMonsterPoolEntry; health: number }> = [];
  let nextInLine = 0;
  let health = Math.max(0, input.startingHealth);
  let rounds = 0;
  let strikes = 0;
  let evaded = 0;
  let blocked = 0;
  let criticalHits = 0;
  let defeated = false;
  let defeatedBy: DungeonReport["defeatedBy"] = null;

  while (nextInLine < lineup.length || pack.length > 0) {
    while (pack.length < packSize && nextInLine < lineup.length) {
      const monster = lineup[nextInLine]!;
      nextInLine += 1;
      encounterFor(monster);
      pack.push({ monster, health: monster.health });
    }
    if (rounds >= MAX_DUNGEON_COMBAT_ROUNDS) {
      defeated = true;
      defeatedBy = creatureRef(pack[0]!.monster);
      break;
    }
    rounds += 1;

    const attackers = pack.map((engaged) => engaged.monster);
    const slain: DungeonMonsterPoolEntry[] = [];
    strikes += attackSpeed;
    while (strikes >= 1 && pack.length > 0) {
      strikes -= 1;
      const target = pack[0]!;
      const strike = characterStrike(target.monster, combat, random);
      target.health -= strike.damage;
      if (strike.critical) criticalHits += 1;
      if (target.health <= 0) slain.push(pack.shift()!.monster);
    }
    // Clearing the whole pack ends the round; the next group engages fresh.
    if (pack.length === 0) strikes %= 1;

    for (const monster of attackers) {
      const blow = resolveCreatureStrike(monster, combat, random);
      if (blow.evaded) evaded += 1;
      if (blow.blocked) blocked += 1;
      const damage = Math.min(health, blow.damage);
      health -= damage;
      encounterFor(monster).damageTaken += damage;
      if (health <= 0) {
        defeated = true;
        defeatedBy = creatureRef(monster);
        break;
      }
    }
    if (defeated) break;
    for (const monster of slain) {
      kills.set(monster.creatureId, (kills.get(monster.creatureId) ?? 0) + 1);
      rollCreatureDrops(monster.drops, modifiers, random, tally);
    }
  }

  const outcome: DungeonOutcome = defeated ? "DEFEATED" : "CLEARED";
  const looted = tally.rewards();
  const rewards =
    outcome === "CLEARED"
      ? looted
      : applyDungeonDeathPenalty(looted, input.deathRules, random);
  const encounterReports = [...encounters.values()].map((encounter) => ({
    ...encounter,
    damageTaken: round2(encounter.damageTaken),
  }));

  return {
    rewards,
    report: {
      outcome,
      encounters: encounterReports,
      defeatedBy,
      damageTaken: round2(
        [...encounters.values()].reduce(
          (sum, encounter) => sum + encounter.damageTaken,
          0,
        ),
      ),
      evaded,
      blocked,
      criticalHits,
    },
    kills: [...kills].map(([creatureId, count]) => ({ creatureId, count })),
  };
}
