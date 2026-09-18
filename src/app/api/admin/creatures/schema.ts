import { z } from "zod";
import {
  CreatureAttackStyle,
  CreatureDamageType,
  CreatureKind,
} from "~/generated/prisma/enums";

const values = <T extends string>(record: Record<string, T>) =>
  Object.values(record) as [T, ...T[]];

const whole = (maximum: number) => z.number().int().min(0).max(maximum);

const dropSchema = z
  .object({
    itemId: z.number().int().positive(),
    enabled: z.boolean(),
    baseChance: z.number().min(0).max(1),
    minQuantity: z.number().int().min(1).max(10_000),
    maxQuantity: z.number().int().min(1).max(10_000),
    requiredLevel: z.number().int().min(1).max(10_000),
  })
  .refine((drop) => drop.maxQuantity >= drop.minQuantity, {
    message: "Maximum drop quantity must be at least the minimum",
  });

export const creatureSchema = z
  .object({
    kind: z.enum(values(CreatureKind)),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).nullable(),
    asset: z.string().trim().min(1).max(500),
    enabled: z.boolean(),
    attackStyle: z.enum(values(CreatureAttackStyle)),
    attackChance: z.number().min(0).max(1),
    damageMin: whole(1_000_000),
    damageMax: whole(1_000_000),
    magicDamageMin: whole(1_000_000),
    magicDamageMax: whole(1_000_000),
    damageType: z.enum(values(CreatureDamageType)).nullable(),
    elementalDamageMin: whole(1_000_000),
    elementalDamageMax: whole(1_000_000),
    health: whole(100_000_000),
    armor: z.number().min(0).max(1_000_000),
    magicResist: z.number().min(0).max(1_000_000),
    evasion: z.number().min(0).max(75),
    blockChance: z.number().min(0).max(75),
    critChance: z.number().min(0).max(100),
    critDamage: z.number().min(0).max(10_000),
    drops: z.array(dropSchema).max(100),
  })
  .refine((creature) => creature.damageMax >= creature.damageMin, {
    message: "Maximum physical damage must be at least the minimum",
    path: ["damageMax"],
  })
  .refine((creature) => creature.magicDamageMax >= creature.magicDamageMin, {
    message: "Maximum magic damage must be at least the minimum",
    path: ["magicDamageMax"],
  })
  .refine(
    (creature) => creature.elementalDamageMax >= creature.elementalDamageMin,
    {
      message: "Maximum elemental damage must be at least the minimum",
      path: ["elementalDamageMax"],
    },
  )
  .refine(
    (creature) =>
      creature.kind !== CreatureKind.MONSTER || creature.health >= 1,
    { message: "Monsters need at least 1 health", path: ["health"] },
  )
  .refine(
    (creature) =>
      new Set(creature.drops.map((drop) => drop.itemId)).size ===
      creature.drops.length,
    { message: "Each item may appear only once in a creature drop table" },
  );

export type CreatureInput = z.infer<typeof creatureSchema>;

export function creatureLabel(kind: CreatureKind) {
  return kind === CreatureKind.MONSTER ? "monster" : "animal";
}

export function dropItemWhere(input: CreatureInput) {
  return { id: { in: input.drops.map((drop) => drop.itemId) } };
}
