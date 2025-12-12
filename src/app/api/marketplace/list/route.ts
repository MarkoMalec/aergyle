import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

/**
 * List an item on the marketplace
 * POST /api/marketplace/list
 * 
 * Body: {
 *   userId: string,
 *   userItemId: number,
 *   price: number,
 *   quantity: number
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, userItemId, price, quantity } = await req.json();

    if (!userId || !userItemId || price === undefined || price === null || quantity === undefined || quantity === null) {
      return NextResponse.json(
        { error: "Missing required fields: userId, userItemId, price, quantity" },
        { status: 400 }
      );
    }

    if (price <= 0) {
      return NextResponse.json(
        { error: "Price must be greater than 0" },
        { status: 400 }
      );
    }

    // Get the item with status check
    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      include: {
        itemTemplate: true,
        stats: true,
      },
    });

    if (!userItem) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (userItem.userId !== userId) {
      return NextResponse.json(
        { error: "You don't own this item" },
        { status: 403 }
      );
    }

    // Check if item is tradeable
    if (!userItem.isTradeable) {
      return NextResponse.json(
        { error: "This item cannot be traded" },
        { status: 400 }
      );
    }

    // Check if item is in inventory (not equipped or already listed)
    if (userItem.status !== "IN_INVENTORY") {
      return NextResponse.json(
        { error: `Cannot list item with status: ${userItem.status}. Item must be in your inventory.` },
        { status: 400 }
      );
    }

    // Remove from inventory slots
    const inventory = await prisma.inventory.findUnique({
      where: { userId },
    });

    if (inventory) {
      const slots = inventory.slots as any[];
      const updatedSlots = slots.map(slot => {
        if (slot.item?.id === userItemId) {
          return { ...slot, item: null };
        }
        return slot;
      });

      await prisma.inventory.update({
        where: { userId },
        data: { slots: updatedSlots },
      });
    }

    // Update item status to LISTED
    const listedItem = await prisma.userItem.update({
      where: { id: userItemId },
      data: {
        status: "LISTED",
        listedPrice: price,
        listedAt: new Date(),
      },
      include: {
        itemTemplate: true,
        stats: true,
      },
    });

    console.log(`[Marketplace] ${userItem.itemTemplate.name} listed by user ${userId} for ${price} gold`);

    return NextResponse.json({
      success: true,
      message: `${userItem.itemTemplate.name} listed for ${price} gold`,
      listing: listedItem,
    });

  } catch (error) {
    console.error("Error listing item:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
