import { z } from "zod";

const assignmentSchema = z.object({
  creatureId: z.number().int().positive(),
  enabled: z.boolean(),
  encounterWeight: z.number().min(0.001).max(10_000),
});

export const groundSchema = z
  .object({
    locationId: z.number().int().positive(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).nullable(),
    requiredHuntingLevel: z.number().int().min(1).max(10_000),
    enabled: z.boolean(),
    sortOrder: z.number().int().min(-10_000).max(10_000),
    accidentChance: z.number().min(0).max(1),
    accidentDamageMin: z.number().int().min(0).max(1_000_000),
    accidentDamageMax: z.number().int().min(0).max(1_000_000),
    creatures: z.array(assignmentSchema).max(500),
  })
  .refine((ground) => ground.accidentDamageMax >= ground.accidentDamageMin, {
    message: "Maximum accident damage must be at least the minimum",
    path: ["accidentDamageMax"],
  })
  .refine(
    (ground) =>
      new Set(ground.creatures.map((row) => row.creatureId)).size ===
      ground.creatures.length,
    { message: "Each animal may appear only once in a hunting ground" },
  );
