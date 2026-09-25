import { z } from "zod";

export const gatheringDurationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  durationSeconds: z
    .number()
    .int()
    .min(60)
    .max(7 * 24 * 60 * 60),
  rewardRolls: z.number().int().min(1).max(100),
  quantityMultiplier: z.number().min(0.1).max(20),
  xpReward: z.number().int().min(0).max(10_000_000),
  requiredGatheringLevel: z.number().int().min(0).max(10_000),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(-10_000).max(10_000),
});
