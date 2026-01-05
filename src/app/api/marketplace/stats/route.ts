import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { ItemRarity, ItemStatus } from "~/generated/prisma/enums";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    const rarity = searchParams.get("rarity") as ItemRarity;

    if (!itemId || !rarity) {
      return NextResponse.json(
        { error: "itemId and rarity are required" },
        { status: 400 }
      );
    }

    // Get all active listings for this item + rarity combination
    const listings = await db.userItem.findMany({
      where: {
        itemId: parseInt(itemId),
        rarity,
        status: ItemStatus.LISTED,
        listedPrice: { not: null },
      },
      select: {
        listedPrice: true,
        quantity: true,
        listedAt: true,
      },
    });

    if (listings.length === 0) {
      return NextResponse.json({
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        totalListings: 0,
      });
    }

    // Calculate stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentListings = listings.filter(
      (listing) => listing.listedAt && listing.listedAt >= thirtyDaysAgo
    );

    // Use all listings for total count, recent listings for price stats
    const pricesForStats = recentListings.length > 0 ? recentListings : listings;
    
    const prices = pricesForStats.map((listing) =>
      parseFloat(listing.listedPrice?.toString() ?? "0")
    );

    const averagePrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const totalListings = listings.length;

    return NextResponse.json({
      averagePrice: parseFloat(averagePrice.toFixed(2)),
      minPrice: parseFloat(minPrice.toFixed(2)),
      maxPrice: parseFloat(maxPrice.toFixed(2)),
      totalListings,
    });
  } catch (error) {
    console.error("Error fetching market stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch market stats" },
      { status: 500 }
    );
  }
}
