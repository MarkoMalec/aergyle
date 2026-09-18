import { prisma } from "~/lib/prisma";
import { ItemRarity, type StatType } from "~/generated/prisma/enums";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "~/utils/inventorySlots";
import { EQUIPMENT_SLOTS, getEquippedUserItemIds } from "~/utils/itemEquipTo";
import {
  hydrateEffectiveItemStats,
  ITEM_BALANCE_RELATIONS,
} from "~/server/items/effectiveStats";

/**
 * Create a UserItem instance from an Item template.
 * Template/rarity stats are resolved live; only future instance-specific
 * modifiers (for example enchantments) are stored on the UserItem.
 */
export async function createUserItem(
  userId: string,
  itemId: number,
  rarity: ItemRarity | undefined = undefined,
  status: "IN_INVENTORY" | "EQUIPPED" = "IN_INVENTORY",
): Promise<number> {
  const itemTemplate = await prisma.item.findUnique({
    where: { id: itemId },
  });

  if (!itemTemplate) {
    throw new Error(`Item template ${itemId} not found`);
  }

  rarity ??= itemTemplate.rarity;

  const userItem = await prisma.userItem.create({
    data: {
      userId,
      itemId,
      rarity,
      status,
      isTradeable: true,
    },
  });

  return userItem.id;
}

/**
 * Get UserItem with all its data
 */
export async function getUserItem(userItemId: number) {
  const item = await prisma.userItem.findUnique({
    where: { id: userItemId },
    include: {
      itemTemplate: { include: ITEM_BALANCE_RELATIONS },
      statModifiers: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
  if (!item) return null;
  return (await hydrateEffectiveItemStats([item]))[0] ?? null;
}

/**
 * Get all UserItems for a user
 */
export async function getUserItems(userId: string) {
  const items = await prisma.userItem.findMany({
    where: { userId },
    include: {
      itemTemplate: { include: ITEM_BALANCE_RELATIONS },
      statModifiers: true,
    },
    orderBy: {
      acquiredAt: "desc",
    },
  });
  return hydrateEffectiveItemStats(items);
}

/**
 * Upgrade UserItem rarity
 * Handles stat progressions - new stats may unlock at higher rarities
 */
export async function upgradeUserItemRarity(
  userItemId: number,
  userId: string,
): Promise<{
  success: boolean;
  message: string;
  newRarity?: ItemRarity;
  newStats?: Array<{ statType: StatType; value: number }>;
}> {
  const userItem = await prisma.userItem.findUnique({
    where: { id: userItemId },
    include: {
      statModifiers: true,
      itemTemplate: { include: ITEM_BALANCE_RELATIONS },
    },
  });

  if (!userItem) {
    return { success: false, message: "Item not found" };
  }

  if (userItem.userId !== userId) {
    return { success: false, message: "You don't own this item" };
  }
  if (userItem.status !== "IN_INVENTORY" && userItem.status !== "EQUIPPED") {
    return {
      success: false,
      message: "Only an item in your inventory or equipment can be upgraded",
    };
  }

  // Get current rarity config
  const currentConfig = await prisma.rarityConfig.findUnique({
    where: { rarity: userItem.rarity },
  });

  if (
    !currentConfig ||
    !currentConfig.upgradeEnabled ||
    !currentConfig.nextRarity
  ) {
    return { success: false, message: "This item cannot be upgraded further" };
  }

  const nextConfig = await prisma.rarityConfig.findUnique({
    where: { rarity: currentConfig.nextRarity },
  });

  if (!nextConfig) {
    return { success: false, message: "Next rarity configuration not found" };
  }

  const nextRarity = nextConfig.rarity;
  const upgraded = await prisma.userItem.updateMany({
    where: {
      id: userItemId,
      userId,
      rarity: userItem.rarity,
      status: { in: ["IN_INVENTORY", "EQUIPPED"] },
    },
    data: { rarity: nextRarity },
  });
  if (upgraded.count !== 1) {
    return {
      success: false,
      message: "The item changed before it was upgraded",
    };
  }

  const resolved = await hydrateEffectiveItemStats([
    { ...userItem, rarity: nextRarity },
  ]);
  const newStats = resolved[0]?.stats ?? [];

  return {
    success: true,
    message: `Upgraded to ${nextConfig.displayName}`,
    newRarity: nextRarity,
    newStats,
  };
}

/**
 * Add item to player's inventory with stacking support
 * For stackable items: finds existing stacks and adds to them, creates new stacks if needed
 * For non-stackable items: creates separate UserItem for each instance
 */
export async function addUserItemToInventory(
  userId: string,
  itemId: number,
  rarity: ItemRarity | undefined = undefined,
  quantity = 1,
): Promise<{ success: boolean; message: string; userItemIds: number[] }> {
  if (quantity <= 0) {
    return { success: false, message: "Invalid quantity", userItemIds: [] };
  }

  // Get item template to check if stackable
  const itemTemplate = await prisma.item.findUnique({
    where: { id: itemId },
  });

  if (!itemTemplate) {
    return {
      success: false,
      message: "Item template not found",
      userItemIds: [],
    };
  }

  rarity ??= itemTemplate.rarity;

  // Get user's inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, message: "Inventory not found", userItemIds: [] };
  }

  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
  const affectedUserItemIds: number[] = [];
  let remainingQuantity = quantity;

  // Handle stackable items
  if (itemTemplate.stackable) {
    // Step 1: Find existing stacks with same itemId + rarity
    for (let i = 0; i < slots.length && remainingQuantity > 0; i++) {
      const slot = slots[i];
      const slotUserItemId = slot?.item?.id;
      if (typeof slotUserItemId === "number") {
        const userItem = await prisma.userItem.findUnique({
          where: { id: slotUserItemId },
        });

        if (!userItem) continue;

        // Check if it's the same item, same rarity, and has space
        if (
          userItem.itemId === itemId &&
          userItem.rarity === rarity &&
          userItem.status === "IN_INVENTORY" &&
          userItem.quantity < itemTemplate.maxStackSize
        ) {
          const availableSpace = itemTemplate.maxStackSize - userItem.quantity;
          const amountToAdd = Math.min(availableSpace, remainingQuantity);

          // Update the existing stack
          await prisma.userItem.update({
            where: { id: userItem.id },
            data: { quantity: userItem.quantity + amountToAdd },
          });

          affectedUserItemIds.push(userItem.id);
          remainingQuantity -= amountToAdd;
        }
      }
    }

    // Step 2: Create new stacks for remaining quantity
    while (remainingQuantity > 0) {
      // Find empty slot
      let emptySlotIndex = -1;
      for (let i = 0; i < inventory.maxSlots; i++) {
        const slot = slots.find((s) => s.slotIndex === i);
        if (!slot?.item) {
          emptySlotIndex = i;
          break;
        }
      }

      if (emptySlotIndex === -1) {
        return {
          success: false,
          message: `Inventory is full. Added ${quantity - remainingQuantity} items.`,
          userItemIds: affectedUserItemIds,
        };
      }

      const stackSize = Math.min(remainingQuantity, itemTemplate.maxStackSize);

      // Create new UserItem with quantity
      const newUserItem = await prisma.userItem.create({
        data: {
          userId,
          itemId,
          rarity,
          quantity: stackSize,
          status: "IN_INVENTORY",
          isTradeable: true,
        },
      });

      affectedUserItemIds.push(newUserItem.id);

      // Add to the empty slot
      const existingSlotIndex = slots.findIndex(
        (s) => s.slotIndex === emptySlotIndex,
      );
      if (existingSlotIndex >= 0) {
        slots[existingSlotIndex]!.item = { id: newUserItem.id };
      } else {
        slots.push({
          slotIndex: emptySlotIndex,
          item: { id: newUserItem.id },
        });
      }

      remainingQuantity -= stackSize;
    }

    // Update inventory
    await prisma.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(slots) },
    });

    return {
      success: true,
      message: `Added ${quantity} ${itemTemplate.name}(s) to inventory`,
      userItemIds: affectedUserItemIds,
    };
  } else {
    // Handle non-stackable items (equipment) - create separate UserItem for each
    for (let i = 0; i < quantity; i++) {
      // Find empty slot
      let emptySlotIndex = -1;
      for (let j = 0; j < inventory.maxSlots; j++) {
        const slot = slots.find((s) => s.slotIndex === j);
        if (!slot?.item) {
          emptySlotIndex = j;
          break;
        }
      }

      if (emptySlotIndex === -1) {
        return {
          success: false,
          message: `Inventory is full. Added ${i} of ${quantity} items.`,
          userItemIds: affectedUserItemIds,
        };
      }

      // Create UserItem with stats using existing function
      const userItemId = await createUserItem(
        userId,
        itemId,
        rarity,
        "IN_INVENTORY",
      );
      affectedUserItemIds.push(userItemId);

      // Add to the empty slot
      const existingSlotIndex = slots.findIndex(
        (s) => s.slotIndex === emptySlotIndex,
      );
      if (existingSlotIndex >= 0) {
        slots[existingSlotIndex]!.item = { id: userItemId };
      } else {
        slots.push({
          slotIndex: emptySlotIndex,
          item: { id: userItemId },
        });
      }
    }

    // Update inventory
    await prisma.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(slots) },
    });

    return {
      success: true,
      message: `Added ${quantity} ${itemTemplate.name}(s) to inventory`,
      userItemIds: affectedUserItemIds,
    };
  }
}

/**
 * Split a stack into two separate UserItems
 * Original stack keeps (quantity - splitQuantity), new stack gets splitQuantity
 */
export async function splitStack(
  userId: string,
  userItemId: number,
  splitQuantity: number,
): Promise<{ success: boolean; message: string; newUserItemId?: number }> {
  if (splitQuantity <= 0) {
    return { success: false, message: "Invalid split quantity" };
  }

  // Get the UserItem to split
  const userItem = await prisma.userItem.findUnique({
    where: { id: userItemId },
    include: { itemTemplate: true },
  });

  if (!userItem) {
    return { success: false, message: "Item not found" };
  }

  if (userItem.userId !== userId) {
    return { success: false, message: "You don't own this item" };
  }

  if (!userItem.itemTemplate.stackable) {
    return { success: false, message: "This item cannot be stacked" };
  }

  if (userItem.quantity <= 1) {
    return { success: false, message: "Cannot split a stack of 1" };
  }

  if (splitQuantity >= userItem.quantity) {
    return {
      success: false,
      message: "Split quantity must be less than current quantity",
    };
  }

  // Get user's inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, message: "Inventory not found" };
  }

  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);

  // Find an empty slot for the new stack
  let emptySlotIndex = -1;
  for (let i = 0; i < inventory.maxSlots; i++) {
    const slot = slots.find((s) => s.slotIndex === i);
    if (!slot?.item) {
      emptySlotIndex = i;
      break;
    }
  }

  if (emptySlotIndex === -1) {
    return { success: false, message: "Inventory is full, cannot split stack" };
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Update original stack
    await tx.userItem.update({
      where: { id: userItemId },
      data: { quantity: userItem.quantity - splitQuantity },
    });

    // Create new stack
    const newItem = await tx.userItem.create({
      data: {
        userId,
        itemId: userItem.itemId,
        rarity: userItem.rarity,
        quantity: splitQuantity,
        status: "IN_INVENTORY",
        isTradeable: userItem.isTradeable,
      },
    });

    // Add new stack to empty slot
    const existingSlotIndex = slots.findIndex(
      (s) => s.slotIndex === emptySlotIndex,
    );
    if (existingSlotIndex >= 0) {
      slots[existingSlotIndex]!.item = { id: newItem.id };
    } else {
      slots.push({
        slotIndex: emptySlotIndex,
        item: { id: newItem.id },
      });
    }

    // Update inventory
    await tx.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(slots) },
    });

    return newItem;
  });

  return {
    success: true,
    message: `Split ${splitQuantity} from stack`,
    newUserItemId: result.id,
  };
}

/**
 * Remove UserItem from inventory (but don't delete it)
 */
export async function removeUserItemFromInventory(
  userId: string,
  userItemId: number,
): Promise<{ success: boolean; message: string }> {
  // Get user's inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, message: "Inventory not found" };
  }

  // Parse slots from JSON
  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);

  // Find slot with this item
  const slotIndex = slots.findIndex((s) => s.item?.id === userItemId);

  if (slotIndex === -1) {
    return { success: false, message: "Item not in inventory" };
  }

  // Set item to null (empty slot)
  slots[slotIndex] = {
    slotIndex: slots[slotIndex]!.slotIndex,
    item: null,
  };

  // Update inventory
  await prisma.inventory.update({
    where: { userId },
    data: { slots: slotsToInputJson(slots) },
  });

  return { success: true, message: "Item removed from inventory" };
}

/**
 * Delete UserItem permanently
 */
export async function deleteUserItem(
  userItemId: number,
  userId: string,
): Promise<boolean> {
  const userItem = await prisma.userItem.findUnique({
    where: { id: userItemId },
  });

  if (!userItem || userItem.userId !== userId) {
    return false;
  }

  // Remove from inventory slots (update JSON)
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (inventory) {
    const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
    const updatedSlots = slots.map((s) => {
      if (s.item?.id === userItemId) {
        return { slotIndex: s.slotIndex, item: null };
      }
      return s;
    });

    await prisma.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(updatedSlots) },
    });
  }

  // Delete UserItem (cascade will delete stats)
  await prisma.userItem.delete({
    where: { id: userItemId },
  });

  return true;
}

/**
 * Transfer UserItem to another player
 */
export async function transferUserItem(
  userItemId: number,
  fromUserId: string,
  toUserId: string,
): Promise<{ success: boolean; message: string }> {
  const userItem = await prisma.userItem.findUnique({
    where: { id: userItemId },
  });

  if (!userItem) {
    return { success: false, message: "Item not found" };
  }

  if (userItem.userId !== fromUserId) {
    return { success: false, message: "You don't own this item" };
  }

  if (!userItem.isTradeable) {
    return { success: false, message: "This item cannot be traded" };
  }

  // Remove from sender's inventory
  await removeUserItemFromInventory(fromUserId, userItemId);

  // Transfer ownership
  await prisma.userItem.update({
    where: { id: userItemId },
    data: {
      userId: toUserId,
      status: "IN_INVENTORY", // Reset to inventory when transferring
    },
  });

  return { success: true, message: "Item transferred successfully" };
}

/**
 * Get player's inventory with UserItems
 */
export async function getPlayerInventory(userId: string) {
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return null;
  }

  // Parse slots and fetch UserItems
  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
  const userItemIds = slots.filter((s) => s.item?.id).map((s) => s.item!.id);

  const userItems = await prisma.userItem.findMany({
    where: {
      id: { in: userItemIds },
    },
    include: {
      statModifiers: true,
      itemTemplate: { include: ITEM_BALANCE_RELATIONS },
    },
  });

  const effectiveItems = await hydrateEffectiveItemStats(userItems);

  // Map user items by ID for easy lookup
  const userItemMap = new Map(effectiveItems.map((item) => [item.id, item]));

  // Attach userItems to slots
  const slotsWithItems = slots.map((s) => ({
    slotIndex: s.slotIndex,
    userItem: s.item?.id ? userItemMap.get(s.item.id) ?? null : null,
  }));

  return {
    ...inventory,
    slotsWithItems,
  };
}

/**
 * Get player's equipped items
 */
export async function getPlayerEquipment(userId: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { userId },
  });

  if (!equipment) {
    return null;
  }

  const equippedItemIds = getEquippedUserItemIds(equipment);

  const userItems = await prisma.userItem.findMany({
    where: {
      id: { in: equippedItemIds },
      userId,
    },
    include: {
      itemTemplate: { include: ITEM_BALANCE_RELATIONS },
      statModifiers: true,
    },
  });

  const effectiveItems = await hydrateEffectiveItemStats(userItems);
  const userItemMap = new Map(effectiveItems.map((item) => [item.id, item]));

  return Object.fromEntries(
    EQUIPMENT_SLOTS.map(({ slot, dbField }) => {
      const userItemId = equipment[dbField];
      return [slot, userItemId ? userItemMap.get(userItemId) ?? null : null];
    }),
  );
}
