import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "~/utils/inventorySlots";
import {
  MARKET_DEFAULT_MAX_PRICE,
  MARKET_MAX_GOLD_AMOUNT,
  parsePositiveGold,
  roundGold,
} from "~/lib/marketplace";

/**
 * List an item on the marketplace
 * POST /api/marketplace/list
 *
 * Body: {
 *   userItemId: number,
 *   price: number,
 *   quantity: number
 * }
 */
export async function POST(req: NextRequest) {
  const throwHttp = (status: number, message: string): never => {
    const error = new Error(message) as Error & { status?: number };
    error.status = status;
    throw error;
  };

  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = (await req.json()) as Record<string, unknown>;
    const parsedUserItemId = Number(body.userItemId);
    const parsedPrice = parsePositiveGold(body.price);
    const requestedQuantity = Number(body.quantity);

    if (
      body.userItemId == null ||
      body.price == null ||
      body.quantity == null
    ) {
      return NextResponse.json(
        { error: "Missing required fields: userItemId, price, quantity" },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(parsedUserItemId) ||
      !Number.isInteger(parsedUserItemId)
    ) {
      return NextResponse.json(
        { error: "Invalid userItemId" },
        { status: 400 },
      );
    }

    if (parsedPrice == null || parsedPrice > MARKET_DEFAULT_MAX_PRICE) {
      return NextResponse.json(
        {
          error: `Price must be between 0.01 and ${MARKET_DEFAULT_MAX_PRICE.toLocaleString()} gold`,
        },
        { status: 400 },
      );
    }

    if (
      !Number.isFinite(requestedQuantity) ||
      !Number.isInteger(requestedQuantity) ||
      requestedQuantity < 1
    ) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    if (roundGold(parsedPrice * requestedQuantity) > MARKET_MAX_GOLD_AMOUNT) {
      return NextResponse.json(
        { error: "This listing is too large. Lower its price or quantity." },
        { status: 400 },
      );
    }

    const { listedItem, itemName, quantityListed } = await prisma.$transaction(
      async (tx) => {
        const userItem = await tx.userItem.findUnique({
          where: { id: parsedUserItemId },
          include: {
            itemTemplate: true,
            statModifiers: true,
          },
        });

        if (!userItem) {
          return throwHttp(404, "Item not found");
        }

        const ownedItem = userItem;

        if (ownedItem.userId !== userId) {
          throwHttp(403, "You don't own this item");
        }

        if (!ownedItem.isTradeable) {
          throwHttp(400, "This item cannot be traded");
        }

        if (ownedItem.status !== "IN_INVENTORY") {
          throwHttp(
            400,
            `Cannot list item with status: ${ownedItem.status}. Item must be in your inventory.`,
          );
        }

        const availableQuantity = ownedItem.quantity ?? 1;
        if (!ownedItem.itemTemplate.stackable && requestedQuantity !== 1) {
          throwHttp(
            400,
            "This item is not stackable and can only be listed as quantity 1",
          );
        }

        if (requestedQuantity > availableQuantity) {
          throwHttp(400, `Only ${availableQuantity} available`);
        }

        const inventory = await tx.inventory.findUnique({ where: { userId } });
        if (!inventory) return throwHttp(404, "Inventory not found");
        const slots = normalizeInventorySlots(
          inventory.slots,
          inventory.maxSlots,
        );
        if (!slots.some((slot) => slot.item?.id === ownedItem.id)) {
          throwHttp(409, "This item is no longer in your inventory");
        }

        if (ownedItem.itemTemplate.stackable) {
          const highestBid = await tx.marketBuyOrder.findFirst({
            where: {
              itemId: ownedItem.itemId,
              rarity: ownedItem.rarity,
              status: "OPEN",
              remainingQuantity: { gt: 0 },
              userId: { not: userId },
            },
            orderBy: [{ pricePerItem: "desc" }, { createdAt: "asc" }],
            select: { pricePerItem: true },
          });
          if (highestBid && parsedPrice <= Number(highestBid.pricePerItem)) {
            throwHttp(
              400,
              `A buyer already offers ${Number(highestBid.pricePerItem).toLocaleString()} gold. Use Sell now or set a higher asking price.`,
            );
          }
        }

        const isListingFullQuantity = requestedQuantity === availableQuantity;

        if (isListingFullQuantity) {
          const claimed = await tx.userItem.updateMany({
            where: {
              id: parsedUserItemId,
              userId,
              status: "IN_INVENTORY",
              quantity: availableQuantity,
            },
            data: {
              status: "LISTED",
              listedPrice: parsedPrice,
              listedAt: new Date(),
            },
          });
          if (claimed.count !== 1) {
            throwHttp(409, "Your inventory changed while creating the listing");
          }

          const updatedSlots = slots.map((slot) =>
            slot.item?.id === parsedUserItemId ? { ...slot, item: null } : slot,
          );
          await tx.inventory.update({
            where: { userId },
            data: { slots: slotsToInputJson(updatedSlots) },
          });

          const updatedListedItem = await tx.userItem.findUniqueOrThrow({
            where: { id: parsedUserItemId },
            include: {
              itemTemplate: true,
              statModifiers: true,
            },
          });

          return {
            listedItem: updatedListedItem,
            itemName: ownedItem.itemTemplate.name,
            quantityListed: availableQuantity,
          };
        }

        const claimed = await tx.userItem.updateMany({
          where: {
            id: parsedUserItemId,
            userId,
            status: "IN_INVENTORY",
            quantity: availableQuantity,
          },
          data: { quantity: availableQuantity - requestedQuantity },
        });
        if (claimed.count !== 1) {
          throwHttp(409, "Your inventory changed while creating the listing");
        }

        // Partial listing: split off the requested quantity into a market stack.
        const newListedItem = await tx.userItem.create({
          data: {
            userId,
            itemId: ownedItem.itemId,
            rarity: ownedItem.rarity,
            quantity: requestedQuantity,
            status: "LISTED",
            listedPrice: parsedPrice,
            listedAt: new Date(),
            acquiredAt: ownedItem.acquiredAt,
            isTradeable: ownedItem.isTradeable,
            statModifiers: {
              create: ownedItem.statModifiers.map((stat) => ({
                statType: stat.statType,
                value: stat.value,
              })),
            },
          },
          include: {
            itemTemplate: true,
            statModifiers: true,
          },
        });

        return {
          listedItem: newListedItem,
          itemName: ownedItem.itemTemplate.name,
          quantityListed: requestedQuantity,
        };
      },
    );

    console.log(
      `[Marketplace] ${quantityListed}x ${itemName} listed by user ${userId} for ${parsedPrice} gold each`,
    );

    return NextResponse.json({
      success: true,
      message: `${quantityListed}x ${itemName} listed for ${parsedPrice} gold each`,
      listing: listedItem,
    });
  } catch (error) {
    const maybeStatus = (error as { status?: unknown })?.status;
    if (typeof maybeStatus === "number" && Number.isFinite(maybeStatus)) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: maybeStatus },
      );
    }
    console.error("Error listing item:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
