import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

const schema = z
  .object({
    armorK0: z.number().finite().min(0).max(1_000_000),
    armorK1: z.number().finite().min(0).max(100_000),
  })
  .refine((config) => config.armorK0 + config.armorK1 > 0, {
    message: "Armor K must be above 0 at level 1",
  });

// Activities snapshot K when they start, so saving affects only new runs.
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
  const config = await prisma.combatConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ ok: true, config });
}
