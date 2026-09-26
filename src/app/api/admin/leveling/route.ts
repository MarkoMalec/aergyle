import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { LevelCurve } from "~/generated/prisma/enums";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { saveCurveDesign } from "~/server/balance/leveling";

const finite = z.number().finite();

const schema = z.object({
  curve: z.nativeEnum(LevelCurve),
  design: z.object({
    maxLevel: z.number().int(),
    firstLevelXp: finite,
    power: finite,
    growthPercent: finite,
    bands: z.array(
      z.object({
        fromLevel: z.number().int(),
        toLevel: z.number().int(),
        multiplier: finite,
      }),
    ),
    targets: z.array(z.object({ level: z.number().int(), days: finite })),
  }),
});

// Regenerates the curve's thresholds and every player's level on it.
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
  try {
    await saveCurveDesign(parsed.data.curve, parsed.data.design);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save" },
      { status: 400 },
    );
  }
}
