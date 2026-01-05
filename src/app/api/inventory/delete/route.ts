import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { normalizeInventorySlots, slotsToInputJson } from "~/utils/inventorySlots";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { userItemId } = await req.json();

    if (!userItemId) {
      return NextResponse.json({ error: "Missing userItemId" }, { status: 400 });
    }

    const userItem = await prisma.userItem.findUnique({
      where: { id: userItemId },
      select: { id: true, userId: true },
    });

    if (!userItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (userItem.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // First, remove the item from inventory JSON
    const userInventory = await prisma.inventory.findUnique({
      where: { userId },
    });

    if (userInventory && userInventory.slots) {
      const slots = normalizeInventorySlots(userInventory.slots, userInventory.maxSlots);
      const updatedSlots = slots.map((slot) => {
        if (slot?.item?.id === userItemId) {
          return { ...slot, item: null };
        }
        return slot;
      });

      await prisma.inventory.update({
        where: { userId },
        data: { slots: slotsToInputJson(updatedSlots) },
      });
    }

    // Delete the UserItem's stats
    await prisma.userItemStat.deleteMany({
      where: { userItemId },
    });

    // Delete the UserItem itself
    await prisma.userItem.delete({ where: { id: userItemId } });

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
