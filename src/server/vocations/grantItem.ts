import { ItemRarity } from "~/generated/prisma/enums";
import { Prisma, PrismaClient } from "~/generated/prisma/client";
import { normalizeInventorySlots, slotsToInputJson } from "~/utils/inventorySlots";

type DbClient = Pick<
  PrismaClient,
  "item" | "inventory" | "userItem"
>;

export type GrantResult = {
  addedQuantity: number;
  remainingQuantity: number;
  affectedUserItemIds: number[];
  updatedSlots: Array<{ slotIndex: number; item: { id: number } | null }>;
};

// Grants items into the JSON inventory slots with stacking.
// Optimized for bulk rewards (no per-slot DB calls).
export async function grantStackableItemToInventory(params: {
  db: DbClient;
  userId: string;
  itemId: number;
  rarity: ItemRarity;
  quantity: number;
}): Promise<GrantResult> {
  const { db, userId, itemId, rarity } = params;
  let remainingQuantity = Math.max(0, Math.floor(params.quantity));

  const itemTemplate = await db.item.findUnique({ where: { id: itemId } });
  if (!itemTemplate) {
    throw new Error("Item template not found");
  }

  const inventory = await db.inventory.findUnique({ where: { userId } });
  if (!inventory) {
    throw new Error("Inventory not found");
  }

  const maxSlots = inventory.maxSlots;
  const normalizedSlots = normalizeInventorySlots(inventory.slots as Prisma.JsonValue, maxSlots);

  const affectedUserItemIds: number[] = [];

  // If not stackable, we still support quantity by creating individual stacks of size 1
  const isStackable = itemTemplate.stackable;
  const maxStackSize = Math.max(1, itemTemplate.maxStackSize);

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

  // Fill existing stacks first
  if (isStackable && remainingQuantity > 0) {
    for (const stack of candidateStacks) {
      if (remainingQuantity <= 0) break;
      if (stack.quantity >= maxStackSize) continue;

      const available = maxStackSize - stack.quantity;
      const toAdd = Math.min(available, remainingQuantity);

      await db.userItem.update({
        where: { id: stack.id },
        data: { quantity: stack.quantity + toAdd },
      });

      affectedUserItemIds.push(stack.id);
      remainingQuantity -= toAdd;
    }
  }

  // Create new stacks into empty slots
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
      },
      select: { id: true },
    });

    normalizedSlots[emptySlotIndex] = {
      slotIndex: emptySlotIndex,
      item: { id: newUserItem.id },
    };

    affectedUserItemIds.push(newUserItem.id);
    remainingQuantity -= stackSize;
  }

  const addedQuantity = Math.max(0, Math.floor(params.quantity) - remainingQuantity);

  await db.inventory.update({
    where: { userId },
    data: { slots: slotsToInputJson(normalizedSlots) },
  });

  return {
    addedQuantity,
    remainingQuantity,
    affectedUserItemIds,
    updatedSlots: normalizedSlots,
  };
}
