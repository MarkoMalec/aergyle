import { prisma } from "~/lib/prisma";
import type { ItemRarity } from "~/generated/prisma/enums";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "~/utils/inventorySlots";
import { lockInventory } from "~/server/items/inventoryLock";

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
 * Split a stack into two separate UserItems
 * Original stack keeps (quantity - splitQuantity), new stack gets splitQuantity
 */
export async function splitStack(
  userId: string,
  userItemId: number,
  splitQuantity: number,
): Promise<{ success: boolean; message: string; newUserItemId?: number }> {
  if (!Number.isSafeInteger(splitQuantity) || splitQuantity <= 0) {
    return { success: false, message: "Invalid split quantity" };
  }

  return prisma.$transaction(async (tx) => {
    const inventory = await lockInventory(tx, userId);
    if (!inventory) {
      return { success: false, message: "Inventory not found" };
    }
    const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
    if (!slots.some((slot) => slot.item?.id === userItemId)) {
      return { success: false, message: "That stack is not in your inventory" };
    }

    const userItem = await tx.userItem.findFirst({
      where: { id: userItemId, userId, status: "IN_INVENTORY" },
      include: { itemTemplate: { select: { stackable: true } } },
    });
    if (!userItem) {
      return { success: false, message: "Item not found" };
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

    const emptySlot = slots.find((slot) => !slot.item);
    if (!emptySlot) {
      return { success: false, message: "Inventory is full, cannot split stack" };
    }

    // Only while the stack still holds what was read, so two splits at once
    // can't both take from the same quantity.
    const taken = await tx.userItem.updateMany({
      where: { id: userItemId, quantity: userItem.quantity },
      data: { quantity: userItem.quantity - splitQuantity },
    });
    if (taken.count !== 1) {
      throw new Error("Your inventory changed. Please try again.");
    }

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
    emptySlot.item = { id: newItem.id };
    await tx.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(slots) },
    });

    return {
      success: true,
      message: `Split ${splitQuantity} from stack`,
      newUserItemId: newItem.id,
    };
  });
}
