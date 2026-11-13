import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { EnchantKind, enchantLevelsFor } from "~/game/enchanting";

export const dynamic = "force-dynamic";

const levelSchema = z.object({
  kind: z.nativeEnum(EnchantKind),
  level: z.number().int(),
  successChance: z.number().min(0).max(1),
  goldCost: z.number().int().min(0),
  statBonusPercent: z.number().min(0),
  dropOnFail: z.boolean(),
  materials: z.array(
    z.object({
      itemId: z.number().int(),
      quantity: z.number().int().min(1),
    }),
  ),
});

const schema = z.object({
  globals: z.object({
    pityPerFailure: z.number().min(0).max(1),
    pityCap: z.number().min(0).max(1),
    levelCostDivisor: z.number().int().min(1),
  }),
  levels: z.array(levelSchema).max(40),
});

export async function PATCH(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { globals, levels } = parsed.data;

  const seen = new Set<string>();
  for (const row of levels) {
    const key = `${row.kind}:${row.level}`;
    if (!enchantLevelsFor(row.kind).includes(row.level) || seen.has(key)) {
      return NextResponse.json(
        { error: `Invalid or duplicate level: ${key}` },
        { status: 400 },
      );
    }
    seen.add(key);
    if (new Set(row.materials.map((m) => m.itemId)).size !== row.materials.length) {
      return NextResponse.json(
        { error: `Duplicate material on ${key}` },
        { status: 400 },
      );
    }
  }

  const itemIds = [...new Set(levels.flatMap((r) => r.materials.map((m) => m.itemId)))];
  const found = await prisma.item.count({ where: { id: { in: itemIds } } });
  if (found !== itemIds.length) {
    return NextResponse.json({ error: "A material item does not exist" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.enchantConfig.upsert({
      where: { id: 1 },
      create: { id: 1, ...globals },
      update: globals,
    }),
    ...levels.map(({ materials, ...row }) => {
      // Accessories always break on failure.
      const data = {
        ...row,
        dropOnFail: row.kind === EnchantKind.ACCESSORY ? false : row.dropOnFail,
      };
      return prisma.enchantLevelConfig.upsert({
        where: { kind_level: { kind: row.kind, level: row.level } },
        create: { ...data, materials: { create: materials } },
        update: { ...data, materials: { deleteMany: {}, create: materials } },
      });
    }),
  ]);
  return NextResponse.json({ ok: true });
}
