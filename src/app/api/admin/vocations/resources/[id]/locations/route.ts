import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  locationIds: z.array(z.number().int().positive()).default([]),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const resourceId = Number(ctx.params.id);
  if (!Number.isFinite(resourceId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const selected = new Set(parsed.data.locationIds);

  await prisma.$transaction(async (tx) => {
    await tx.locationVocationalResource.updateMany({
      where: { resourceId },
      data: { enabled: false },
    });

    for (const locationId of selected) {
      await tx.locationVocationalResource.upsert({
        where: {
          locationId_resourceId: { locationId, resourceId },
        },
        create: { locationId, resourceId, enabled: true },
        update: { enabled: true },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
