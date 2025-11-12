import { NextRequest, NextResponse } from "next/server";
import { prisma } from "~/lib/prisma";
import { Prisma } from "@prisma/client";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { getInventoryCapacity } from "~/utils/inventoryCapacity";

export async function POST(req: NextRequest) {
  try {
    const { userId, inventory } = await req.json();

    if (!userId || !inventory || !Array.isArray(inventory)) {
      return NextResponse.json(
        { error: "Invalid request: userId and inventory array required" },
        { status: 400 },
      );
    }

    const userInventory = await prisma.inventory.update({
      where: { userId },
      data: { slots: inventory },
    });

    return NextResponse.json(
      {
        message: "Inventory updated successfully",
        inventory: userInventory,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating inventory:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Bad Request: Missing userId" },
        { status: 400 },
      );
    }

    const userInventory = await prisma.inventory.findUnique({
      where: { userId },
    });

    if (!userInventory || !userInventory.slots) {
      return NextResponse.json(
        { error: "Inventory not found or empty" },
        { status: 404 },
      );
    }

    const slots = userInventory.slots as Prisma.JsonArray;

    const itemIds: number[] = [];
    const slotStructure: { index: number; itemId: number | null }[] = [];

    slots.forEach((slot, index) => {
      if (typeof slot === "object" && slot !== null && "item" in slot) {
        const slotObj = slot as Prisma.JsonObject;
        const slotItem = slotObj.item as Prisma.JsonObject;
        if (slotItem && "id" in slotItem) {
          const itemId = slotItem.id as number;
          itemIds.push(itemId);
          slotStructure.push({ index, itemId });
        } else {
          slotStructure.push({ index, itemId: null });
        }
      } else {
        slotStructure.push({ index, itemId: null });
      }
    });

    // Fetch UserItems (with rarity and stats)
    const userItems = await fetchUserItemsByIds(itemIds);
    const itemMap = new Map(userItems.map((item) => [item.id, item]));

    const slotsWithItems = slotStructure.map(({ index, itemId }) => ({
      slotIndex: index,
      item: itemId ? itemMap.get(itemId) || null : null,
    }));


    // Get inventory capacity info
    const capacity = await getInventoryCapacity(userId);

    // Ensure we have exactly capacity.max slots
    // If current slots > capacity.max, we need to preserve items from bonus slots
    // If current slots < capacity.max, expand with empty slots
    let expandedSlots = [...slotsWithItems];
    let needsUpdate = false;
    
    if (expandedSlots.length > capacity.max) {
      (`[Inventory API] Capacity decreased from ${expandedSlots.length} to ${capacity.max}`);
      
      // Find items in bonus slots (slots >= capacity.max)
      const itemsInBonusSlots = expandedSlots
        .slice(capacity.max)
        .filter(slot => slot.item !== null);
      
      if (itemsInBonusSlots.length > 0) {
        (`[Inventory API] Found ${itemsInBonusSlots.length} items in bonus slots that need to be moved`);
        
        // Find empty slots in base capacity
        const emptySlotIndices: number[] = [];
        for (let i = 0; i < capacity.max; i++) {
          if (expandedSlots[i]?.item === null) {
            emptySlotIndices.push(i);
          }
        }
        
        (`[Inventory API] Found ${emptySlotIndices.length} empty base slots available`);
        
        // Move items from bonus slots to empty base slots
        let movedCount = 0;
        for (const bonusSlot of itemsInBonusSlots) {
          if (emptySlotIndices.length > 0) {
            const targetIndex = emptySlotIndices.shift()!;
            expandedSlots[targetIndex] = {
              slotIndex: targetIndex,
              item: bonusSlot.item,
            };
            movedCount++;
            (`[Inventory API] Moved item "${bonusSlot.item?.name}" from bonus slot to slot ${targetIndex}`);
          } else {
            // No empty slots
            console.warn(`[Inventory API] WARNING: No empty slot for item "${bonusSlot.item?.name}" - item will be lost!`);
          }
        }
        
        (`[Inventory API] Moved ${movedCount} items from bonus slots to base slots`);
        needsUpdate = true;
      }
      
      // Now truncate to capacity.max
      expandedSlots = expandedSlots.slice(0, capacity.max);
      (`[Inventory API] Truncated slots to ${capacity.max}`);
    } else if (expandedSlots.length < capacity.max) {
      // Expand to max capacity
      while (expandedSlots.length < capacity.max) {
        expandedSlots.push({
          slotIndex: expandedSlots.length,
          item: null,
        });
      }
    }

    // Update database if we moved items
    if (needsUpdate) {
      const slotsToSave = expandedSlots.map(slot => ({
        slotIndex: slot.slotIndex,
        item: slot.item ? { id: slot.item.id } : null,
      }));
      
      await prisma.inventory.update({
        where: { userId },
        data: { slots: slotsToSave },
      });
      
      (`[Inventory API] Updated database with reorganized inventory`);
    }

    (`[Inventory API] Returning ${expandedSlots.length} slots (capacity.max: ${capacity.max})`);

    // Fetch delete slot item if it exists
    let deleteSlotItem = null;
    if (userInventory.deleteSlotId) {
      const deleteSlotItems = await fetchUserItemsByIds([userInventory.deleteSlotId]);
      deleteSlotItem = deleteSlotItems[0] || null;
    }

    const deleteSlot = {
      slotIndex: 999,
      item: deleteSlotItem,
    };

    return NextResponse.json({ 
      slots: expandedSlots, 
      deleteSlot,
      capacity: {
        current: capacity.current,
        max: capacity.max,
        base: capacity.base,
        bonus: capacity.bonus,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
