import type { ItemRarity, StatType } from "~/generated/prisma/enums";
import type { PrismaClient } from "~/generated/prisma/client";
import type { ItemQuantityChange } from "~/realtime/events";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "~/utils/inventorySlots";
import { lockInventory } from "~/server/items/inventoryLock";

type DbClient = Pick<PrismaClient, "item" | "inventory" | "userItem" | "$queryRaw">;

export type GrantResult = {
  addedQuantity: number;
  remainingQuantity: number;
  affectedUserItemIds: number[];
  updatedSlots: Array<{ slotIndex: number; item: { id: number } | null }>;
  /** New quantity of every stack this grant touched. */
  itemChanges: ItemQuantityChange[];
  /** True when the grant opened new stacks rather than only topping up existing ones. */
  newStacks: boolean;
};

/**
 * How many more of an item fit: free room in existing matching stacks plus empty
 * slots. Mirrors how grantStackableItemToInventory fills, so callers can size a
 * claim before writing anything.
 */
export function getStackCapacity(params: {
  stackable: boolean;
  maxStackSize: number;
  stackQuantities: readonly number[];
  emptySlots: number;
}): number {
  const emptySlots = Math.max(0, params.emptySlots);
  if (!params.stackable) return emptySlots;

  const maxStackSize = Math.max(1, params.maxStackSize);
  const roomInStacks = params.stackQuantities.reduce(
    (room, quantity) => room + Math.max(0, maxStackSize - quantity),
    0,
  );
  return roomInStacks + emptySlots * maxStackSize;
}

// Grants items into the JSON inventory slots with stacking.
// Optimized for bulk rewards (no per-slot DB calls).
// With `unitSize`, only whole units that fit are granted (e.g. a crop's full yield,
// or N × yieldPerUnit), so a caller never ends up holding part of a unit.
export async function grantStackableItemToInventory(params: {
  db: DbClient;
  userId: string;
  itemId: number;
  rarity: ItemRarity;
  quantity: number;
  unitSize?: number;
  statModifiers?: ReadonlyArray<{ statType: StatType; value: number }>;
}): Promise<GrantResult> {
  const { db, userId, itemId, rarity } = params;
  const requestedQuantity = Math.max(0, Math.floor(params.quantity));
  const unitSize = Math.max(1, Math.floor(params.unitSize ?? 1));

  const itemTemplate = await db.item.findUnique({
    where: { id: itemId },
  });
  if (!itemTemplate) {
    throw new Error("Item template not found");
  }

  const inventory = await lockInventory(db, userId);
  if (!inventory) {
    throw new Error("Inventory not found");
  }

  const maxSlots = inventory.maxSlots;
  const normalizedSlots = normalizeInventorySlots(inventory.slots, maxSlots);

  const affectedUserItemIds: number[] = [];
  const itemChanges: ItemQuantityChange[] = [];

  // If not stackable, we still support quantity by creating individual stacks of size 1
  const isStackable = itemTemplate.stackable;
  const maxStackSize = Math.max(1, itemTemplate.maxStackSize);
  const instanceModifiers = params.statModifiers ?? [];

  // Fetch all userItem ids present in inventory
  const userItemIdsInInventory = normalizedSlots
    .map((s) => s.item?.id)
    .filter((id): id is number => typeof id === "number");

  // Fetch only the relevant stacks
  const candidateStacks = isStackable
    ? await db.userItem.findMany({
        where: {
          id: { in: userItemIdsInInventory },
          userId,
          itemId,
          rarity,
          status: "IN_INVENTORY",
        },
        select: { id: true, quantity: true },
        orderBy: { id: "asc" },
      })
    : [];

  const capacity = getStackCapacity({
    stackable: isStackable,
    maxStackSize,
    stackQuantities: candidateStacks.map((stack) => stack.quantity),
    emptySlots: normalizedSlots.filter((slot) => slot.item === null).length,
  });
  const grantableQuantity = Math.min(
    requestedQuantity,
    Math.floor(capacity / unitSize) * unitSize,
  );
  let remainingQuantity = grantableQuantity;

  // Fill existing stacks first
  if (isStackable && remainingQuantity > 0) {
    for (const stack of candidateStacks) {
      if (remainingQuantity <= 0) break;
      if (stack.quantity >= maxStackSize) continue;

      const available = maxStackSize - stack.quantity;
      const toAdd = Math.min(available, remainingQuantity);

      // Only while the stack still holds what was read: a sale or hand-in
      // in between must not be undone by this write.
      const written = await db.userItem.updateMany({
        where: { id: stack.id, quantity: stack.quantity },
        data: { quantity: stack.quantity + toAdd },
      });
      if (written.count !== 1) {
        throw new Error("Your inventory changed. Please try again.");
      }

      affectedUserItemIds.push(stack.id);
      itemChanges.push({
        userItemId: stack.id,
        quantity: stack.quantity + toAdd,
      });
      remainingQuantity -= toAdd;
    }
  }

  // Create new stacks into empty slots
  let newStacks = false;
  while (remainingQuantity > 0) {
    const emptySlotIndex = normalizedSlots.findIndex((s) => s.item === null);
    if (emptySlotIndex === -1) break;

    const stackSize = isStackable
      ? Math.min(maxStackSize, remainingQuantity)
      : 1;

    const newUserItem = await db.userItem.create({
      data: {
        userId,
        itemId,
        rarity,
        quantity: stackSize,
        status: "IN_INVENTORY",
        isTradeable: true,
        statModifiers:
          instanceModifiers.length > 0
            ? {
                create: instanceModifiers.map((stat) => ({
                  statType: stat.statType,
                  value: stat.value,
                })),
              }
            : undefined,
      },
      select: { id: true },
    });

    normalizedSlots[emptySlotIndex] = {
      slotIndex: emptySlotIndex,
      item: { id: newUserItem.id },
    };

    affectedUserItemIds.push(newUserItem.id);
    itemChanges.push({ userItemId: newUserItem.id, quantity: stackSize });
    newStacks = true;
    remainingQuantity -= stackSize;
  }

  const addedQuantity = grantableQuantity - remainingQuantity;

  // Topping up existing stacks doesn't move anything between slots.
  if (newStacks) {
    await db.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(normalizedSlots) },
    });
  }

  return {
    addedQuantity,
    remainingQuantity: requestedQuantity - addedQuantity,
    affectedUserItemIds,
    updatedSlots: normalizedSlots,
    itemChanges,
    newStacks,
  };
}
