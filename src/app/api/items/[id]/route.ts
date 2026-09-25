import { NextResponse, type NextRequest } from "next/server";
import { ItemRarity } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import {
  hydrateEffectiveItemStats,
  ITEM_BALANCE_RELATIONS,
} from "~/server/items/effectiveStats";

function isRarity(value: string | null): value is ItemRarity {
  return Object.values(ItemRarity).includes(value as ItemRarity);
}

/**
 * An item template's details as players see them, at `?rarity=` (default: the
 * template's own rarity). Stats go through the same resolver as inventory items,
 * so every item card shows the same numbers.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const requestedRarity = request.nextUrl.searchParams.get("rarity");
  if (requestedRarity !== null && !isRarity(requestedRarity)) {
    return NextResponse.json({ error: "Invalid rarity" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      sprite: true,
      itemType: true,
      description: true,
      price: true,
      equipTo: true,
      requiredLevel: true,
      rarity: true,
      healingAmount: true,
      foodEffectSeconds: true,
      foodEffectStats: {
        select: { statType: true, value: true },
        orderBy: [{ statType: "asc" }],
      },
      flipNegativeStatsWithRarity: true,
      ...ITEM_BALANCE_RELATIONS,
      seedGrowSeconds: true,
      seedHarvestSeconds: true,
      seedXp: true,
      seedYieldMin: true,
      seedYieldMax: true,
      seedYieldItem: {
        select: { id: true, name: true, sprite: true, rarity: true },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const rarity = requestedRarity ?? item.rarity;
  const [effective] = await hydrateEffectiveItemStats([
    { rarity, itemTemplate: item, statModifiers: [] },
  ]);

  return NextResponse.json({
    id: item.id,
    name: item.name,
    sprite: item.sprite,
    itemType: item.itemType,
    description: item.description,
    price: item.price,
    equipTo: item.equipTo,
    requiredLevel: item.requiredLevel,
    rarity,
    stats: effective?.stats ?? [],
    healingAmount: item.healingAmount,
    foodEffectSeconds: item.foodEffectSeconds,
    foodEffectStats: item.foodEffectStats,
    seedGrowSeconds: item.seedGrowSeconds,
    seedHarvestSeconds: item.seedHarvestSeconds,
    seedXp: item.seedXp,
    seedYieldMin: item.seedYieldMin,
    seedYieldMax: item.seedYieldMax,
    seedYieldItem: item.seedYieldItem,
  });
}
