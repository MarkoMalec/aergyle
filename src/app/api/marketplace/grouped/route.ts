import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ItemRarity as ItemRarityValues,
  ItemType as ItemTypeValues,
} from "~/generated/prisma/enums";
import type { ItemRarity, ItemType } from "~/generated/prisma/enums";
import type { Prisma } from "~/generated/prisma/client";
import { roundGold } from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";

export const dynamic = "force-dynamic";

function enumValue<T extends string>(
  value: string | null,
  values: Record<string, T>,
): T | null {
  return value != null && (Object.values(values) as string[]).includes(value)
    ? (value as T)
    : null;
}

/** One honest row per item + rarity market, never a mixed-rarity price range. */
export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const rarity = enumValue<ItemRarity>(
      params.get("rarity"),
      ItemRarityValues,
    );
    const itemType = enumValue<ItemType>(
      params.get("itemType"),
      ItemTypeValues,
    );
    const search = params.get("search")?.trim() ?? "";
    const page = Math.max(
      1,
      Number.parseInt(params.get("page") ?? "1", 10) || 1,
    );
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(params.get("limit") ?? "40", 10) || 40),
    );
    const sortOrder: Prisma.SortOrder =
      params.get("sortOrder") === "desc" ? "desc" : "asc";
    const sortBy = params.get("sortBy") ?? "price";

    const minPrice = Number(params.get("minPrice"));
    const maxPrice = Number(params.get("maxPrice"));
    const listedPrice: Prisma.FloatNullableFilter = { not: null };
    if (params.has("minPrice") && Number.isFinite(minPrice)) {
      listedPrice.gte = Math.max(0, minPrice);
    }
    if (params.has("maxPrice") && Number.isFinite(maxPrice)) {
      listedPrice.lte = Math.max(0, maxPrice);
    }

    const where: Prisma.UserItemWhereInput = {
      status: "LISTED",
      isTradeable: true,
      listedPrice,
      ...(rarity ? { rarity } : {}),
      ...(itemType != null || search.length > 0
        ? {
            itemTemplate: {
              ...(itemType ? { itemType } : {}),
              ...(search ? { name: { contains: search } } : {}),
            },
          }
        : {}),
    };

    const orderBy =
      sortBy === "supply"
        ? ({ _sum: { quantity: sortOrder } } as const)
        : sortBy === "listings"
          ? ({ _count: { itemId: sortOrder } } as const)
          : ({ _min: { listedPrice: sortOrder } } as const);

    const [grouped, activeItemTypes, activeRarities] = await Promise.all([
      prisma.userItem.groupBy({
        by: ["itemId", "rarity"],
        where,
        _min: { listedPrice: true },
        _max: { listedPrice: true },
        _sum: { quantity: true },
        _count: { _all: true },
        orderBy,
        skip: (page - 1) * limit,
        take: limit + 1,
      }),
      prisma.item.findMany({
        where: {
          itemType: { not: null },
          userItems: {
            some: {
              status: "LISTED",
              isTradeable: true,
              listedPrice: { not: null },
            },
          },
        },
        select: { itemType: true },
        distinct: ["itemType"],
      }),
      prisma.userItem.findMany({
        where: {
          status: "LISTED",
          isTradeable: true,
          listedPrice: { not: null },
        },
        select: { rarity: true },
        distinct: ["rarity"],
      }),
    ]);
    const hasNextPage = grouped.length > limit;
    const pageGroups = hasNextPage ? grouped.slice(0, limit) : grouped;
    const itemIds = [...new Set(pageGroups.map((group) => group.itemId))];

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [items, bids, volume] = await Promise.all([
      prisma.item.findMany({
        where: { id: { in: itemIds } },
        select: {
          id: true,
          name: true,
          sprite: true,
          itemType: true,
          equipTo: true,
          stackable: true,
        },
      }),
      prisma.marketBuyOrder.groupBy({
        by: ["itemId", "rarity"],
        where: {
          itemId: { in: itemIds },
          status: "OPEN",
          remainingQuantity: { gt: 0 },
        },
        _max: { pricePerItem: true },
        _sum: { remainingQuantity: true },
      }),
      prisma.marketTransaction.groupBy({
        by: ["itemId", "rarity"],
        where: { itemId: { in: itemIds }, executedAt: { gte: since24h } },
        _sum: { quantity: true, grossAmount: true },
      }),
    ]);

    const itemById = new Map(items.map((item) => [item.id, item]));
    const key = (id: number, rowRarity: ItemRarity) => `${id}:${rowRarity}`;
    const bidByMarket = new Map(
      bids.map((bid) => [key(bid.itemId, bid.rarity), bid]),
    );
    const volumeByMarket = new Map(
      volume.map((entry) => [key(entry.itemId, entry.rarity), entry]),
    );

    const rows = pageGroups.flatMap((group) => {
      const item = itemById.get(group.itemId);
      if (!item) return [];
      const bid = bidByMarket.get(key(group.itemId, group.rarity));
      const traded = volumeByMarket.get(key(group.itemId, group.rarity));
      return [
        {
          itemTemplateId: item.id,
          itemName: item.name,
          sprite: item.sprite,
          itemType: item.itemType,
          equipTo: item.equipTo,
          stackable: item.stackable,
          rarity: group.rarity,
          minPrice: group._min.listedPrice ?? 0,
          maxPrice: group._max.listedPrice ?? 0,
          totalListings: group._count._all,
          totalUnits: group._sum.quantity ?? 0,
          highestBid: bid?._max.pricePerItem
            ? Number(bid._max.pricePerItem)
            : null,
          demandUnits: bid?._sum.remainingQuantity ?? 0,
          volume24h: traded?._sum.quantity ?? 0,
          value24h: roundGold(Number(traded?._sum.grossAmount ?? 0)),
        },
      ];
    });

    return NextResponse.json({
      items: rows,
      pagination: {
        page,
        limit,
        hasNextPage,
        hasPreviousPage: page > 1,
      },
      filterOptions: {
        itemTypes: (Object.values(ItemTypeValues) as ItemType[]).filter(
          (value) => activeItemTypes.some((item) => item.itemType === value),
        ),
        rarities: (Object.values(ItemRarityValues) as ItemRarity[]).filter(
          (value) => activeRarities.some((item) => item.rarity === value),
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching grouped marketplace items:", error);
    return NextResponse.json(
      { error: "Could not load marketplace items" },
      { status: 500 },
    );
  }
}
