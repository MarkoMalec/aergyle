import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";

export async function DELETE(req: NextRequest) {
  try {
    const { userId, userItemId } = await req.json();

    if (!userId || !userItemId) {
      return NextResponse.json(
        { error: "Missing userId or userItemId" },
        { status: 400 },
      );
    }

    // First, remove the item from inventory JSON
    const userInventory = await prisma.inventory.findUnique({
      where: { userId },
    });

    if (userInventory && userInventory.slots) {
      const slots = userInventory.slots as any[];
      const updatedSlots = slots.map((slot) => {
        if (slot?.item?.id === userItemId) {
          return { ...slot, item: null };
        }
        return slot;
      });

      await prisma.inventory.update({
        where: { userId },
        data: { slots: updatedSlots },
      });
    }

    // Delete the UserItem's stats
    await prisma.userItemStat.deleteMany({
      where: { userItemId },
    });

    // Delete the UserItem itself
    await prisma.userItem.delete({
      where: { id: userItemId },
    });

    return NextResponse.json(
      { message: "Item deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error deleting item:", error);
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 },
    );
  }
}
