import type {
  CreatureAttackStyle,
  CreatureDamageType,
} from "~/generated/prisma/enums";
import { rollInclusive } from "~/server/expeditions/random";
import { clampNumber } from "~/server/expeditions/rewards";

// Pure combat rules shared by Hunting retaliation and dungeon combat. Keep this
// module free of server-only imports; admin simulators run it in the browser.

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

/** Converts a percentage stat into a 0-1 chance, capped at `cap` percent. */
export function percentChance(percent: number, cap: number) {
  return clampNumber(percent, 0, cap) / 100;
}

/** Diminishing damage multiplier for armor or magic resistance. */
export function protectionMultiplier(protection: number) {
  return 100 / (100 + Math.max(0, protection));
}

/** Critical damage uses the character scale: 150 = x1.5, never below x1. */
export function criticalMultiplier(critDamage: number) {
  return Math.max(1, critDamage / 100);
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

/**
 * One creature attack against a character. The attack style decides which
 * evasion can avoid it; physical, magic and elemental damage are each reduced
 * by their own defence before a critical hit and a block are applied.
 */
export function resolveCreatureStrike(
  creature: CreatureAttackProfile,
  defenses: CharacterDefenses,
  random: () => number,
): CreatureStrike {
  if (
    random() <
    percentChance(evasionForStyle(creature.attackStyle, defenses), 75)
  ) {
    return { damage: 0, evaded: true, blocked: false, critical: false };
  }
  const blocked = random() < percentChance(defenses.blockChance, 75);
  let damage =
    rollInclusive(creature.damageMin, creature.damageMax, random) *
      protectionMultiplier(defenses.armor) +
    rollInclusive(creature.magicDamageMin, creature.magicDamageMax, random) *
      protectionMultiplier(defenses.magicResist);
  if (creature.damageType) {
    const resistance = clampNumber(
      resistanceFor(creature.damageType, defenses),
      -100,
      75,
    );
    damage +=
      rollInclusive(
        creature.elementalDamageMin,
        creature.elementalDamageMax,
        random,
      ) *
      (1 - resistance / 100);
  }
  const critical = random() < percentChance(creature.critChance, 100);
  if (critical) damage *= criticalMultiplier(creature.critDamage);
  if (blocked) damage *= 0.5;
  return { damage, evaded: false, blocked, critical };
}
