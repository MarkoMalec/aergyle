import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";

/**
 * Get marketplace listings with filters
 * GET /api/marketplace
 * 
 * Query params:
 * - equipTo: filter by equipment slot (weapon, head, chest, etc.)
 * - rarity: filter by rarity (COMMON, RARE, EPIC, etc.)
 * - minPrice: minimum price
 * - maxPrice: maximum price
 * - search: search by item name
 * - page: page number (default: 1)
 * - limit: items per page (default: 20)
 * - sortBy: listedAt, price (default: listedAt)
 * - sortOrder: asc, desc (default: desc)
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    
    // Filters
    const equipTo = searchParams.get("equipTo");
    const rarity = searchParams.get("rarity");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const search = searchParams.get("search");
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    
    // Sorting
    const sortBy = searchParams.get("sortBy") || "listedAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: any = {
      status: "LISTED",
      isTradeable: true,
    };

    // Price range filter
    if (minPrice || maxPrice) {
      where.listedPrice = {};
      if (minPrice) where.listedPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.listedPrice.lte = parseFloat(maxPrice);
    }

    // Rarity filter
    if (rarity) {
      where.rarity = rarity;
    }

    // Item template filters (equipTo, search)
    if (equipTo || search) {
      where.itemTemplate = {};
      if (equipTo) where.itemTemplate.equipTo = equipTo;
      if (search) where.itemTemplate.name = { contains: search };
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === "price") {
      orderBy.listedPrice = sortOrder;
    } else {
      orderBy.listedAt = sortOrder;
    }

    // Get total count for pagination
    const totalCount = await prisma.userItem.count({ where });

    // Get listings
    const listings = await prisma.userItem.findMany({
      where,
      include: {
        itemTemplate: true,
        stats: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return NextResponse.json({
      listings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });

  } catch (error) {
    console.error("Error fetching marketplace listings:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
