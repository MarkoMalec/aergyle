import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { normalizeInventorySlots, slotsToInputJson } from "~/utils/inventorySlots";

/**
 * Cancel a marketplace listing
 * DELETE /api/marketplace/cancel
 * 
 * Body: {
 *   userItemId: number
 * }
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { userItemId } = await req.json();

    if (!userItemId) {
      return NextResponse.json(
        { error: "Missing required fields: userItemId" },
        { status: 400 }
      );
    }

    // Get the listed item
    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      include: {
        itemTemplate: true,
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

    // Check if item is listed
    if (userItem.status !== "LISTED") {
      return NextResponse.json(
        { error: "This item is not listed on the marketplace" },
        { status: 400 }
      );
    }

    // Get seller's inventory
    const inventory = await prisma.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory not found" },
        { status: 404 }
      );
    }

    // Check if there's space in inventory
    const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
    const emptySlotIndex = slots.findIndex(slot => slot.item === null);

    if (emptySlotIndex === -1) {
      return NextResponse.json(
        { error: "Your inventory is full. Cannot cancel listing." },
        { status: 400 }
      );
    }

    // Update item status back to IN_INVENTORY
    const cancelledItem = await prisma.userItem.update({
      where: { id: userItemId },
      data: {
        status: "IN_INVENTORY",
        listedPrice: null,
        listedAt: null,
      },
      include: {
        itemTemplate: true,
        stats: true,
      },
    });

    // Add item back to seller's inventory slots
    const updatedSlots = slots.map((slot, index) => {
      if (index === emptySlotIndex) {
        return { ...slot, item: { id: userItemId } };
      }
      return slot;
    });

    await prisma.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(updatedSlots) },
    });

    console.log(`[Marketplace] Listing cancelled: ${userItem.itemTemplate.name} returned to user ${userId}'s inventory`);

    return NextResponse.json({
      success: true,
      message: `${userItem.itemTemplate.name} removed from marketplace and returned to your inventory`,
      item: cancelledItem,
    });

  } catch (error) {
    console.error("Error cancelling listing:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
