import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const updateSchema = z.object({
  name: z.string().min(1),
});

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      resources: {
        include: {
          resource: { include: { item: true } },
        },
        orderBy: [{ resourceId: "asc" }],
      },
    },
  });

  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(location);
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const updated = await prisma.location.update({
      where: { id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update location (name must be unique)" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.location.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete location (it may be referenced by users/activities/resources)" },
      { status: 400 },
    );
  }
}
