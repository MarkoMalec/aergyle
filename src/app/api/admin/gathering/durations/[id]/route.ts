import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { gatheringDurationSchema } from "../schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
