import { ItemRarity } from "~/generated/prisma/enums";
import type { PrismaClient } from "~/generated/prisma/client";
import type { ItemQuantityChange } from "~/realtime/events";
import {
  normalizeInventorySlots,
  slotsToInputJson,
  type InventorySlot,
} from "~/utils/inventorySlots";
import { lockInventory } from "~/server/items/inventoryLock";

type DbClient = Pick<PrismaClient, "inventory" | "userItem" | "$queryRaw">;

const RARITY_RANK = new Map(
  Object.values(ItemRarity).map((rarity, index) => [rarity, index]),
);

/**
 * The stacks in a player's inventory slots, in slot order. Equipped and listed
 * items are not in slots, so they are never counted or consumed. Inside a
 * transaction the inventory stays locked until it ends (see lockInventory);
 * pages that only show the inventory pass `lock: false`.
 */
export async function loadInventoryStacks(
  db: DbClient,
  userId: string,
  options: { lock?: boolean } = {},
) {
  const inventory =
    options.lock === false
      ? await db.inventory.findUnique({
          where: { userId },
          select: { slots: true, maxSlots: true },
        })
      : await lockInventory(db, userId);
  if (!inventory) throw new Error("Inventory not found");

  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
  const ids = slots.flatMap((slot) => (slot.item ? [slot.item.id] : []));
  const rows = await db.userItem.findMany({
    where: { id: { in: ids }, userId, status: "IN_INVENTORY" },
    select: { id: true, itemId: true, rarity: true, quantity: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const stacks = ids.flatMap((id) => byId.get(id) ?? []);
  return { slots, stacks };
}

/** Total quantity held per item template, across every rarity. */
export function countItems(
  stacks: ReadonlyArray<{ itemId: number; quantity: number }>,
) {
  const totals = new Map<number, number>();
  for (const stack of stacks) {
    totals.set(stack.itemId, (totals.get(stack.itemId) ?? 0) + stack.quantity);
  }
  return totals;
}

export type InventoryStack = {
  id: number;
  itemId: number;
  rarity: ItemRarity;
  quantity: number;
};

/**
 * Takes `take` from a loaded stack, deleting it and emptying its slot in
 * `slots` when it runs out; the caller saves the slots. The write only applies
 * if the stack still holds what was read, so two requests can never spend the
 * same items twice. Throws when the stack holds fewer than `take`.
 */
export async function takeFromStack(
  db: DbClient,
  slots: InventorySlot[],
  stack: InventoryStack,
  take: number,
): Promise<ItemQuantityChange> {
  if (take > stack.quantity) throw new Error(`You only have ${stack.quantity}`);
  const where = { id: stack.id, quantity: stack.quantity };
  const quantity = stack.quantity - take;
  const written =
    quantity > 0
      ? await db.userItem.updateMany({ where, data: { quantity } })
      : await db.userItem.deleteMany({ where });
  if (written.count !== 1) {
    throw new Error("Your inventory changed. Please try again.");
  }
  if (quantity <= 0) {
    const slot = slots.find((entry) => entry.item?.id === stack.id);
    if (slot) slot.item = null;
  }
  stack.quantity = quantity;
  return { userItemId: stack.id, quantity };
}

/** Writes the slot layout back; only the positions change, not the stacks. */
export async function saveInventorySlots(
  db: DbClient,
  userId: string,
  slots: InventorySlot[],
) {
  await db.inventory.update({
    where: { userId },
    data: { slots: slotsToInputJson(slots) },
  });
}

/**
 * Takes items by template from stacks already loaded (in slot order), lowest
 * rarity first or simply in slot order. Emptied slots are cleared in `slots`;
 * the caller saves them. Throws when the stacks hold too few.
 */
export async function takeFromStacks(params: {
  db: DbClient;
  slots: InventorySlot[];
  stacks: InventoryStack[];
  items: ReadonlyArray<{ itemId: number; quantity: number }>;
  order: "rarity" | "slot";
}): Promise<ItemQuantityChange[]> {
  const { db, slots, stacks } = params;
  const changes: ItemQuantityChange[] = [];

  for (const request of params.items) {
    let remaining = Math.max(0, Math.floor(request.quantity));
    const candidates = stacks.filter(
      (stack) => stack.itemId === request.itemId && stack.quantity > 0,
    );
    if (params.order === "rarity") {
      candidates.sort(
        (a, b) =>
          (RARITY_RANK.get(a.rarity) ?? 0) - (RARITY_RANK.get(b.rarity) ?? 0),
      );
    }

    for (const stack of candidates) {
      if (remaining <= 0) break;
      const take = Math.min(stack.quantity, remaining);
      remaining -= take;
      changes.push(await takeFromStack(db, slots, stack, take));
    }

    if (remaining > 0) throw new Error("You don't have enough of that item");
  }
  return changes;
}

/**
 * Removes items by template from the inventory, lowest rarity first, so a
 * hand-in never takes an upgraded copy while a plainer one is available.
 * Throws when the player holds too few; run it inside the caller's
 * transaction so nothing is taken in that case.
 */
export async function consumeInventoryItems(params: {
  db: DbClient;
  userId: string;
  items: ReadonlyArray<{ itemId: number; quantity: number }>;
}): Promise<ItemQuantityChange[]> {
  const { db, userId } = params;
  const { slots, stacks } = await loadInventoryStacks(db, userId);
  const changes = await takeFromStacks({
    db,
    slots,
    stacks,
    items: params.items,
    order: "rarity",
  });

  if (changes.some((change) => change.quantity === 0)) {
    await saveInventorySlots(db, userId, slots);
  }
  return changes;
}

/**
 * Removes part or all of one specific inventory stack. Throws when the stack
 * is not in the inventory or holds fewer than `quantity`.
 */
export async function removeFromStack(params: {
  db: DbClient;
  userId: string;
  userItemId: number;
  quantity: number;
}): Promise<ItemQuantityChange> {
  const { db, userId } = params;
  const { slots, stacks } = await loadInventoryStacks(db, userId);
  const stack = stacks.find((entry) => entry.id === params.userItemId);
  if (!stack) throw new Error("That item is not in your inventory");
  const change = await takeFromStack(db, slots, stack, params.quantity);
  if (change.quantity === 0) await saveInventorySlots(db, userId, slots);
  return change;
}
