import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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

/** Withdraw a sell listing and atomically return it to inventory. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await req.json()) as { userItemId?: unknown };
    const userItemId = Number(body.userItemId);
    if (!Number.isInteger(userItemId) || userItemId < 1) {
      return NextResponse.json({ error: "Invalid listing" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.userItem.findFirst({
        where: { id: userItemId, userId: session.user.id },
        include: { itemTemplate: true, statModifiers: true },
      });
      if (!listing) fail(404, "Listing not found");
      if (listing.status !== "LISTED") {
        fail(409, "This listing is no longer active");
      }

      if (listing.itemTemplate.stackable) {
        const claimed = await tx.userItem.updateMany({
          where: {
            id: listing.id,
            userId: session.user.id,
            status: "LISTED",
            quantity: listing.quantity,
          },
          data: { status: "DELETED", listedPrice: null, listedAt: null },
        });
        if (claimed.count !== 1) fail(409, "The listing changed");

        const grant = await grantStackableItemToInventory({
          db: tx,
          userId: session.user.id,
          itemId: listing.itemId,
          rarity: listing.rarity,
          quantity: listing.quantity,
          statModifiers: listing.statModifiers,
        });
        if (grant.remainingQuantity > 0) {
          fail(
            400,
            "Your inventory does not have enough room to withdraw this stack",
          );
        }
      } else {
        const inventory = await lockInventory(tx, session.user.id);
        if (!inventory) fail(404, "Inventory not found");
        const slots = normalizeInventorySlots(
          inventory.slots,
          inventory.maxSlots,
        );
        const emptyIndex = slots.findIndex((slot) => slot.item === null);
        if (emptyIndex < 0) {
          fail(
            400,
            "Your inventory is full. Make room before withdrawing this item.",
          );
        }

        const claimed = await tx.userItem.updateMany({
          where: { id: listing.id, userId: session.user.id, status: "LISTED" },
          data: { status: "IN_INVENTORY", listedPrice: null, listedAt: null },
        });
        if (claimed.count !== 1) fail(409, "The listing changed");
        slots[emptyIndex] = { slotIndex: emptyIndex, item: { id: listing.id } };
        await tx.inventory.update({
          where: { userId: session.user.id },
          data: { slots: slotsToInputJson(slots) },
        });
      }

      return { name: listing.itemTemplate.name, quantity: listing.quantity };
    });

    return NextResponse.json({
      success: true,
      message: `${result.quantity}× ${result.name} returned to your inventory`,
    });
  } catch (error) {
    const status = (error as HttpError).status;
    if (typeof status === "number") {
      return NextResponse.json({ error: (error as Error).message }, { status });
    }
    console.error("Error withdrawing marketplace listing:", error);
    return NextResponse.json(
      { error: "Could not withdraw the listing" },
      { status: 500 },
    );
  }
}
