import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

/**
 * Get player's active marketplace listings
 * GET /api/marketplace/my-listings
 * 
 * Query params:
 * - (none) uses current session user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

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
