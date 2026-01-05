import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ItemRarity as ItemRarityEnum } from "~/generated/prisma/enums";
import type { ItemRarity } from "~/generated/prisma/enums";
import type { Prisma } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import { normalizeItemEquipTo } from "~/utils/itemEquipTo";

function getFallbackRaritySortOrder(rarity: ItemRarity): number {
  // Keep in sync with the enum order in `schema.prisma`.
  const order: ItemRarity[] = [
    "WORTHLESS",
    "BROKEN",
    "COMMON",
    "UNCOMMON",
    "RARE",
    "EXQUISITE",
    "EPIC",
    "ELITE",
    "UNIQUE",
    "LEGENDARY",
    "MYTHIC",
    "DIVINE",
  ];
  const index = order.indexOf(rarity);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index + 1;
}

function isItemRarity(value: string | null): value is ItemRarity {
  if (value == null) return false;
  return (Object.values(ItemRarityEnum) as string[]).includes(value);
}

/**
 * Get grouped marketplace items (one row per item template)
 * GET /api/marketplace/grouped
 *
 * Query params:
 * - equipTo: filter by equipment slot
 * - rarity: filter by listing rarity
 * - minPrice: minimum listed price
 * - maxPrice: maximum listed price
 * - search: search by item name
 * - page: page number (default: 1)
 * - limit: items per page (default: 50)
 * - sortBy: price (default: price)
 * - sortOrder: asc, desc (default: asc)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const equipTo = normalizeItemEquipTo(searchParams.get("equipTo"));
    const rarityParam = searchParams.get("rarity");
    const rarity = isItemRarity(rarityParam) ? rarityParam : null;
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const search = searchParams.get("search");

    const pageRaw = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;

    const limitRaw = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
    const skip = (page - 1) * limit;

    const sortBy = searchParams.get("sortBy") ?? "price";
    const sortOrder: Prisma.SortOrder =
      searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

    const listedPriceFilter: Prisma.FloatNullableFilter = { not: null };
    const min = minPrice ? Number.parseFloat(minPrice) : Number.NaN;
    const max = maxPrice ? Number.parseFloat(maxPrice) : Number.NaN;
    if (Number.isFinite(min)) listedPriceFilter.gte = min;
    if (Number.isFinite(max)) listedPriceFilter.lte = max;

    const where: Prisma.UserItemWhereInput = {
      status: "LISTED",
      isTradeable: true,
      listedPrice: listedPriceFilter,
    };

    if (rarity) where.rarity = rarity;

    if (equipTo != null || search != null) {
      const itemTemplateWhere: Prisma.ItemWhereInput = {};
      if (equipTo) itemTemplateWhere.equipTo = equipTo;
      if (search) itemTemplateWhere.name = { contains: search };
      where.itemTemplate = itemTemplateWhere;
    }

    const orderBy =
      sortBy === "price"
        ? ({ _min: { listedPrice: sortOrder } } as const)
        : ({ _count: { itemId: sortOrder } } as const);

    const grouped = await prisma.userItem.groupBy({
      by: ["itemId"],
      where,
      _min: { listedPrice: true },
      _max: { listedPrice: true },
      _count: { itemId: true },
      orderBy,
      skip,
      take: limit + 1,
    });

    const hasNextPage = grouped.length > limit;
    const groupedPage = hasNextPage ? grouped.slice(0, limit) : grouped;

    const itemIds = groupedPage.map((g) => g.itemId);

    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        name: true,
        sprite: true,
        equipTo: true,
      },
    });

    const itemById = new Map(items.map((i) => [i.id, i]));

    // Determine lowest rarity among listings per itemId for this page.
    const rarityConfigs = await prisma.rarityConfig.findMany({
      select: { rarity: true, sortOrder: true },
    });
    const raritySortOrderByRarity = new Map<ItemRarity, number>(
      rarityConfigs.map((c) => [c.rarity, c.sortOrder])
    );

    const raritiesByItemId = await prisma.userItem.groupBy({
      by: ["itemId", "rarity"],
      where: {
        ...where,
        itemId: { in: itemIds },
      },
      _count: { _all: true },
    });

    const lowestRarityByItemId = new Map<number, ItemRarity>();
    for (const row of raritiesByItemId) {
      const current = lowestRarityByItemId.get(row.itemId);
      if (!current) {
        lowestRarityByItemId.set(row.itemId, row.rarity);
        continue;
      }

      const currentOrder =
        raritySortOrderByRarity.get(current) ?? getFallbackRaritySortOrder(current);
      const candidateOrder =
        raritySortOrderByRarity.get(row.rarity) ?? getFallbackRaritySortOrder(row.rarity);

      if (candidateOrder < currentOrder) {
        lowestRarityByItemId.set(row.itemId, row.rarity);
      }
    }

    const rows = groupedPage
      .map((g) => {
        const item = itemById.get(g.itemId);
        if (!item) return null;
        return {
          itemTemplateId: item.id,
          itemName: item.name,
          sprite: item.sprite,
          equipTo: item.equipTo,
          minPrice: g._min.listedPrice ?? 0,
          maxPrice: g._max.listedPrice ?? 0,
          totalListings: g._count.itemId,
          lowestRarity: lowestRarityByItemId.get(g.itemId) ?? "COMMON",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return NextResponse.json({
      items: rows,
      pagination: {
        page,
        limit,
        hasNextPage,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching grouped marketplace items:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
