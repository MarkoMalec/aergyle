import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ItemRarity as ItemRarityEnum } from "~/generated/prisma/enums";
import type { ItemRarity } from "~/generated/prisma/enums";
import type { Prisma } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import { hydrateEffectiveItemStats } from "~/server/items/effectiveStats";

export const dynamic = "force-dynamic";

function isItemRarity(value: string | null): value is ItemRarity {
  if (value == null) return false;
  return (Object.values(ItemRarityEnum) as string[]).includes(value);
}

type ListingsCursor = {
  listedPrice: number;
  listedAt: string;
  id: number;
};

function decodeCursor(raw: string | null): ListingsCursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as ListingsCursor;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.listedPrice !== "number" ||
      typeof parsed.listedAt !== "string" ||
      typeof parsed.id !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function encodeCursor(cursor: ListingsCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64");
}

/**
 * Get paginated listings for a specific item template
 * GET /api/marketplace/listings/:itemTemplateId
 *
 * Query params:
 * - cursor: opaque cursor from previous response (optional)
 * - limit: items per page (default: 12)
 * - rarity: filter by rarity (optional)
 * - enchantLevel: only listings at this enchant level (0 = not enchanted).
 *   Left out, the response lists the levels on offer (`enchantLevels`) and
 *   returns listings only when there is exactly one level.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemTemplateId: string }> },
) {
  try {
    const resolvedParams = await params;
    const itemTemplateId = parseInt(resolvedParams.itemTemplateId);

    if (isNaN(itemTemplateId)) {
      return NextResponse.json(
        { error: "Invalid item template ID" },
        { status: 400 },
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const limitRaw = Number.parseInt(searchParams.get("limit") ?? "12", 10);
    const limit = Math.min(
      50,
      Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 12),
    );
    const cursor = decodeCursor(searchParams.get("cursor"));
    const rarityParam = searchParams.get("rarity");
    const rarity = isItemRarity(rarityParam) ? rarityParam : null;
    const levelRaw = searchParams.get("enchantLevel");
    const levelParam = levelRaw == null ? null : Number(levelRaw);
    if (
      levelParam != null &&
      !(Number.isInteger(levelParam) && levelParam >= 0 && levelParam <= 20)
    ) {
      return NextResponse.json(
        { error: "Invalid enchant level" },
        { status: 400 },
      );
    }

    // The levels on offer (not paged: at most 21 groups) for this item + rarity.
    const levelGroups = cursor
      ? []
      : await prisma.userItem.groupBy({
          by: ["enchantLevel"],
          where: {
            status: "LISTED",
            isTradeable: true,
            itemId: itemTemplateId,
            listedPrice: { not: null },
            ...(rarity ? { rarity } : {}),
          },
          _min: { listedPrice: true },
          _count: { _all: true },
          orderBy: { enchantLevel: "asc" },
        });
    const enchantLevels = levelGroups.map((group) => ({
      enchantLevel: group.enchantLevel,
      listings: group._count._all,
      minPrice: group._min.listedPrice ?? 0,
    }));
    const enchantLevel =
      levelParam ??
      (enchantLevels.length === 1 ? enchantLevels[0]!.enchantLevel : null);
    if (enchantLevel == null && !cursor) {
      return NextResponse.json({
        listings: [],
        hasMore: false,
        nextCursor: null,
        enchantLevel: null,
        enchantLevels,
      });
    }

    // Build where clause for this specific item template
    const where: Prisma.UserItemWhereInput = {
      status: "LISTED",
      isTradeable: true,
      itemId: itemTemplateId,
      listedPrice: { not: null },
      listedAt: { not: null },
      ...(enchantLevel != null ? { enchantLevel } : {}),
    };

    // Add rarity filter if provided
    if (rarity) where.rarity = rarity;

    // Add cursor pagination filters if provided
    if (cursor) {
      const cursorListedAt = new Date(cursor.listedAt);
      where.OR = [
        { listedPrice: { gt: cursor.listedPrice } },
        {
          AND: [
            { listedPrice: cursor.listedPrice },
            { listedAt: { gt: cursorListedAt } },
          ],
        },
        {
          AND: [
            { listedPrice: cursor.listedPrice },
            { listedAt: cursorListedAt },
            { id: { gt: cursor.id } },
          ],
        },
      ];
    }

    // Fetch listings with optimized query
    const listingsPlusOne = await prisma.userItem.findMany({
      where,
      select: {
        id: true,
        quantity: true,
        rarity: true,
        enchantLevel: true,
        listedPrice: true,
        listedAt: true,
        itemTemplate: {
          select: {
            id: true,
            name: true,
            sprite: true,
            description: true,
            itemType: true,
            equipTo: true,
            stackable: true,
            maxStackSize: true,
            price: true,
            rarity: true,
            minPhysicalDamage: true,
            maxPhysicalDamage: true,
            minMagicDamage: true,
            maxMagicDamage: true,
            armor: true,
            requiredLevel: true,
            stats: {
              select: { statType: true, value: true, maxValue: true },
            },
            statEnchantUnlocks: {
              select: { statType: true, value: true, level: true },
            },
            statEnchantOverrides: {
              select: { statType: true, level: true, kind: true, value: true },
            },
            toolEfficiencies: {
              select: { actionType: true, baseEfficiency: true },
            },
          },
        },
        statModifiers: {
          select: {
            statType: true,
            value: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { listedPrice: "asc" }, // Sort by cheapest first
        { listedAt: "asc" }, // Equal price: oldest listing first
        { id: "asc" }, // Stable tie-breaker
      ],
      take: limit + 1,
    });

    const hasMore = listingsPlusOne.length > limit;
    const listings = hasMore
      ? listingsPlusOne.slice(0, limit)
      : listingsPlusOne;
    const effectiveListings = await hydrateEffectiveItemStats(listings);
    const last = listings[listings.length - 1];
    const nextCursor =
      hasMore && last?.listedPrice != null && last?.listedAt != null
        ? encodeCursor({
            listedPrice: last.listedPrice,
            listedAt: last.listedAt.toISOString(),
            id: last.id,
          })
        : null;

    // Get available rarities for this item (only on initial load to avoid redundant queries)
    let availableRarities: string[] = [];
    if (!cursor) {
      const raritiesResult = await prisma.userItem.findMany({
        where: {
          status: "LISTED",
          isTradeable: true,
          itemId: itemTemplateId,
        },
        select: {
          rarity: true,
        },
        distinct: ["rarity"],
      });
      availableRarities = raritiesResult.map((r) => r.rarity);
    }

    return NextResponse.json({
      listings: effectiveListings,
      hasMore,
      nextCursor,
      enchantLevel,
      enchantLevels: cursor ? undefined : enchantLevels,
      availableRarities: !cursor ? availableRarities : undefined,
    });
  } catch (error) {
    console.error("Error fetching item listings:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
