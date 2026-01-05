import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const skillSchema = z.object({
  skill_name: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const skill = await prisma.skills.findUnique({ where: { skill_id: id } });
  if (!skill) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(skill);
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = skillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const v = parsed.data;

  try {
    const updated = await prisma.skills.update({
      where: { skill_id: id },
      data: {
        skill_name: v.skill_name,
        description: v.description?.trim() ? v.description.trim() : null,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to update skill (name may already exist)" },
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
    await prisma.skills.delete({ where: { skill_id: id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to delete skill (it may be referenced by users)" },
      { status: 400 },
    );
  }
}
