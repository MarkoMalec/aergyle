import { NextRequest, NextResponse } from "next/server";
import { ItemRarity } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { createUserItem } from "~/utils/userItems";
import { getServerAuthSession } from "~/server/auth";
import { normalizeInventorySlots, slotsToInputJson } from "~/utils/inventorySlots";
import { grantStackableItemToInventory } from "~/server/vocations/grantItem";

/**
 * POST /api/test/add-item
 * Creates UserItem instance with rarity and adds to inventory
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;
    const { itemId, rarity, quantity } = body;

    const qty = Math.max(1, Math.floor(Number(quantity ?? 1)));

    if (!itemId || !rarity) {
      return NextResponse.json(
        { error: "itemId and rarity are required" },
        { status: 400 }
      );
    }

    // Validate rarity
    if (!Object.values(ItemRarity).includes(rarity)) {
      return NextResponse.json(
        { error: `Invalid rarity: ${rarity}` },
        { status: 400 }
      );
    }

    // Get item template
    const itemTemplate = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!itemTemplate) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Stackables: fast-path via stacking helper (preserves existing stacks).
    if (itemTemplate.stackable) {
      const grant = await grantStackableItemToInventory({
        db: prisma,
        userId,
        itemId,
        rarity,
        quantity: qty,
      });

      return NextResponse.json({
        success: true,
        itemName: itemTemplate.name,
        rarity,
        addedQuantity: grant.addedQuantity,
        remainingQuantity: grant.remainingQuantity,
      });
    }

    // Non-stackables: create full UserItem instances (stats, etc) and place into empty slots.
    const inventory = await prisma.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      return NextResponse.json({ error: "Inventory not found" }, { status: 404 });
    }

    const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
    let remainingToAdd = qty;
    const createdUserItemIds: number[] = [];

    while (remainingToAdd > 0) {
      const emptySlotIndex = slots.findIndex((s) => s.item === null);
      if (emptySlotIndex === -1) break;

      const userItemId = await createUserItem(
        userId,
        itemId,
        rarity,
        "IN_INVENTORY",
      );

      slots[emptySlotIndex] = {
        slotIndex: emptySlotIndex,
        item: { id: userItemId },
      };

      createdUserItemIds.push(userItemId);
      remainingToAdd -= 1;
    }

    await prisma.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(slots) },
    });

    const addedQuantity = qty - remainingToAdd;

    return NextResponse.json({
      success: true,
      itemName: itemTemplate.name,
      rarity,
      addedQuantity,
      remainingQuantity: remainingToAdd,
      createdUserItemIds,
      slotIndex: createdUserItemIds.length === 1
        ? slots.findIndex((s) => s.item?.id === createdUserItemIds[0])
        : undefined,
    });
  } catch (error) {
    console.error("Error adding test item:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to add item",
      },
      { status: 500 }
    );
  }
}
