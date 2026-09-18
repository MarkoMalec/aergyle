import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { dungeonSchema, validateDungeonReferences } from "../schema";

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
    return NextResponse.json({ error: "Invalid dungeon id" }, { status: 400 });
  }
  const parsed = dungeonSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const invalid = await validateDungeonReferences(parsed.data);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const { monsters, ...data } = parsed.data;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.dungeon.update({ where: { id }, data });
      await tx.dungeonMonster.deleteMany({
        where: {
          dungeonId: id,
          ...(monsters.length
            ? { creatureId: { notIn: monsters.map((row) => row.creatureId) } }
            : {}),
        },
      });
      for (const { creatureId, ...population } of monsters) {
        await tx.dungeonMonster.upsert({
          where: { dungeonId_creatureId: { dungeonId: id, creatureId } },
          create: { dungeonId: id, creatureId, ...population },
          update: population,
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to save dungeon; is the name unique for its location?" },
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
  const id = parseId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid dungeon id" }, { status: 400 });
  }
  const activeRuns = await prisma.userDungeonRun.count({
    where: { dungeonId: id, claimedAt: null },
  });
  if (activeRuns > 0) {
    return NextResponse.json(
      {
        error: `${activeRuns} character${activeRuns === 1 ? " is" : "s are"} inside this dungeon. Disable it instead, then delete it once they return.`,
      },
      { status: 409 },
    );
  }
  try {
    // Claimed run journals for this dungeon are removed with it.
    await prisma.dungeon.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Dungeon not found" }, { status: 404 });
  }
}
