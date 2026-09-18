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

function durationId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = durationId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid duration id" }, { status: 400 });
  }

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
    const duration = await prisma.gatheringDuration.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ ok: true, duration });
  } catch {
    return NextResponse.json(
      { error: "Unable to save; check that the label and time are unique" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = durationId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid duration id" }, { status: 400 });
  }

  try {
    await prisma.gatheringDuration.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Duration not found" }, { status: 404 });
  }
}
