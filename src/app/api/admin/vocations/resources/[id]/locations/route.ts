import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  locationIds: z.array(z.number().int().positive()).default([]),
  // Shortcut for "available everywhere": the server resolves the location list,
  // so the caller does not have to know every location id.
  allLocations: z.boolean().default(false),
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

  const selected = parsed.data.allLocations
    ? (await prisma.location.findMany({ select: { id: true } })).map(
        (location) => location.id,
      )
    : Array.from(new Set(parsed.data.locationIds));

  await prisma.$transaction([
    prisma.locationVocationalResource.updateMany({
      where:
        selected.length > 0
          ? { resourceId, locationId: { notIn: selected } }
          : { resourceId },
      data: { enabled: false },
    }),
    ...(selected.length > 0
      ? [
          prisma.locationVocationalResource.updateMany({
            where: { resourceId, locationId: { in: selected } },
            data: { enabled: true },
          }),
          // Locations the resource has never been assigned to need a row;
          // existing rows were just re-enabled above and are skipped here.
          prisma.locationVocationalResource.createMany({
            data: selected.map((locationId) => ({
              locationId,
              resourceId,
              enabled: true,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ ok: true, locationIds: selected });
}
