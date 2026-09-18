import { type NextRequest, NextResponse } from "next/server";
import { CreatureKind } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { groundSchema } from "./schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = groundSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { creatures, ...data } = parsed.data;
  const [location, animalCount] = await Promise.all([
    prisma.location.findUnique({
      where: { id: data.locationId },
      select: { id: true },
    }),
    prisma.creature.count({
      where: {
        id: { in: creatures.map((row) => row.creatureId) },
        kind: CreatureKind.ANIMAL,
      },
    }),
  ]);
  if (!location)
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  if (animalCount !== creatures.length) {
    return NextResponse.json(
      { error: "One or more creatures are not animals" },
      { status: 400 },
    );
  }
  try {
    const ground = await prisma.huntingGround.create({
      data: { ...data, creatures: { create: creatures } },
    });
    return NextResponse.json({ ok: true, ground });
  } catch {
    return NextResponse.json(
      { error: "That location already has a hunting ground with this name" },
      { status: 400 },
    );
  }
}
