import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

/**
 * Get player's active marketplace listings
 * GET /api/marketplace/my-listings
 * 
 * Query params:
 * - userId: string (required)
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required parameter: userId" },
        { status: 400 }
      );
    }

    // Get all LISTED items for this user
    const listings = await prisma.userItem.findMany({
      where: {
        userId,
        status: "LISTED",
      },
      include: {
        itemTemplate: true,
        stats: true,
      },
      orderBy: {
        listedAt: "desc",
      },
    });

    // Calculate total value
    const totalValue = listings.reduce((sum, item) => sum + (item.listedPrice || 0), 0);

    return NextResponse.json({
      listings,
      count: listings.length,
      totalValue,
    });

  } catch (error) {
    console.error("Error fetching user listings:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
