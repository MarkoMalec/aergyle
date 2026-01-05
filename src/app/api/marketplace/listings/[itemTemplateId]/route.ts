import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ItemRarity as ItemRarityEnum } from "~/generated/prisma/enums";
import type { ItemRarity } from "~/generated/prisma/enums";
import type { Prisma } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";

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
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemTemplateId: string }> }
) {
  try {
    const resolvedParams = await params;
    const itemTemplateId = parseInt(resolvedParams.itemTemplateId);
    
    if (isNaN(itemTemplateId)) {
      return NextResponse.json(
        { error: "Invalid item template ID" },
        { status: 400 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const limitRaw = Number.parseInt(searchParams.get("limit") ?? "12", 10);
    const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 12));
    const cursor = decodeCursor(searchParams.get("cursor"));
    const rarityParam = searchParams.get("rarity");
    const rarity = isItemRarity(rarityParam) ? rarityParam : null;

    // Build where clause for this specific item template
    const where: Prisma.UserItemWhereInput = {
      status: "LISTED",
      isTradeable: true,
      itemId: itemTemplateId,
      listedPrice: { not: null },
      listedAt: { not: null },
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
            { listedAt: { lt: cursorListedAt } },
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
        listedPrice: true,
        listedAt: true,
        itemTemplate: {
          select: {
            id: true,
            name: true,
            sprite: true,
          },
        },
        stats: {
          select: {
            id: true,
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
        { listedAt: "desc" },   // Then by newest
        { id: "asc" },          // Stable tie-breaker
      ],
      take: limit + 1,
    });

    const hasMore = listingsPlusOne.length > limit;
    const listings = hasMore ? listingsPlusOne.slice(0, limit) : listingsPlusOne;
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
      listings,
      hasMore,
      nextCursor,
      availableRarities: !cursor ? availableRarities : undefined,
    });

  } catch (error) {
    console.error("Error fetching item listings:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
