import { type NextRequest, NextResponse } from "next/server";
import { CreatureKind } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { groundSchema } from "../schema";

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Invalid hunting ground id" },
      { status: 400 },
    );
  }
  const parsed = groundSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { creatures, ...data } = parsed.data;
  const animalCount = await prisma.creature.count({
    where: {
      id: { in: creatures.map((row) => row.creatureId) },
      kind: CreatureKind.ANIMAL,
    },
  });
  if (animalCount !== creatures.length) {
    return NextResponse.json(
      { error: "One or more creatures are not animals" },
      { status: 400 },
    );
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.huntingGround.update({ where: { id }, data });
      await tx.huntingGroundCreature.deleteMany({
        where: {
          groundId: id,
          ...(creatures.length
            ? { creatureId: { notIn: creatures.map((row) => row.creatureId) } }
            : {}),
        },
      });
      for (const assignment of creatures) {
        await tx.huntingGroundCreature.upsert({
          where: {
            groundId_creatureId: {
              groundId: id,
              creatureId: assignment.creatureId,
            },
          },
          create: { groundId: id, ...assignment },
          update: assignment,
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to save hunting ground" },
      { status: 400 },
    );
  }
}
