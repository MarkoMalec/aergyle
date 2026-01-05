import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { normalizeInventorySlots, slotsToInputJson } from "~/utils/inventorySlots";

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
    const body = await req.json();
    const parsedUserItemId = Number(body?.userItemId);
    const parsedPrice = Number(body?.price);
    const requestedQuantity = Number(body?.quantity);

    if (body?.userItemId == null || body?.price == null || body?.quantity == null) {
      return NextResponse.json(
        { error: "Missing required fields: userItemId, price, quantity" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(parsedUserItemId) || !Number.isInteger(parsedUserItemId)) {
      return NextResponse.json({ error: "Invalid userItemId" }, { status: 400 });
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json(
        { error: "Price must be greater than 0" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(requestedQuantity) || !Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    const { listedItem, itemName, quantityListed } = await prisma.$transaction(async (tx) => {
      const userItem = await tx.userItem.findUnique({
        where: { id: parsedUserItemId },
        include: {
          itemTemplate: true,
          stats: true,
        },
      });

      if (!userItem) {
        throwHttp(404, "Item not found");
      }

      const ownedItem = userItem!;

      if (ownedItem.userId !== userId) {
        throwHttp(403, "You don't own this item");
      }

      if (!ownedItem.isTradeable) {
        throwHttp(400, "This item cannot be traded");
      }

      if (ownedItem.status !== "IN_INVENTORY") {
        throwHttp(
          400,
          `Cannot list item with status: ${ownedItem.status}. Item must be in your inventory.`
        );
      }

      const availableQuantity = ownedItem.quantity || 1;
      if (!ownedItem.itemTemplate.stackable && requestedQuantity !== 1) {
        throwHttp(400, "This item is not stackable and can only be listed as quantity 1");
      }

      if (requestedQuantity > availableQuantity) {
        throwHttp(400, `Only ${availableQuantity} available`);
      }

      const isListingFullQuantity = requestedQuantity === availableQuantity;

      if (isListingFullQuantity) {
        // Remove from inventory slots (only when listing the full stack)
        const inventory = await tx.inventory.findUnique({ where: { userId } });
        if (inventory) {
          const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
          const updatedSlots = slots.map((slot) => {
            if (slot.item?.id === parsedUserItemId) {
              return { ...slot, item: null };
            }
            return slot;
          });

          await tx.inventory.update({
            where: { userId },
            data: { slots: slotsToInputJson(updatedSlots) },
          });
        }

        const updatedListedItem = await tx.userItem.update({
          where: { id: parsedUserItemId },
          data: {
            status: "LISTED",
            listedPrice: parsedPrice,
            listedAt: new Date(),
          },
          include: {
            itemTemplate: true,
            stats: true,
          },
        });

        return {
          listedItem: updatedListedItem,
          itemName: ownedItem.itemTemplate.name,
          quantityListed: availableQuantity,
        };
      }

      // Partial listing: create new listed item and decrement the stack in inventory
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
          stats: {
            create: ownedItem.stats.map((stat) => ({
              statType: stat.statType,
              value: stat.value,
            })),
          },
        },
        include: {
          itemTemplate: true,
          stats: true,
        },
      });

      await tx.userItem.update({
        where: { id: parsedUserItemId },
        data: {
          quantity: availableQuantity - requestedQuantity,
        },
      });

      return {
        listedItem: newListedItem,
        itemName: ownedItem.itemTemplate.name,
        quantityListed: requestedQuantity,
      };
    });

    console.log(
      `[Marketplace] ${quantityListed}x ${itemName} listed by user ${userId} for ${parsedPrice} gold each`
    );

    return NextResponse.json({
      success: true,
      message: `${quantityListed}x ${itemName} listed for ${parsedPrice} gold each`,
      listing: listedItem,
    });
  } catch (error) {
    const maybeStatus = (error as { status?: unknown })?.status;
    if (typeof maybeStatus === "number" && Number.isFinite(maybeStatus)) {
      return NextResponse.json({ error: (error as Error).message }, { status: maybeStatus });
    }
    console.error("Error listing item:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
