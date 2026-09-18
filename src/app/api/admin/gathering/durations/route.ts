import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const gatheringDurationSchema = z.object({
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

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;

  const parsed = gatheringDurationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  try {
    const duration = await prisma.gatheringDuration.create({
      data: parsed.data,
    });
    return NextResponse.json({ ok: true, duration });
  } catch {
    return NextResponse.json(
      { error: "A duration with that label or time already exists" },
      { status: 400 },
    );
  }
}
