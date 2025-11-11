import { NextRequest, NextResponse } from "next/server";
import { ItemRarity, Prisma } from "@prisma/client";
import { prisma } from "~/lib/prisma";
import { createUserItem } from "~/utils/userItems";

/**
 * POST /api/test/add-item
 * Creates UserItem instance with rarity and adds to inventory
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, itemId, rarity } = body;

    if (!userId || !itemId || !rarity) {
      return NextResponse.json(
        { error: "userId, itemId, and rarity are required" },
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

    // Create UserItem instance with rarity and stats
    const userItemId = await createUserItem(userId, itemId, rarity, "IN_INVENTORY");

    // Get user's inventory
    const inventory = await prisma.inventory.findUnique({
      where: { userId },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "Inventory not found" },
        { status: 404 }
      );
    }

    // Parse existing slots
    const slots = (inventory.slots as Prisma.JsonArray) || [];
    
    // Find first empty slot
    let emptySlotIndex = -1;
    for (let i = 0; i < inventory.maxSlots; i++) {
      const slot = slots[i] as any;
      if (!slot || !slot.item || slot.item === null) {
        emptySlotIndex = i;
        break;
      }
    }

    if (emptySlotIndex === -1) {
      return NextResponse.json(
        { error: "Inventory is full" },
        { status: 400 }
      );
    }

    // Build updated slots array - NOW USING UserItem IDs
    const updatedSlots = Array.from({ length: inventory.maxSlots }, (_, index) => {
      if (index === emptySlotIndex) {
        return {
          slotIndex: index,
          item: { id: userItemId }, // UserItem instance ID
        };
      }
      
      const existingSlot = slots[index] as any;
      return {
        slotIndex: index,
        item: existingSlot?.item || null,
      };
    });

    // Update inventory
    await prisma.inventory.update({
      where: { userId },
      data: {
        slots: updatedSlots as any,
      },
    });

    return NextResponse.json({
      success: true,
      userItemId,
      itemName: itemTemplate.name,
      rarity: rarity,
      slotIndex: emptySlotIndex,
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
