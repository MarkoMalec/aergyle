import { NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { getServerAuthSession } from "~/server/auth";
import { normalizeInventorySlots } from "~/utils/inventorySlots";
import {
  hydrateEffectiveItemStats,
  ITEM_BALANCE_RELATIONS,
} from "~/server/items/effectiveStats";

export const dynamic = "force-dynamic";

/** Tradeable items that are physically present in the current player's inventory. */
export async function GET() {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inventory = await prisma.inventory.findUnique({
      where: { userId: session.user.id },
    });
    if (!inventory) {
      return NextResponse.json({ items: [] });
    }

    const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
    const slotByItemId = new Map<number, number>();
    for (const slot of slots) {
      if (slot.item) slotByItemId.set(slot.item.id, slot.slotIndex);
    }
    const itemIds = [...slotByItemId.keys()];
    const items = await prisma.userItem.findMany({
      where: {
        id: { in: itemIds },
        userId: session.user.id,
        status: "IN_INVENTORY",
        isTradeable: true,
      },
      include: {
        itemTemplate: { include: ITEM_BALANCE_RELATIONS },
        statModifiers: true,
      },
    });
    const effectiveItems = await hydrateEffectiveItemStats(items);

    return NextResponse.json({
      items: effectiveItems
        .map((item) => ({ ...item, slotIndex: slotByItemId.get(item.id) ?? 0 }))
        .sort((a, b) => a.slotIndex - b.slotIndex),
    });
  } catch (error) {
    console.error("Error fetching sellable inventory:", error);
    return NextResponse.json(
      { error: "Could not load sellable inventory" },
      { status: 500 },
    );
  }
}
