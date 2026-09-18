import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { StatType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { LEVEL_SCALED_STAT_TYPES } from "~/utils/stats";

const ruleSchema = z.object({
  statType: z
    .nativeEnum(StatType)
    .refine((statType) => LEVEL_SCALED_STAT_TYPES.includes(statType), {
      message: "This stat does not scale with level",
    }),
  baseValue: z.number().finite(),
  perLevel: z.number().finite().min(0, "Per-level gain cannot be negative"),
  maxBonus: z
    .number()
    .finite()
    .min(0, "Level bonus cap cannot be negative")
    .nullable(),
});

const schema = z.object({
  rules: z
    .array(ruleSchema)
    .min(1)
    .refine(
      (rules) =>
        new Set(rules.map((rule) => rule.statType)).size === rules.length,
      { message: "Each stat can be saved only once" },
    ),
});

// Rules are read live for every character, so saving applies immediately to
// all existing characters at their current level.
export async function PATCH(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { rules } = parsed.data;
  // Two statements regardless of how many stats are saved. One upsert per stat
  // took ~7s against the remote database and hit the 5s transaction limit.
  await prisma.$transaction([
    prisma.characterStatGrowth.deleteMany({
      where: { statType: { in: rules.map((rule) => rule.statType) } },
    }),
    prisma.characterStatGrowth.createMany({ data: rules }),
  ]);
  return NextResponse.json({ ok: true });
}
