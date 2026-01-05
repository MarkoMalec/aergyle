import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { ItemRarity } from "~/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const configSchema = z.object({
  id: z.number().int(),
  rarity: z.nativeEnum(ItemRarity),
  statMultiplier: z.number(),
  minStats: z.number().int(),
  maxStats: z.number().int(),
  bonusStatChance: z.number(),
  color: z.string(),
  displayName: z.string(),
  sortOrder: z.number().int(),
  upgradeEnabled: z.boolean(),
  nextRarity: z.nativeEnum(ItemRarity).nullable(),
  upgradeCost: z.number().int().nullable(),
});

const bodySchema = z.object({
  configs: z.array(configSchema),
});

export async function GET(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const configs = await prisma.rarityConfig.findMany({
    orderBy: [{ sortOrder: "asc" }],
  });

  return NextResponse.json(configs);
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const configs = parsed.data.configs;

  // Upsert per rarity (unique). Ignore provided id for matching.
  await prisma.$transaction(
    configs.map((c) =>
      prisma.rarityConfig.upsert({
        where: { rarity: c.rarity },
        create: {
          rarity: c.rarity,
          statMultiplier: c.statMultiplier,
          minStats: c.minStats,
          maxStats: c.maxStats,
          bonusStatChance: c.bonusStatChance,
          color: c.color,
          displayName: c.displayName,
          sortOrder: c.sortOrder,
          upgradeEnabled: c.upgradeEnabled,
          nextRarity: c.nextRarity,
          upgradeCost: c.upgradeCost,
        },
        update: {
          statMultiplier: c.statMultiplier,
          minStats: c.minStats,
          maxStats: c.maxStats,
          bonusStatChance: c.bonusStatChance,
          color: c.color,
          displayName: c.displayName,
          sortOrder: c.sortOrder,
          upgradeEnabled: c.upgradeEnabled,
          nextRarity: c.nextRarity,
          upgradeCost: c.upgradeCost,
        },
      }),
    ),
  );

  const updated = await prisma.rarityConfig.findMany({
    orderBy: [{ sortOrder: "asc" }],
  });

  return NextResponse.json(updated);
}
