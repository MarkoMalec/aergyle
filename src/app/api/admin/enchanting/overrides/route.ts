import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { enchantKindOf, enchantLevelsFor } from "~/game/enchanting";

export const dynamic = "force-dynamic";

const setSchema = z.object({
  itemId: z.number().int(),
  // The item's full override list; levels left out are removed.
  overrides: z
    .array(z.object({ level: z.number().int(), successChance: z.number().min(0).max(1) }))
    .max(20),
});
const deleteSchema = z.object({ itemId: z.number().int(), level: z.number().int() });

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = setSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.errors[0]?.message ?? "Invalid request");
  const { itemId, overrides } = parsed.data;

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { equipTo: true, stackable: true },
  });
  const kind = item ? enchantKindOf(item) : null;
  if (!kind) return bad("That item cannot be enchanted");
  const levels = enchantLevelsFor(kind);
  if (
    overrides.some((o) => !levels.includes(o.level)) ||
    new Set(overrides.map((o) => o.level)).size !== overrides.length
  ) {
    return bad("Invalid or duplicate level");
  }

  await prisma.$transaction([
    prisma.itemEnchantChanceOverride.deleteMany({ where: { itemId } }),
    prisma.itemEnchantChanceOverride.createMany({
      data: overrides.map((o) => ({ itemId, ...o })),
    }),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.errors[0]?.message ?? "Invalid request");
  await prisma.itemEnchantChanceOverride.deleteMany({ where: parsed.data });
  return NextResponse.json({ ok: true });
}
