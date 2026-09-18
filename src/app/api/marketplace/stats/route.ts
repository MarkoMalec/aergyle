import { NextResponse } from "next/server";
import { ItemRarity as ItemRarityValues } from "~/generated/prisma/enums";
import type { ItemRarity } from "~/generated/prisma/enums";
import {
  percentageChange,
  roundGold,
  weightedAveragePrice,
  weightedMedianPrice,
} from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

export const dynamic = "force-dynamic";

function isRarity(value: string | null): value is ItemRarity {
  return (
    value != null &&
    (Object.values(ItemRarityValues) as string[]).includes(value)
  );
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Active supply/demand is kept separate from completed-sale history so asking
 * prices are never presented as an average sale price.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = Number(searchParams.get("itemId"));
    const rarityParam = searchParams.get("rarity");
    if (!Number.isInteger(itemId) || itemId < 1 || !isRarity(rarityParam)) {
      return NextResponse.json(
        { error: "A valid itemId and rarity are required" },
        { status: 400 },
      );
    }
    const rarity = rarityParam;
    const session = await getServerAuthSession();

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [listings, orders, transactions] = await Promise.all([
      prisma.userItem.findMany({
        where: {
          itemId,
          rarity,
          status: "LISTED",
          isTradeable: true,
          listedPrice: { not: null },
        },
        select: { listedPrice: true, quantity: true },
        orderBy: [{ listedPrice: "asc" }, { listedAt: "asc" }],
      }),
      prisma.marketBuyOrder.findMany({
        where: {
          itemId,
          rarity,
          status: "OPEN",
          remainingQuantity: { gt: 0 },
        },
        select: {
          id: true,
          userId: true,
          pricePerItem: true,
          remainingQuantity: true,
        },
        orderBy: [
          { pricePerItem: "desc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      }),
      prisma.marketTransaction.findMany({
        where: { itemId, rarity, executedAt: { gte: thirtyDaysAgo } },
        select: {
          unitPrice: true,
          quantity: true,
          grossAmount: true,
          executedAt: true,
        },
        orderBy: { executedAt: "desc" },
      }),
    ]);

    const priceSamples = transactions.map((transaction) => ({
      unitPrice: Number(transaction.unitPrice),
      quantity: transaction.quantity,
    }));
    const currentWeek = transactions
      .filter((transaction) => transaction.executedAt >= sevenDaysAgo)
      .map((transaction) => ({
        unitPrice: Number(transaction.unitPrice),
        quantity: transaction.quantity,
      }));
    const previousWeek = transactions
      .filter(
        (transaction) =>
          transaction.executedAt >= fourteenDaysAgo &&
          transaction.executedAt < sevenDaysAgo,
      )
      .map((transaction) => ({
        unitPrice: Number(transaction.unitPrice),
        quantity: transaction.quantity,
      }));

    const lowestAsk = listings[0]?.listedPrice ?? null;
    const highestBid = orders[0] ? Number(orders[0].pricePerItem) : null;
    const sellUnits = listings.reduce(
      (sum, listing) => sum + listing.quantity,
      0,
    );
    const buyUnits = orders.reduce(
      (sum, order) => sum + order.remainingQuantity,
      0,
    );

    const buyLevelMap = new Map<number, number>();
    for (const order of orders) {
      const price = Number(order.pricePerItem);
      buyLevelMap.set(
        price,
        (buyLevelMap.get(price) ?? 0) + order.remainingQuantity,
      );
    }
    const buyOrderLevels = Array.from(buyLevelMap, ([price, quantity]) => ({
      price,
      quantity,
    })).sort((a, b) => b.price - a.price);
    // Keep executable orders separate so Sell now previews use the same
    // per-fill tax rounding as execution, even when several bids share a price.
    const executableBuyOrderLevels = orders
      .filter((order) => order.userId !== session?.user?.id)
      .map((order) => ({
        price: Number(order.pricePerItem),
        quantity: order.remainingQuantity,
      }));

    const dayBuckets = new Map<string, { quantity: number; value: number }>();
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
      dayBuckets.set(startOfUtcDay(date).toISOString().slice(0, 10), {
        quantity: 0,
        value: 0,
      });
    }
    for (const transaction of transactions) {
      const key = startOfUtcDay(transaction.executedAt)
        .toISOString()
        .slice(0, 10);
      const bucket = dayBuckets.get(key);
      if (!bucket) continue;
      bucket.quantity += transaction.quantity;
      bucket.value += Number(transaction.unitPrice) * transaction.quantity;
    }
    const history = Array.from(dayBuckets, ([date, bucket]) => ({
      date,
      averagePrice:
        bucket.quantity > 0 ? roundGold(bucket.value / bucket.quantity) : null,
      volume: bucket.quantity,
    }));

    const transactionPrices = priceSamples.map((sample) => sample.unitPrice);
    const sales24h = transactions.filter(
      (transaction) => transaction.executedAt >= oneDayAgo,
    );
    const averagePrice30d = weightedAveragePrice(priceSamples);
    const medianPrice30d = weightedMedianPrice(priceSamples);

    return NextResponse.json({
      itemId,
      rarity,
      activeMarket: {
        lowestAsk,
        highestBid,
        spread:
          lowestAsk != null && highestBid != null
            ? roundGold(lowestAsk - highestBid)
            : null,
        sellListings: listings.length,
        sellUnits,
        buyOrders: orders.length,
        buyUnits,
        buyOrderLevels,
        executableBuyOrderLevels,
      },
      sales: {
        averagePrice30d,
        medianPrice30d,
        minPrice30d:
          transactionPrices.length > 0 ? Math.min(...transactionPrices) : null,
        maxPrice30d:
          transactionPrices.length > 0 ? Math.max(...transactionPrices) : null,
        lastPrice: transactions[0] ? Number(transactions[0].unitPrice) : null,
        lastSaleAt: transactions[0]?.executedAt ?? null,
        completedTransactions30d: transactions.length,
        volume24h: sales24h.reduce(
          (sum, transaction) => sum + transaction.quantity,
          0,
        ),
        value24h: roundGold(
          sales24h.reduce(
            (sum, transaction) => sum + Number(transaction.grossAmount),
            0,
          ),
        ),
        volume30d: transactions.reduce(
          (sum, transaction) => sum + transaction.quantity,
          0,
        ),
        value30d: roundGold(
          transactions.reduce(
            (sum, transaction) => sum + Number(transaction.grossAmount),
            0,
          ),
        ),
        priceChange7d: percentageChange(
          weightedAveragePrice(currentWeek),
          weightedAveragePrice(previousWeek),
        ),
        history,
      },
    });
  } catch (error) {
    console.error("Error fetching market metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch market metrics" },
      { status: 500 },
    );
  }
}
