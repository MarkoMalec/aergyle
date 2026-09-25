import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { calculateMarketSale, roundGold } from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";
import { lockInventory } from "~/server/items/inventoryLock";
import { getServerAuthSession } from "~/server/auth";
import { grantStackableItemToInventory } from "~/server/items/grantItem";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "~/utils/inventorySlots";

type HttpError = Error & { status?: number };

function fail(status: number, message: string): never {
  const error = new Error(message) as HttpError;
  error.status = status;
  throw error;
}

/** Sell a stackable commodity into the highest bids, then oldest bids. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      userItemId?: unknown;
      quantity?: unknown;
    };
    const userItemId = Number(body.userItemId);
    const requestedQuantity = Number(body.quantity);
    if (!Number.isInteger(userItemId) || userItemId < 1) {
      return NextResponse.json(
        { error: "Invalid inventory item" },
        { status: 400 },
      );
    }
    if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      return NextResponse.json(
        { error: "Choose a valid quantity" },
        { status: 400 },
      );
    }

    const sellerId = session.user.id;
    const result = await prisma.$transaction(async (tx) => {
      const ownedItem = await tx.userItem.findUnique({
        where: { id: userItemId },
        include: { itemTemplate: true, statModifiers: true },
      });
      if (!ownedItem || ownedItem.userId !== sellerId) {
        fail(404, "Inventory item not found");
      }
      if (ownedItem.status !== "IN_INVENTORY" || !ownedItem.isTradeable) {
        fail(400, "This item is not available to sell");
      }
      if (!ownedItem.itemTemplate.stackable) {
        fail(400, "Sell now is available for stackable commodities only");
      }
      if (requestedQuantity > ownedItem.quantity) {
        fail(400, `You only have ${ownedItem.quantity}`);
      }

      const sellerInventory = await lockInventory(tx, sellerId);
      if (!sellerInventory) fail(404, "Inventory not found");
      const sellerSlots = normalizeInventorySlots(
        sellerInventory.slots,
        sellerInventory.maxSlots,
      );
      if (!sellerSlots.some((slot) => slot.item?.id === ownedItem.id)) {
        fail(409, "This item is no longer in your inventory");
      }

      const orders = await tx.marketBuyOrder.findMany({
        where: {
          itemId: ownedItem.itemId,
          rarity: ownedItem.rarity,
          status: "OPEN",
          remainingQuantity: { gt: 0 },
          userId: { not: sellerId },
        },
        orderBy: [
          { pricePerItem: "desc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
      });

      let remainingToSell = requestedQuantity;
      let filledQuantity = 0;
      let gross = 0;
      let tax = 0;
      let net = 0;

      for (const order of orders) {
        if (remainingToSell <= 0) break;
        const desiredFill = Math.min(remainingToSell, order.remainingQuantity);
        const unitPrice = Number(order.pricePerItem);
        const claimedRemaining = order.remainingQuantity - desiredFill;
        const claimedReserve = roundGold(unitPrice * claimedRemaining);

        const claimed = await tx.marketBuyOrder.updateMany({
          where: {
            id: order.id,
            status: "OPEN",
            remainingQuantity: order.remainingQuantity,
          },
          data: {
            remainingQuantity: claimedRemaining,
            reservedGold: claimedReserve,
            status: claimedRemaining === 0 ? "FILLED" : "OPEN",
          },
        });
        if (claimed.count !== 1) continue;

        const buyerInventory = await tx.inventory.findUnique({
          where: { userId: order.userId },
          select: { id: true },
        });
        let actualFill = 0;
        if (buyerInventory) {
          const grant = await grantStackableItemToInventory({
            db: tx,
            userId: order.userId,
            itemId: ownedItem.itemId,
            rarity: ownedItem.rarity,
            quantity: desiredFill,
            statModifiers: ownedItem.statModifiers,
          });
          actualFill = grant.addedQuantity;
        }

        if (actualFill !== desiredFill) {
          const correctedRemaining = order.remainingQuantity - actualFill;
          const refund = roundGold(unitPrice * correctedRemaining);
          await tx.marketBuyOrder.update({
            where: { id: order.id },
            data: {
              remainingQuantity: correctedRemaining,
              reservedGold: 0,
              status: correctedRemaining === 0 ? "FILLED" : "CANCELLED",
            },
          });
          if (refund > 0) {
            await tx.user.update({
              where: { id: order.userId },
              data: { gold: { increment: refund } },
            });
          }
        }
        if (actualFill === 0) continue;

        const sale = calculateMarketSale(unitPrice, actualFill);
        await tx.marketTransaction.create({
          data: {
            buyerId: order.userId,
            sellerId,
            itemId: ownedItem.itemId,
            rarity: ownedItem.rarity,
            quantity: actualFill,
            unitPrice,
            grossAmount: sale.gross,
            taxAmount: sale.tax,
            netAmount: sale.net,
            source: "SELL_NOW",
          },
        });

        remainingToSell -= actualFill;
        filledQuantity += actualFill;
        gross = roundGold(gross + sale.gross);
        tax = roundGold(tax + sale.tax);
        net = roundGold(net + sale.net);
      }

      if (filledQuantity === 0) {
        fail(
          409,
          "There are no buy orders that can currently receive this item",
        );
      }

      const isFullSale = filledQuantity === ownedItem.quantity;
      const sourceUpdate = await tx.userItem.updateMany({
        where: {
          id: ownedItem.id,
          userId: sellerId,
          status: "IN_INVENTORY",
          quantity: ownedItem.quantity,
        },
        data: isFullSale
          ? { status: "SOLD" }
          : { quantity: ownedItem.quantity - filledQuantity },
      });
      if (sourceUpdate.count !== 1) {
        fail(409, "Your inventory changed while the sale was being completed");
      }

      if (isFullSale) {
        const updatedSlots = sellerSlots.map((slot) =>
          slot.item?.id === ownedItem.id ? { ...slot, item: null } : slot,
        );
        await tx.inventory.update({
          where: { userId: sellerId },
          data: { slots: slotsToInputJson(updatedSlots) },
        });
      }

      await tx.user.update({
        where: { id: sellerId },
        data: { gold: { increment: net } },
      });

      return {
        itemName: ownedItem.itemTemplate.name,
        requestedQuantity,
        filledQuantity,
        unfilledQuantity: requestedQuantity - filledQuantity,
        gross,
        tax,
        net,
        averagePrice: roundGold(gross / filledQuantity),
      };
    });

    return NextResponse.json({
      success: true,
      message:
        result.unfilledQuantity > 0
          ? `Sold ${result.filledQuantity}× ${result.itemName}; ${result.unfilledQuantity} had no matching demand`
          : `Sold ${result.filledQuantity}× ${result.itemName}`,
      ...result,
    });
  } catch (error) {
    const status = (error as HttpError).status;
    if (typeof status === "number") {
      return NextResponse.json({ error: (error as Error).message }, { status });
    }
    console.error("Error selling into marketplace buy orders:", error);
    return NextResponse.json(
      { error: "Could not complete the sale" },
      { status: 500 },
    );
  }
}
