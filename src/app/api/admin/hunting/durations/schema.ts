import { z } from "zod";

export const huntingDurationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  durationSeconds: z
    .number()
    .int()
    .min(60)
    .max(7 * 24 * 60 * 60),
  encounterRolls: z.number().int().min(1).max(100),
  quantityMultiplier: z.number().min(0.1).max(20),
  dangerMultiplier: z.number().min(0).max(10),
  xpReward: z.number().int().min(0).max(10_000_000),
  requiredHuntingLevel: z.number().int().min(1).max(10_000),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(-10_000).max(10_000),
});
