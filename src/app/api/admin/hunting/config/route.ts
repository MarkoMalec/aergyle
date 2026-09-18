import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

const schema = z
  .object({
    damageEnabled: z.boolean(),
    globalDangerMultiplier: z.number().min(0).max(10),
    maxHealthLossPercent: z.number().min(0).max(100),
    minimumRemainingHealthPercent: z.number().min(0).max(100),
    minimumHealthToStartPercent: z.number().min(0).max(100),
  })
  .refine(
    (value) =>
      value.minimumRemainingHealthPercent <= value.minimumHealthToStartPercent,
    {
      message: "The start threshold must be at least the safety floor",
      path: ["minimumHealthToStartPercent"],
    },
  );

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
  const config = await prisma.huntingConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ ok: true, config });
}
