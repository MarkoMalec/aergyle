import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { lockInventory } from "~/server/items/inventoryLock";

/**
 * Destroys the item waiting in the player's delete slot, and only that one:
 * nothing else (an equipped, listed or stored item) can be deleted by id.
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = (await req.json().catch(() => null)) as {
    userItemId?: unknown;
  } | null;
  const userItemId = body?.userItemId;
  if (
    typeof userItemId !== "number" ||
    !Number.isSafeInteger(userItemId) ||
    userItemId <= 0
  ) {
    return NextResponse.json({ error: "Missing userItemId" }, { status: 400 });
  }

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const inventory = await lockInventory(tx, userId);
      if (!inventory || inventory.deleteSlotId !== userItemId) return false;

      // Per-instance modifiers cascade with the UserItem.
      const removed = await tx.userItem.deleteMany({
        where: {
          id: userItemId,
          userId,
          status: { in: ["IN_INVENTORY", "EQUIPPED"] },
        },
      });
      await tx.inventory.update({
        where: { userId },
        data: { deleteSlotId: null },
      });
      return removed.count === 1;
    });

    if (!deleted) {
      return NextResponse.json(
        { error: "That item is no longer in the delete slot" },
        { status: 409 },
      );
    }
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
