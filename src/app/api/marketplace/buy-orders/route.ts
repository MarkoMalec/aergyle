import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ItemRarity as ItemRarityValues } from "~/generated/prisma/enums";
import type { ItemRarity } from "~/generated/prisma/enums";
import {
  MARKET_DEFAULT_MAX_PRICE,
  MARKET_MAX_OPEN_BUY_ORDERS,
  MARKET_MAX_GOLD_AMOUNT,
  parsePositiveGold,
  roundGold,
} from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";

function isRarity(value: unknown): value is ItemRarity {
  return (
    typeof value === "string" &&
    (Object.values(ItemRarityValues) as string[]).includes(value)
  );
}

/** Reserve gold and place a patient bid for a stackable commodity. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const itemId = Number(body.itemId);
    const quantity = Number(body.quantity);
    const pricePerItem = parsePositiveGold(body.pricePerItem);
    const rarity = body.rarity;

    if (!Number.isInteger(itemId) || itemId < 1 || !isRarity(rarity)) {
      return NextResponse.json(
        { error: "Invalid item or rarity" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) {
      return NextResponse.json(
        { error: "Quantity must be between 1 and 100,000" },
        { status: 400 },
      );
    }
    if (pricePerItem == null || pricePerItem > MARKET_DEFAULT_MAX_PRICE) {
      return NextResponse.json(
        { error: "Enter a valid unit price" },
        { status: 400 },
      );
    }

    const reservedGold = roundGold(pricePerItem * quantity);
    if (reservedGold > MARKET_MAX_GOLD_AMOUNT) {
      return NextResponse.json(
        { error: "This order is too large. Lower its price or quantity." },
        { status: 400 },
      );
    }
    const userId = session.user.id;
    const order = await prisma.$transaction(async (tx) => {
      const [item, openOrderCount, lowestAsk] = await Promise.all([
        tx.item.findUnique({
          where: { id: itemId },
          select: { id: true, name: true, stackable: true },
        }),
        tx.marketBuyOrder.count({ where: { userId, status: "OPEN" } }),
        tx.userItem.findFirst({
          where: {
            itemId,
            rarity,
            status: "LISTED",
            isTradeable: true,
            userId: { not: userId },
            listedPrice: { not: null },
          },
          orderBy: [{ listedPrice: "asc" }, { listedAt: "asc" }],
          select: { listedPrice: true },
        }),
      ]);

      if (!item) throw new Error("ITEM_NOT_FOUND");
      if (!item.stackable) throw new Error("NOT_STACKABLE");
      if (openOrderCount >= MARKET_MAX_OPEN_BUY_ORDERS) {
        throw new Error("ORDER_LIMIT");
      }
      if (
        lowestAsk?.listedPrice != null &&
        pricePerItem >= lowestAsk.listedPrice
      ) {
        throw new Error(`BUY_NOW:${lowestAsk.listedPrice}`);
      }

      const debit = await tx.user.updateMany({
        where: { id: userId, gold: { gte: reservedGold } },
        data: { gold: { decrement: reservedGold } },
      });
      if (debit.count !== 1) throw new Error("INSUFFICIENT_GOLD");

      return tx.marketBuyOrder.create({
        data: {
          userId,
          itemId,
          rarity,
          quantity,
          remainingQuantity: quantity,
          pricePerItem,
          reservedGold,
        },
        include: { item: { select: { name: true } } },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Buy order placed for ${quantity}× ${order.item.name}`,
      order: {
        ...order,
        pricePerItem: Number(order.pricePerItem),
        reservedGold: Number(order.reservedGold),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ITEM_NOT_FOUND") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (message === "NOT_STACKABLE") {
      return NextResponse.json(
        { error: "Buy orders are available for stackable commodities only" },
        { status: 400 },
      );
    }
    if (message === "ORDER_LIMIT") {
      return NextResponse.json(
        {
          error: `You can have up to ${MARKET_MAX_OPEN_BUY_ORDERS} open buy orders`,
        },
        { status: 400 },
      );
    }
    if (message === "INSUFFICIENT_GOLD") {
      return NextResponse.json(
        { error: "You do not have enough gold to reserve this order" },
        { status: 400 },
      );
    }
    if (message.startsWith("BUY_NOW:")) {
      const ask = message.slice("BUY_NOW:".length);
      return NextResponse.json(
        {
          error: `An item is already available for ${ask} gold. Use Buy now instead.`,
        },
        { status: 400 },
      );
    }

    console.error("Error creating marketplace buy order:", error);
    return NextResponse.json(
      { error: "Could not create the buy order" },
      { status: 500 },
    );
  }
}
