import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { dungeonSchema, validateDungeonReferences } from "./schema";

export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
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
    const dungeon = await prisma.dungeon.create({
      data: { ...data, monsters: { create: monsters } },
    });
    return NextResponse.json({ ok: true, dungeon });
  } catch {
    return NextResponse.json(
      { error: "That location already has a dungeon with this name" },
      { status: 400 },
    );
  }
}
