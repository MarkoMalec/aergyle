import type { Prisma } from "~/generated/prisma/client";
import {
  CreatureAttackStyle,
  CreatureDamageType,
} from "~/generated/prisma/enums";
import type { CreatureAttackProfile } from "~/server/combat/rules";

/** Creature columns that make up its attack, for Hunting and dungeons. */
export const CREATURE_ATTACK_SELECT = {
  attackStyle: true,
  damageMin: true,
  damageMax: true,
  magicDamageMin: true,
  magicDamageMax: true,
  damageType: true,
  elementalDamageMin: true,
  elementalDamageMax: true,
  critChance: true,
  critDamage: true,
} satisfies Prisma.CreatureSelect;

function range(minimum: number, maximum: number) {
  const low = Math.max(0, minimum);
  return { min: low, max: Math.max(low, maximum) };
}

/** Normalizes a creature row into a snapshot-safe attack profile. */
export function toCreatureAttackProfile(
  creature: CreatureAttackProfile,
): CreatureAttackProfile {
  const physical = range(creature.damageMin, creature.damageMax);
  const magic = range(creature.magicDamageMin, creature.magicDamageMax);
  const elemental = range(
    creature.elementalDamageMin,
    creature.elementalDamageMax,
  );
  return {
    attackStyle: creature.attackStyle,
    damageMin: physical.min,
    damageMax: physical.max,
    magicDamageMin: magic.min,
    magicDamageMax: magic.max,
    damageType: creature.damageType,
    elementalDamageMin: elemental.min,
    elementalDamageMax: elemental.max,
    critChance: Math.max(0, creature.critChance),
    critDamage: Math.max(0, creature.critDamage),
  };
}

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

/**
 * Reads an attack profile from a departure snapshot. Fields added after a
 * snapshot was taken default to 0, so older hunts still resolve.
 */
export function parseCreatureAttackProfile(
  row: Record<string, unknown>,
): CreatureAttackProfile | null {
  const damageType = row.damageType ?? null;
  if (
    !Object.values(CreatureAttackStyle).includes(
      row.attackStyle as CreatureAttackStyle,
    ) ||
    (damageType !== null &&
      !Object.values(CreatureDamageType).includes(
        damageType as CreatureDamageType,
      ))
  ) {
    return null;
  }
  return toCreatureAttackProfile({
    attackStyle: row.attackStyle as CreatureAttackStyle,
    damageMin: finite(row.damageMin),
    damageMax: finite(row.damageMax),
    magicDamageMin: finite(row.magicDamageMin),
    magicDamageMax: finite(row.magicDamageMax),
    damageType: damageType as CreatureDamageType | null,
    elementalDamageMin: finite(row.elementalDamageMin),
    elementalDamageMax: finite(row.elementalDamageMax),
    critChance: finite(row.critChance),
    critDamage: finite(row.critDamage),
  });
}
