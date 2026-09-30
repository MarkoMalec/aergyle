import type {
  CreatureAttackStyle,
  CreatureDamageType,
} from "~/generated/prisma/enums";
import { rollInclusive } from "~/server/expeditions/random";
import { clampNumber, finiteNumber } from "~/server/expeditions/rewards";

// Pure combat rules shared by Hunting retaliation and dungeon combat. Keep this
// module free of server-only imports; admin simulators run it in the browser.
// The model and its reasons are in docs/COMBAT_BALANCE_DESIGN.md.

export type CreatureAttackProfile = {
  attackStyle: CreatureAttackStyle;
  damageMin: number;
  damageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  damageType: CreatureDamageType | null;
  elementalDamageMin: number;
  elementalDamageMax: number;
  critChance: number;
  critDamage: number;
};

export type CharacterDefenses = {
  armor: number;
  magicResist: number;
  evasionMelee: number;
  evasionRanged: number;
  evasionMagic: number;
  blockChance: number;
  fireResist: number;
  coldResist: number;
  lightningResist: number;
  poisonResist: number;
};

export type CreatureStrike = {
  damage: number;
  evaded: boolean;
  blocked: boolean;
  critical: boolean;
};

/** A character's offense when it strikes a monster. */
export type CharacterAttack = {
  physicalDamageMin: number;
  physicalDamageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  criticalChance: number;
  criticalDamage: number;
};

/** A monster's defenses when a character strikes it. */
export type MonsterDefenses = {
  armor: number;
  magicResist: number;
  evasion: number;
  blockChance: number;
};

/** Admin combat constants (the CombatConfig row). */
export type CombatConfig = {
  /** Armor that halves damage from a level-L attacker is armorK0 + armorK1 × L. */
  armorK0: number;
  armorK1: number;
};

export const DEFAULT_COMBAT_CONFIG: CombatConfig = { armorK0: 50, armorK1: 3 };

/** The highest Magic Resist or elemental resistance that counts, in percent. */
export const RESISTANCE_CAP = 75;

/**
 * How landed strikes are mitigated, fixed when an activity starts.
 *
 * Version 2 is the current model: armor reduces every hit by K / (K + armor),
 * Magic Resist and the elemental resistances are capped percentages on top,
 * and block halves physical damage only. Version 1 is the original model,
 * kept for snapshots taken before version 2: a fixed K of 100, armor against
 * physical damage only, Magic Resist as a rating against magic damage,
 * elements unaffected by armor, and block halving any damage.
 */
export type StrikeRules = {
  version: 1 | 2;
  /** Armor that halves this attacker's damage. */
  armorK: number;
};

export const LEGACY_STRIKE_RULES: StrikeRules = { version: 1, armorK: 100 };

/** The armor that halves damage from an attacker of `level`. */
export function armorConstant(
  level: number,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG,
) {
  const attackerLevel = Number.isFinite(level)
    ? Math.max(1, Math.floor(level))
    : 1;
  return Math.max(1, config.armorK0 + config.armorK1 * attackerLevel);
}

/** Current rules against an attacker of `level`. */
export function strikeRulesFor(
  level: number,
  config: CombatConfig = DEFAULT_COMBAT_CONFIG,
): StrikeRules {
  return { version: 2, armorK: armorConstant(level, config) };
}

/** Rules stored in a snapshot; anything unrecognised is the original model. */
export function parseStrikeRules(value: unknown): StrikeRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return LEGACY_STRIKE_RULES;
  }
  const row = value as Record<string, unknown>;
  const armorK = finiteNumber(row.armorK);
  return row.version === 2 && armorK > 0
    ? { version: 2, armorK }
    : LEGACY_STRIKE_RULES;
}

/** Converts a percentage stat into a 0-1 chance, capped at `cap` percent. */
export function percentChance(percent: number, cap: number) {
  return clampNumber(percent, 0, cap) / 100;
}

/** Share of damage that gets through `protection` armor: K / (K + armor). */
export function protectionMultiplier(protection: number, k = 100) {
  return k / (k + Math.max(0, protection));
}

/** Share of damage (0-1) that `armor` stops against an attacker whose K is `k`. */
export function armorReduction(armor: number, k: number) {
  return 1 - protectionMultiplier(armor, k);
}

/** Critical damage uses the character scale: 150 = x1.5, never below x1. */
export function criticalMultiplier(critDamage: number) {
  return Math.max(1, critDamage / 100);
}

/** Share of damage a percentage resistance lets through. */
function resistedShare(resistance: number) {
  return 1 - clampNumber(resistance, -100, RESISTANCE_CAP) / 100;
}

/** Rolled damage of one strike, before any defense. */
export type StrikeDamage = {
  physical: number;
  magic: number;
  elemental: number;
};

/** A landed strike's damage after block, resistances and armor. */
export function mitigateStrike(
  damage: StrikeDamage,
  defense: { armor: number; magicResist: number; elementalResist: number },
  blocked: boolean,
  rules: StrikeRules,
) {
  if (rules.version === 1) {
    const total =
      damage.physical * protectionMultiplier(defense.armor) +
      damage.magic * protectionMultiplier(defense.magicResist) +
      damage.elemental * resistedShare(defense.elementalResist);
    return blocked ? total * 0.5 : total;
  }
  return (
    (damage.physical * (blocked ? 0.5 : 1) +
      damage.magic * resistedShare(defense.magicResist) +
      damage.elemental * resistedShare(defense.elementalResist)) *
    protectionMultiplier(defense.armor, rules.armorK)
  );
}

function evasionForStyle(
  style: CreatureAttackStyle,
  defenses: CharacterDefenses,
) {
  if (style === "RANGED") return defenses.evasionRanged;
  if (style === "MAGIC") return defenses.evasionMagic;
  return defenses.evasionMelee;
}

function resistanceFor(
  damageType: CreatureDamageType,
  defenses: CharacterDefenses,
) {
  if (damageType === "FIRE") return defenses.fireResist;
  if (damageType === "ICE") return defenses.coldResist;
  if (damageType === "LIGHTNING") return defenses.lightningResist;
  return defenses.poisonResist;
}

// Character stats are fractional (items scale with rarity), so their damage is
// rolled continuously rather than in whole numbers.
function rollRange(minimum: number, maximum: number, random: () => number) {
  const low = Math.max(0, Math.min(minimum, maximum));
  const high = Math.max(low, maximum);
  return low + random() * (high - low);
}

/**
 * One creature attack against a character. The attack style decides which
 * evasion can avoid it. The rolls happen in the same order under every rules
 * version, so a snapshot resolves identically however often it is retried.
 */
export function resolveCreatureStrike(
  creature: CreatureAttackProfile,
  defenses: CharacterDefenses,
  random: () => number,
  rules: StrikeRules = LEGACY_STRIKE_RULES,
): CreatureStrike {
  if (
    random() <
    percentChance(evasionForStyle(creature.attackStyle, defenses), 75)
  ) {
    return { damage: 0, evaded: true, blocked: false, critical: false };
  }
  const blockRoll = random() < percentChance(defenses.blockChance, 75);
  const physical = rollInclusive(
    creature.damageMin,
    creature.damageMax,
    random,
  );
  const magic = rollInclusive(
    creature.magicDamageMin,
    creature.magicDamageMax,
    random,
  );
  const elemental = creature.damageType
    ? rollInclusive(
        creature.elementalDamageMin,
        creature.elementalDamageMax,
        random,
      )
    : 0;
  // A shield only stops weapons, so a spell can't be blocked.
  const blocked = blockRoll && (rules.version === 1 || physical > 0);
  let damage = mitigateStrike(
    { physical, magic, elemental },
    {
      armor: defenses.armor,
      magicResist: defenses.magicResist,
      elementalResist: creature.damageType
        ? resistanceFor(creature.damageType, defenses)
        : 0,
    },
    blocked,
    rules,
  );
  const critical = random() < percentChance(creature.critChance, 100);
  if (critical) damage *= criticalMultiplier(creature.critDamage);
  return { damage, evaded: false, blocked, critical };
}

/** One character strike against a monster, rolled in a fixed order. */
export function resolveCharacterStrike(
  attack: CharacterAttack,
  target: MonsterDefenses,
  random: () => number,
  rules: StrikeRules = LEGACY_STRIKE_RULES,
) {
  if (random() < percentChance(target.evasion, 75)) {
    return { damage: 0, critical: false };
  }
  const physical = rollRange(
    attack.physicalDamageMin,
    attack.physicalDamageMax,
    random,
  );
  const magic = rollRange(attack.magicDamageMin, attack.magicDamageMax, random);
  const critical = random() < percentChance(attack.criticalChance, 100);
  const blocked = random() < percentChance(target.blockChance, 75);
  let damage = mitigateStrike(
    { physical, magic, elemental: 0 },
    {
      armor: target.armor,
      magicResist: target.magicResist,
      elementalResist: 0,
    },
    blocked,
    rules,
  );
  if (critical) damage *= criticalMultiplier(attack.criticalDamage);
  return { damage, critical };
}
