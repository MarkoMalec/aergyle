import { NextResponse } from "next/server";
import { calculateMarketSale, roundGold } from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import {
  hydrateEffectiveItemStats,
  ITEM_BALANCE_RELATIONS,
} from "~/server/items/effectiveStats";

export const dynamic = "force-dynamic";

/** Current offers only. Completed activity lives in /marketplace/history. */
export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const [sellListings, buyOrders] = await Promise.all([
      prisma.userItem.findMany({
        where: { userId, status: "LISTED" },
        include: {
          itemTemplate: { include: ITEM_BALANCE_RELATIONS },
          statModifiers: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { listedAt: "desc" },
      }),
      prisma.marketBuyOrder.findMany({
        where: { userId, status: "OPEN" },
        include: { item: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const effectiveSellListings = await hydrateEffectiveItemStats(sellListings);

    const listingValues = sellListings.map((listing) =>
      calculateMarketSale(listing.listedPrice ?? 0, listing.quantity),
    );
    const sellGross = roundGold(
      listingValues.reduce((sum, value) => sum + value.gross, 0),
    );
    const sellTax = roundGold(
      listingValues.reduce((sum, value) => sum + value.tax, 0),
    );
    const sellNet = roundGold(
      listingValues.reduce((sum, value) => sum + value.net, 0),
    );
    const reservedGold = roundGold(
      buyOrders.reduce((sum, order) => sum + Number(order.reservedGold), 0),
    );

    return NextResponse.json({
      sellListings: effectiveSellListings,
      buyOrders: buyOrders.map((order) => ({
        ...order,
        pricePerItem: Number(order.pricePerItem),
        reservedGold: Number(order.reservedGold),
      })),
      summary: {
        sellListingCount: sellListings.length,
        sellUnits: sellListings.reduce(
          (sum, listing) => sum + listing.quantity,
          0,
        ),
        sellGross,
        sellTax,
        sellNet,
        buyOrderCount: buyOrders.length,
        buyUnits: buyOrders.reduce(
          (sum, order) => sum + order.remainingQuantity,
          0,
        ),
        reservedGold,
      },
      // Kept during the UI migration for older clients.
      listings: effectiveSellListings,
      count: sellListings.length,
      totalValue: sellGross,
    });
  } catch (error) {
    console.error("Error fetching user market offers:", error);
    return NextResponse.json(
      { error: "Could not load your market offers" },
      { status: 500 },
    );
  }
}
