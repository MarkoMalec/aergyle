import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { creatureSchema, dropItemWhere } from "./schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = creatureSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { drops, ...data } = parsed.data;
  const validItems = await prisma.item.count({
    where: dropItemWhere(parsed.data),
  });
  if (validItems !== drops.length) {
    return NextResponse.json(
      { error: "Every drop must reference an existing item" },
      { status: 400 },
    );
  }
  try {
    const creature = await prisma.creature.create({
      data: { ...data, drops: { create: drops } },
    });
    return NextResponse.json({ ok: true, creature });
  } catch {
    return NextResponse.json(
      { error: `A creature named "${data.name}" already exists` },
      { status: 400 },
    );
  }
}
