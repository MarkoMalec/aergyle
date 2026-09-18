import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { MARKET_MAX_GOLD_AMOUNT, calculateMarketSale } from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { grantStackableItemToInventory } from "~/server/vocations/grantItem";
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

/** Buy an exact active listing at its advertised unit price. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const buyerId = session.user.id;
    const body = (await req.json()) as {
      userItemId?: unknown;
      quantity?: unknown;
    };
    const userItemId = Number(body.userItemId);
    const quantity = Number(body.quantity);

    if (!Number.isInteger(userItemId) || userItemId < 1) {
      return NextResponse.json({ error: "Invalid listing" }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: "Choose a valid quantity" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.userItem.findUnique({
        where: { id: userItemId },
        include: {
          itemTemplate: true,
          statModifiers: true,
          user: { select: { name: true } },
        },
      });

      if (
        !listing ||
        listing.status !== "LISTED" ||
        listing.listedPrice == null
      ) {
        fail(409, "This listing is no longer available");
      }
      if (listing.userId === buyerId) {
        fail(400, "You cannot buy your own listing");
      }
      if (quantity > listing.quantity) {
        fail(409, `Only ${listing.quantity} remain at this price`);
      }
      if (!listing.itemTemplate.stackable && quantity !== 1) {
        fail(400, "Equipment can only be purchased one item at a time");
      }

      const unitPrice = listing.listedPrice;
      const sale = calculateMarketSale(unitPrice, quantity);
      if (sale.gross > MARKET_MAX_GOLD_AMOUNT) {
        fail(400, "This purchase is too large. Choose a smaller quantity.");
      }
      const buyerDebit = await tx.user.updateMany({
        where: { id: buyerId, gold: { gte: sale.gross } },
        data: { gold: { decrement: sale.gross } },
      });
      if (buyerDebit.count !== 1) {
        fail(400, `You need ${sale.gross.toFixed(2)} gold for this purchase`);
      }

      const isFullPurchase = quantity === listing.quantity;
      if (listing.itemTemplate.stackable) {
        const claimed = await tx.userItem.updateMany({
          where: {
            id: listing.id,
            userId: listing.userId,
            status: "LISTED",
            quantity: listing.quantity,
            listedPrice: unitPrice,
          },
          data: isFullPurchase
            ? { status: "SOLD", listedPrice: null, listedAt: null }
            : { quantity: listing.quantity - quantity },
        });
        if (claimed.count !== 1) {
          fail(409, "The listing changed while you were purchasing it");
        }

        const grant = await grantStackableItemToInventory({
          db: tx,
          userId: buyerId,
          itemId: listing.itemId,
          rarity: listing.rarity,
          quantity,
          statModifiers: listing.statModifiers,
        });
        if (grant.remainingQuantity > 0) {
          fail(
            400,
            "Your inventory does not have enough room for this purchase",
          );
        }
      } else {
        const inventory = await tx.inventory.findUnique({
          where: { userId: buyerId },
        });
        if (!inventory) fail(404, "Inventory not found");

        const slots = normalizeInventorySlots(
          inventory.slots,
          inventory.maxSlots,
        );
        const emptySlotIndex = slots.findIndex((slot) => slot.item === null);
        if (emptySlotIndex < 0) {
          fail(400, "Your inventory is full");
        }

        const claimed = await tx.userItem.updateMany({
          where: {
            id: listing.id,
            userId: listing.userId,
            status: "LISTED",
            quantity: 1,
            listedPrice: unitPrice,
          },
          data: {
            userId: buyerId,
            status: "IN_INVENTORY",
            listedPrice: null,
            listedAt: null,
          },
        });
        if (claimed.count !== 1) {
          fail(409, "The listing changed while you were purchasing it");
        }

        slots[emptySlotIndex] = {
          slotIndex: emptySlotIndex,
          item: { id: listing.id },
        };
        await tx.inventory.update({
          where: { userId: buyerId },
          data: { slots: slotsToInputJson(slots) },
        });
      }

      await tx.user.update({
        where: { id: listing.userId },
        data: { gold: { increment: sale.net } },
      });
      await tx.marketTransaction.create({
        data: {
          buyerId,
          sellerId: listing.userId,
          itemId: listing.itemId,
          rarity: listing.rarity,
          quantity,
          unitPrice,
          grossAmount: sale.gross,
          taxAmount: sale.tax,
          netAmount: sale.net,
          source: "BUY_NOW",
        },
      });

      return {
        itemName: listing.itemTemplate.name,
        seller: listing.user.name ?? "Unknown seller",
        quantity,
        unitPrice,
        ...sale,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Purchased ${result.quantity}× ${result.itemName}`,
      quantity: result.quantity,
      seller: result.seller,
      unitPrice: result.unitPrice,
      totalPrice: result.gross,
      tax: result.tax,
    });
  } catch (error) {
    const status = (error as HttpError).status;
    if (typeof status === "number") {
      return NextResponse.json({ error: (error as Error).message }, { status });
    }
    console.error("Error buying marketplace listing:", error);
    return NextResponse.json(
      { error: "Could not complete the purchase" },
      { status: 500 },
    );
  }
}
