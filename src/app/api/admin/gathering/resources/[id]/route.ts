import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ItemRarity, VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RARITIES = Object.values(ItemRarity) as [ItemRarity, ...ItemRarity[]];
const patchSchema = z.object({
  requiredSkillLevel: z.number().int().min(1).max(10_000),
  rarity: z.enum(RARITIES),
});

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid resource id" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const resource = await prisma.vocationalResource.findUnique({
    where: { id },
    select: { actionType: true },
  });
  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }
  if (resource.actionType !== VocationalActionType.GATHERING) {
    return NextResponse.json(
      { error: "Resource is not a Gathering resource" },
      { status: 400 },
    );
  }

  const updated = await prisma.vocationalResource.update({
    where: { id },
    data: parsed.data,
    select: { id: true, requiredSkillLevel: true, rarity: true },
  });
  return NextResponse.json({ ok: true, resource: updated });
}
