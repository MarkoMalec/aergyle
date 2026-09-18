import { z } from "zod";
import { CreatureKind, DungeonDifficulty } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { MAX_DUNGEON_PACK_SIZE } from "~/server/dungeons/resolver";

const DIFFICULTIES = Object.values(DungeonDifficulty) as [
  DungeonDifficulty,
  ...DungeonDifficulty[],
];

const populationSchema = z
  .object({
    creatureId: z.number().int().positive(),
    enabled: z.boolean(),
    minCount: z.number().int().min(0).max(1_000),
    maxCount: z.number().int().min(1).max(1_000),
  })
  .refine((row) => row.maxCount >= row.minCount, {
    message: "Maximum monster count must be at least the minimum",
  });

export const dungeonSchema = z
  .object({
    locationId: z.number().int().positive(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).nullable(),
    difficulty: z.enum(DIFFICULTIES),
    requiredLevel: z.number().int().min(1).max(10_000),
    durationSeconds: z
      .number()
      .int()
      .min(60)
      .max(7 * 24 * 60 * 60),
    packSize: z.number().int().min(1).max(MAX_DUNGEON_PACK_SIZE),
    xpReward: z.number().int().min(0).max(10_000_000),
    enabled: z.boolean(),
    sortOrder: z.number().int().min(-10_000).max(10_000),
    monsters: z.array(populationSchema).max(100),
  })
  .refine(
    (dungeon) =>
      new Set(dungeon.monsters.map((row) => row.creatureId)).size ===
      dungeon.monsters.length,
    { message: "Each monster may appear only once in a dungeon" },
  );

export type DungeonInput = z.infer<typeof dungeonSchema>;

/** Returns an error message when the location or a monster is invalid. */
export async function validateDungeonReferences(input: DungeonInput) {
  const [location, monsterCount] = await Promise.all([
    prisma.location.findUnique({
      where: { id: input.locationId },
      select: { id: true },
    }),
    prisma.creature.count({
      where: {
        id: { in: input.monsters.map((row) => row.creatureId) },
        kind: CreatureKind.MONSTER,
      },
    }),
  ]);
  if (!location) return "Location not found";
  if (monsterCount !== input.monsters.length) {
    return "Dungeons can only contain monsters";
  }
  return null;
}
