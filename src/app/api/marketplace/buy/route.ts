import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

/**
 * Buy an item from the marketplace
 * POST /api/marketplace/buy
 * 
 * Body: {
 *   buyerId: string,
 *   userItemId: number
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { buyerId, userItemId } = await req.json();

    if (!buyerId || !userItemId) {
      return NextResponse.json(
        { error: "Missing required fields: buyerId, userItemId" },
        { status: 400 }
      );
    }

    // Get the listed item
    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      include: {
        itemTemplate: true,
        stats: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!userItem) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Check if item is listed
    if (userItem.status !== "LISTED") {
      return NextResponse.json(
        { error: "This item is not listed on the marketplace" },
        { status: 400 }
      );
    }

    // Check if buyer is not the seller
    if (userItem.userId === buyerId) {
      return NextResponse.json(
        { error: "You cannot buy your own item" },
        { status: 400 }
      );
    }

    const price = userItem.listedPrice || 0;
    const sellerId = userItem.userId;

    // Get buyer to check gold balance
    const buyer = await prisma.user.findUnique({
      where: { id: buyerId },
      select: { id: true, gold: true },
    });

    if (!buyer) {
      return NextResponse.json(
        { error: "Buyer not found" },
        { status: 404 }
      );
    }

    // Check if buyer has enough gold
    if (buyer.gold.lt(price)) {
      return NextResponse.json(
        { error: `Insufficient gold. You need ${price} gold but only have ${buyer.gold}` },
        { status: 400 }
      );
    }

    // Get buyer's inventory
    const buyerInventory = await prisma.inventory.findUnique({
      where: { userId: buyerId },
    });

    if (!buyerInventory) {
      return NextResponse.json(
        { error: "Buyer inventory not found" },
        { status: 404 }
      );
    }

    // Check if buyer has space in inventory
    const slots = buyerInventory.slots as any[];
    const emptySlotIndex = slots.findIndex(slot => slot.item === null);

    if (emptySlotIndex === -1) {
      return NextResponse.json(
        { error: "Your inventory is full" },
        { status: 400 }
      );
    }

    // Prepare updated inventory slots
    const updatedSlots = slots.map((slot, index) => {
      if (index === emptySlotIndex) {
        return { ...slot, item: { id: userItemId } };
      }
      return slot;
    });

    // Execute transaction: transfer item, deduct buyer gold, add seller gold
    const [updatedItem] = await prisma.$transaction([
      // Transfer item to buyer
      prisma.userItem.update({
        where: { id: userItemId },
        data: {
          userId: buyerId,
          status: "IN_INVENTORY",
          listedPrice: null,
          listedAt: null,
        },
        include: {
          itemTemplate: true,
          stats: true,
        },
      }),
      // Update buyer's inventory
      prisma.inventory.update({
        where: { userId: buyerId },
        data: { slots: updatedSlots },
      }),
      // Deduct gold from buyer
      prisma.user.update({
        where: { id: buyerId },
        data: { gold: { decrement: price } },
      }),
      // Add gold to seller
      prisma.user.update({
        where: { id: sellerId },
        data: { gold: { increment: price } },
      }),
    ]);

    console.log(`[Marketplace] ${userItem.itemTemplate.name} sold from ${userItem.user.name} to buyer ${buyerId} for ${price} gold`);

    return NextResponse.json({
      success: true,
      message: `Purchased ${userItem.itemTemplate.name} for ${price} gold`,
      item: updatedItem,
      seller: userItem.user.name,
      price,
    });

  } catch (error) {
    console.error("Error buying item:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
