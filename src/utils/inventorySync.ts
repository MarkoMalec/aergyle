import { prisma } from "~/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Sync helpers for maintaining both JSON slots (for DnD) and relational InventorySlot
 */

/**
 * Get user's inventory with both JSON slots and UserItem instances
 * Reads existing JSON format: [{ slotIndex: 0, item: { id: X } }, ...]
 */
export async function getUserInventoryWithItems(userId: string) {
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    include: {
      slotData: {
        include: {
          userItem: {
            include: {
              itemTemplate: {
                include: {
                  stats: true,
                },
              },
              stats: true,
            },
          },
        },
        orderBy: {
          slotIndex: "asc",
        },
      },
    },
  });

  if (!inventory) return null;

  // Parse JSON slots (existing format: { slotIndex, item: { id } })
  const jsonSlots = (inventory.slots as Prisma.JsonArray) || [];

  // Build a map of slotIndex -> UserItem from relational data
  const slotMap = new Map(
    inventory.slotData.map((slot) => [slot.slotIndex, slot.userItem]),
  );

  // Parse JSON and combine with UserItem data
  const slots = jsonSlots.map((slotData, index) => {
    const slot = slotData as Prisma.JsonObject;
    const slotIndex = (slot.slotIndex as number) ?? index;
    const itemData = slot.item as Prisma.JsonObject | null;
    const itemId = itemData?.id as number | null;

    // Try to get UserItem from relational data first, fallback to JSON itemId
    const userItem = slotMap.get(slotIndex) || null;

    return {
      slotIndex,
      userItemId: userItem?.id || itemId,
      userItem: userItem,
    };
  });

  // Fill remaining slots if JSON has fewer than maxSlots
  while (slots.length < inventory.maxSlots) {
    slots.push({
      slotIndex: slots.length,
      userItemId: null,
      userItem: null,
    });
  }

  return {
    ...inventory,
    slots,
  };
}

/**
 * Update inventory slots - maintains both JSON and relational data
 * IMPORTANT: Maintains compatibility with existing JSON format { item: { id: X } }
 */
export async function updateInventorySlots(
  userId: string,
  slots: Array<{ slotIndex: number; userItemId: number | null }>,
) {
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  // Build JSON in the existing format: { item: { id: X } } or { item: null }
  const jsonSlots = slots.map((slot) => ({
    slotIndex: slot.slotIndex,
    item: slot.userItemId ? { id: slot.userItemId } : null,
  }));

  // Update in transaction
  await prisma.$transaction(async (tx) => {
    // Update JSON
    await tx.inventory.update({
      where: { userId },
      data: {
        slots: jsonSlots as any,
      },
    });

    // Delete existing slot mappings
    await tx.inventorySlot.deleteMany({
      where: { inventoryId: inventory.id },
    });

    // Create new slot mappings (only for non-empty slots)
    const slotsToCreate = slots
      .filter((slot) => slot.userItemId !== null)
      .map((slot) => ({
        inventoryId: inventory.id,
        slotIndex: slot.slotIndex,
        userItemId: slot.userItemId!,
      }));

    if (slotsToCreate.length > 0) {
      await tx.inventorySlot.createMany({
        data: slotsToCreate,
      });
    }
  });
}

/**
 * Add item to inventory - finds first empty slot
 */
export async function addItemToInventory(userId: string, userItemId: number) {
  const inventory = await getUserInventoryWithItems(userId);

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  // Find first empty slot
  const emptySlotIndex = inventory.slots.findIndex(
    (slot) => slot.userItemId === null,
  );

  if (emptySlotIndex === -1) {
    throw new Error("Inventory is full");
  }

  // Update slots with new item
  const updatedSlots = inventory.slots.map((slot, index) => ({
    slotIndex: index,
    userItemId: index === emptySlotIndex ? userItemId : slot.userItemId,
  }));

  await updateInventorySlots(userId, updatedSlots);

  return emptySlotIndex;
}

/**
 * Remove item from inventory
 */
export async function removeItemFromInventory(
  userId: string,
  userItemId: number,
) {
  const inventory = await getUserInventoryWithItems(userId);

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  // Remove item from slots
  const updatedSlots = inventory.slots.map((slot) => ({
    slotIndex: slot.slotIndex,
    userItemId: slot.userItemId === userItemId ? null : slot.userItemId,
  }));

  await updateInventorySlots(userId, updatedSlots);
}

/**
 * Move item between slots (for DnD)
 */
export async function moveItemInInventory(
  userId: string,
  fromSlotIndex: number,
  toSlotIndex: number,
) {
  const inventory = await getUserInventoryWithItems(userId);

  if (!inventory) {
    throw new Error("Inventory not found");
  }

  const slots = inventory.slots;
  const fromItem = slots[fromSlotIndex]?.userItemId;
  const toItem = slots[toSlotIndex]?.userItemId;

  // Swap items
  const updatedSlots = slots.map((slot, index) => {
    if (index === fromSlotIndex) {
      return { slotIndex: index, userItemId: toItem ?? null };
    }
    if (index === toSlotIndex) {
      return { slotIndex: index, userItemId: fromItem ?? null };
    }
    return { slotIndex: index, userItemId: slot.userItemId ?? null };
  });

  await updateInventorySlots(userId, updatedSlots);
}

/**
 * Get equipment with UserItem instances
 */
export async function getUserEquipmentWithItems(userId: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { userId },
  });

  if (!equipment) return null;

  // Fetch UserItems for each slot
  const slots = [
    "head",
    "chest",
    "belt",
    "greaves",
    "boots",
    "necklace",
    "ring1",
    "ring2",
    "amulet",
    "pauldrons",
    "bracers",
    "gloves",
    "backpack",
    "weapon",
  ] as const;

  const userItemIds = slots
    .map((slot) => equipment[`${slot}ItemId` as keyof typeof equipment])
    .filter((id): id is number => id !== null);

  const userItems = await prisma.userItem.findMany({
    where: {
      id: { in: userItemIds },
    },
    include: {
      itemTemplate: {
        include: {
          stats: true,
        },
      },
      stats: true,
    },
  });

  const userItemMap = new Map(userItems.map((item) => [item.id, item]));

  // Build equipment object with UserItem data
  const equipmentWithItems: Record<string, any> = { ...equipment };
  slots.forEach((slot) => {
    const userItemId = equipment[`${slot}ItemId` as keyof typeof equipment];
    equipmentWithItems[slot] =
      userItemId && typeof userItemId === "number"
        ? userItemMap.get(userItemId)
        : null;
  });

  return equipmentWithItems;
}
