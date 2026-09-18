import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { creatureLabel, creatureSchema, dropItemWhere } from "../schema";

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid creature id" }, { status: 400 });
  }
  const parsed = creatureSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const existing = await prisma.creature.findUnique({
    where: { id },
    select: { kind: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Creature not found" }, { status: 404 });
  }
  // Kind is fixed at creation: hunting grounds and dungeons filter by it.
  const { drops, kind, ...data } = parsed.data;
  if (existing.kind !== kind) {
    return NextResponse.json(
      { error: `This creature is not a ${creatureLabel(kind)}` },
      { status: 400 },
    );
  }
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
    await prisma.$transaction(async (tx) => {
      await tx.creature.update({ where: { id }, data });
      await tx.creatureDrop.deleteMany({
        where: {
          creatureId: id,
          ...(drops.length
            ? { itemId: { notIn: drops.map((drop) => drop.itemId) } }
            : {}),
        },
      });
      for (const drop of drops) {
        await tx.creatureDrop.upsert({
          where: { creatureId_itemId: { creatureId: id, itemId: drop.itemId } },
          create: { creatureId: id, ...drop },
          update: drop,
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: `Unable to save ${creatureLabel(kind)}; is the name unique?` },
      { status: 400 },
    );
  }
}

// Removes the creature with its drop table, hunting-ground and dungeon
// placements. Active hunts and dungeon runs keep their departure snapshots.
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = parseId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid creature id" }, { status: 400 });
  }
  try {
    await prisma.creature.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Creature not found" }, { status: 404 });
  }
}
