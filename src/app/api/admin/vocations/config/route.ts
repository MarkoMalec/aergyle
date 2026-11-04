import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { VOCATION_DURATION_LIMITS_SECONDS } from "~/server/vocations/constants";

const schema = z.object({
  maxDurationSeconds: z
    .number()
    .int()
    .min(VOCATION_DURATION_LIMITS_SECONDS.min)
    .max(VOCATION_DURATION_LIMITS_SECONDS.max),
});

// Runs snapshot their end time when they start, so saving affects only new runs.
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
  const config = await prisma.vocationConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ ok: true, config });
}
