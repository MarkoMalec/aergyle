import type {
  CreatureAttackStyle,
  CreatureDamageType,
  CreatureKind,
  DungeonDifficulty,
} from "~/generated/prisma/enums";

export const ATTACK_STYLE_LABELS: Record<CreatureAttackStyle, string> = {
  MELEE: "Melee",
  RANGED: "Ranged",
  MAGIC: "Magic",
};

export const DAMAGE_TYPE_LABELS: Record<CreatureDamageType, string> = {
  FIRE: "Fire",
  ICE: "Ice",
  LIGHTNING: "Lightning",
  POISON: "Poison",
};

export const DUNGEON_DIFFICULTY_LABELS: Record<DungeonDifficulty, string> = {
  EASY: "Easy",
  NORMAL: "Normal",
  HARD: "Hard",
  DEADLY: "Deadly",
};

export const BESTIARY_PATHS: Record<CreatureKind, string> = {
  ANIMAL: "/animals",
  MONSTER: "/monsters",
};

export function bestiaryHref(kind: CreatureKind, creatureId: number) {
  return `${BESTIARY_PATHS[kind]}/${creatureId}`;
}

type AttackDamage = {
  damageMin: number;
  damageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  damageType: CreatureDamageType | null;
  elementalDamageMin: number;
  elementalDamageMax: number;
};

/** Damage components a creature deals, e.g. ["1–3 physical", "2–4 fire"]. */
export function describeCreatureDamage(creature: AttackDamage) {
  const parts: Array<{ label: string; min: number; max: number }> = [
    { label: "physical", min: creature.damageMin, max: creature.damageMax },
    {
      label: "magic",
      min: creature.magicDamageMin,
      max: creature.magicDamageMax,
    },
  ];
  if (creature.damageType) {
    parts.push({
      label: DAMAGE_TYPE_LABELS[creature.damageType].toLowerCase(),
      min: creature.elementalDamageMin,
      max: creature.elementalDamageMax,
    });
  }
  return parts
    .filter((part) => part.max > 0)
    .map((part) => `${part.min}–${part.max} ${part.label}`);
}
