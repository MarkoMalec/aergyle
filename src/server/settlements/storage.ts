import "server-only";

import type { ItemRarity } from "~/generated/prisma/enums";
import type { PrismaClient } from "~/generated/prisma/client";
import { formatGold, roundGold } from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";
import {
  loadInventoryStacks,
  removeFromStack,
  saveInventorySlots,
} from "~/server/items/consumeItems";
import { assertPresentAt, getPresence } from "./access";
import { planStackFill } from "./rules";

/** One stack on either side of the storage window. */
export type StorageStack = {
  userItemId: number;
  quantity: number;
  rarity: ItemRarity;
  item: { id: number; name: string; sprite: string };
};

export type StorageDirection = "DEPOSIT" | "WITHDRAW";

/** An inventory slot as the player sees it, empty or holding a stack. */
export type StorageSlot = { slotIndex: number; stack: StorageStack | null };

/** Everything the storage window shows, on the page and in the modal. */
export type StorageView = {
  storage: {
    id: number;
    name: string;
    description: string | null;
    slots: number;
    unlockCost: number;
    settlement: {
      id: number;
      name: string;
      location: { id: number; name: string };
    };
  };
  /** The chest artwork every storage shares. */
  icon: string | null;
  present: boolean;
  traveling: boolean;
  unlocked: boolean;
  gold: number;
  stored: StorageStack[];
  /** Every inventory slot, in its own position, exactly as the character page shows it. */
  inventory: StorageSlot[];
};

/** Storages players can see: enabled, in an enabled settlement. */
function visibleStorageWhere() {
  return { enabled: true, settlement: { is: { enabled: true } } };
}

const STORAGE_SELECT = {
  id: true,
  name: true,
  description: true,
  slots: true,
  unlockCost: true,
  mapX: true,
  mapY: true,
  settlement: {
    select: {
      id: true,
      name: true,
      location: { select: { id: true, name: true } },
    },
  },
} as const;

/** The shared chest artwork, or null while none is configured. */
export async function getStorageIcon() {
  const config = await prisma.storageConfig.findUnique({
    where: { id: 1 },
    select: { icon: true },
  });
  return config?.icon ?? null;
}

/**
 * A settlement's storage, the player's stacks in it and their inventory;
 * both sides are empty unless the player is at the settlement's location.
 */
export async function getStoragePage(
  userId: string,
  settlementId: number,
): Promise<StorageView | null> {
  const storage = await prisma.settlementStorage.findFirst({
    where: { settlementId, ...visibleStorageWhere() },
    select: STORAGE_SELECT,
  });
  if (!storage) return null;

  const [presence, icon, userStorage] = await Promise.all([
    getPresence(userId),
    getStorageIcon(),
    prisma.userStorage.findUnique({
      where: { userId_storageId: { userId, storageId: storage.id } },
      select: { id: true },
    }),
  ]);
  const present = presence.locationId === storage.settlement.location.id;
  const view = {
    storage: {
      id: storage.id,
      name: storage.name,
      description: storage.description,
      slots: storage.slots,
      unlockCost: Number(storage.unlockCost),
      settlement: storage.settlement,
    },
    icon,
    present,
    traveling: presence.traveling,
    unlocked: Boolean(userStorage),
  };
  if (!present) {
    return { ...view, gold: 0, stored: [], inventory: [] };
  }

  // The rent panel needs the gold too, so it is read before the contents.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gold: true },
  });
  const gold = Number(user?.gold ?? 0);
  if (!userStorage) {
    return { ...view, gold, stored: [], inventory: [] };
  }

  const [stored, inventory] = await Promise.all([
    loadStoredStacks(prisma, userStorage.id),
    loadInventoryStacks(prisma, userId, { lock: false }),
  ]);
  const templates = await loadItemTemplates(
    inventory.stacks.map((stack) => stack.itemId),
  );

  const byId = new Map(inventory.stacks.map((stack) => [stack.id, stack]));
  return {
    ...view,
    gold,
    stored,
    // Every slot, empty ones included, so the window shows the inventory as it is.
    inventory: inventory.slots.map((slot) => {
      const stack = slot.item ? byId.get(slot.item.id) : undefined;
      const item = stack ? templates.get(stack.itemId) : undefined;
      return {
        slotIndex: slot.slotIndex,
        stack:
          stack && item
            ? {
                userItemId: stack.id,
                quantity: stack.quantity,
                rarity: stack.rarity,
                item,
              }
            : null,
      };
    }),
  };
}

type DbClient = Pick<
  PrismaClient,
  "item" | "inventory" | "userItem" | "$queryRaw"
>;

async function loadItemTemplates(itemIds: number[]) {
  const items = await prisma.item.findMany({
    where: { id: { in: [...new Set(itemIds)] } },
    select: { id: true, name: true, sprite: true },
  });
  return new Map(items.map((item) => [item.id, item]));
}

/** Everything in one player's storage, oldest stack first. */
async function loadStoredStacks(
  db: Pick<PrismaClient, "userItem">,
  userStorageId: number,
): Promise<StorageStack[]> {
  const rows = await db.userItem.findMany({
    where: { userStorageId, status: "IN_STORAGE" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      quantity: true,
      rarity: true,
      itemTemplate: { select: { id: true, name: true, sprite: true } },
    },
  });
  return rows.map((row) => ({
    userItemId: row.id,
    quantity: row.quantity,
    rarity: row.rarity,
    item: row.itemTemplate,
  }));
}

/** The storage the player may use right now, or the reason they may not. */
async function requireStorage(userId: string, settlementId: number) {
  const storage = await prisma.settlementStorage.findFirst({
    where: { settlementId, ...visibleStorageWhere() },
    select: STORAGE_SELECT,
  });
  if (!storage) throw new Error("There is no storage here");
  await assertPresentAt(userId, storage.settlement.location);
  return storage;
}

/** Rents the settlement's storage for this player, once, for its gold cost. */
export async function unlockStorage(params: {
  userId: string;
  settlementId: number;
}) {
  const { userId } = params;
  const storage = await requireStorage(userId, params.settlementId);
  const cost = roundGold(Number(storage.unlockCost));

  await prisma.$transaction(async (tx) => {
    if (cost > 0) {
      const debit = await tx.user.updateMany({
        where: { id: userId, gold: { gte: cost } },
        data: { gold: { decrement: cost } },
      });
      if (debit.count !== 1) {
        throw new Error(`You need ${formatGold(cost)} gold to rent this`);
      }
    }
    const rented = await tx.userStorage.createMany({
      data: { userId, storageId: storage.id },
      skipDuplicates: true,
    });
    if (rented.count !== 1) throw new Error("You already rent this storage");
  });

  return { storageName: storage.name, cost };
}

/** The player's storage row here; they must have rented it first. */
async function requireUserStorage(userId: string, storageId: number) {
  const userStorage = await prisma.userStorage.findUnique({
    where: { userId_storageId: { userId, storageId } },
    select: { id: true },
  });
  if (!userStorage) throw new Error("Rent this storage first");
  return userStorage;
}

/**
 * Moves part or all of a stack between the inventory and a settlement's
 * storage. A whole stack that nothing can merge with moves as it is, so a
 * unique item keeps its instance; anything else tops up the stacks on the
 * other side and opens new ones for the rest.
 */
export async function moveStorageItem(params: {
  userId: string;
  settlementId: number;
  userItemId: number;
  direction: StorageDirection;
  quantity: number;
  /** The inventory slot a withdrawal was dropped on; the first free one otherwise. */
  toSlot?: number | null;
}) {
  const { userId, userItemId, direction } = params;
  const quantity = Math.floor(params.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose a valid quantity");
  }
  const storage = await requireStorage(userId, params.settlementId);
  const userStorage = await requireUserStorage(userId, storage.id);

  return prisma.$transaction(async (tx) =>
    direction === "DEPOSIT"
      ? deposit({ tx, userId, userStorage, storage, userItemId, quantity })
      : withdraw({
          tx,
          userId,
          userStorage,
          userItemId,
          quantity,
          toSlot: params.toSlot ?? null,
        }),
  );
}

type MoveContext = {
  tx: DbClient;
  userId: string;
  userStorage: { id: number };
  userItemId: number;
  quantity: number;
};

/** The template facts that decide how a stack splits and merges. */
async function stackRules(db: DbClient, itemId: number) {
  const item = await db.item.findUnique({
    where: { id: itemId },
    select: { name: true, stackable: true, maxStackSize: true },
  });
  if (!item) throw new Error("Item template not found");
  return item;
}

/**
 * True when the move is simply the stack changing sides: all of it, into one
 * new stack. The row itself moves then, so a unique item keeps its instance.
 */
function isRowMove(
  plan: { topUps: unknown[]; newStacks: unknown[] },
  quantity: number,
  stackQuantity: number,
) {
  return (
    plan.topUps.length === 0 &&
    plan.newStacks.length === 1 &&
    quantity === stackQuantity
  );
}

async function topUp(
  db: DbClient,
  stack: { id: number; quantity: number },
  added: number,
) {
  // Only applies while the stack still holds what was read, so two requests
  // can never fill the same room twice.
  const written = await db.userItem.updateMany({
    where: { id: stack.id, quantity: stack.quantity },
    data: { quantity: stack.quantity + added },
  });
  if (written.count !== 1) {
    throw new Error("Your items changed. Please try again.");
  }
}

/** Inventory → storage. */
async function deposit(
  context: MoveContext & { storage: { slots: number; name: string } },
) {
  const { tx, userId, userStorage, userItemId, quantity } = context;
  const { slots, stacks } = await loadInventoryStacks(tx, userId);
  const source = stacks.find((stack) => stack.id === userItemId);
  if (!source) throw new Error("That item is not in your inventory");
  if (quantity > source.quantity) {
    throw new Error(`You only have ${source.quantity}`);
  }

  const item = await stackRules(tx, source.itemId);
  const stored = await loadStoredStacks(tx, userStorage.id);
  const plan = planStackFill({
    quantity,
    stackable: item.stackable,
    maxStackSize: item.maxStackSize,
    targets: stored
      .filter(
        (stack) =>
          stack.item.id === source.itemId && stack.rarity === source.rarity,
      )
      .map((stack) => ({ id: stack.userItemId, quantity: stack.quantity })),
    freeSlots: context.storage.slots - stored.length,
  });
  if (!plan) throw new Error(`${context.storage.name} is full`);

  // The whole stack, with nothing to merge into: move the row itself.
  if (isRowMove(plan, quantity, source.quantity)) {
    const moved = await tx.userItem.updateMany({
      where: {
        id: source.id,
        userId,
        status: "IN_INVENTORY",
        quantity: source.quantity,
      },
      data: { status: "IN_STORAGE", userStorageId: userStorage.id },
    });
    if (moved.count !== 1) {
      throw new Error("Your inventory changed. Please try again.");
    }
    const slot = slots.find((entry) => entry.item?.id === source.id);
    if (slot) slot.item = null;
    await saveInventorySlots(tx, userId, slots);
    return { itemName: item.name, quantity, direction: "DEPOSIT" as const };
  }

  for (const target of plan.topUps) {
    const stack = stored.find((entry) => entry.userItemId === target.id)!;
    await topUp(
      tx,
      { id: stack.userItemId, quantity: stack.quantity },
      target.quantity,
    );
  }
  for (const size of plan.newStacks) {
    await tx.userItem.create({
      data: {
        userId,
        itemId: source.itemId,
        rarity: source.rarity,
        quantity: size,
        status: "IN_STORAGE",
        userStorageId: userStorage.id,
      },
      select: { id: true },
    });
  }
  await removeFromStack({ db: tx, userId, userItemId, quantity });
  return { itemName: item.name, quantity, direction: "DEPOSIT" as const };
}

/** Storage → inventory. */
async function withdraw(context: MoveContext & { toSlot: number | null }) {
  const { tx, userId, userStorage, userItemId, quantity } = context;
  const source = await tx.userItem.findFirst({
    where: {
      id: userItemId,
      userId,
      status: "IN_STORAGE",
      userStorageId: userStorage.id,
    },
    select: { id: true, itemId: true, rarity: true, quantity: true },
  });
  if (!source) throw new Error("That item is not in this storage");
  if (quantity > source.quantity) {
    throw new Error(`The storage only holds ${source.quantity}`);
  }

  const item = await stackRules(tx, source.itemId);
  const { slots, stacks } = await loadInventoryStacks(tx, userId);
  const plan = planStackFill({
    quantity,
    stackable: item.stackable,
    maxStackSize: item.maxStackSize,
    targets: stacks.filter(
      (stack) =>
        stack.itemId === source.itemId && stack.rarity === source.rarity,
    ),
    freeSlots: slots.filter((slot) => slot.item === null).length,
  });
  if (!plan) throw new Error("Make room in your inventory first");

  // The slot the stack was dropped on comes first, then the rest, so a drop
  // lands where the player aimed and a full stack still finds a home.
  const empty = slots
    .filter((slot) => slot.item === null)
    .sort(
      (a, b) =>
        Number(b.slotIndex === context.toSlot) -
        Number(a.slotIndex === context.toSlot),
    );

  // The whole stack, with nothing to merge into: move the row itself.
  if (isRowMove(plan, quantity, source.quantity)) {
    const moved = await tx.userItem.updateMany({
      where: {
        id: source.id,
        userId,
        status: "IN_STORAGE",
        quantity: source.quantity,
      },
      data: { status: "IN_INVENTORY", userStorageId: null },
    });
    if (moved.count !== 1) {
      throw new Error("Your storage changed. Please try again.");
    }
    empty[0]!.item = { id: source.id };
    await saveInventorySlots(tx, userId, slots);
    return { itemName: item.name, quantity, direction: "WITHDRAW" as const };
  }

  for (const target of plan.topUps) {
    const stack = stacks.find((entry) => entry.id === target.id)!;
    await topUp(tx, stack, target.quantity);
  }
  for (const [index, size] of plan.newStacks.entries()) {
    const created = await tx.userItem.create({
      data: {
        userId,
        itemId: source.itemId,
        rarity: source.rarity,
        quantity: size,
        status: "IN_INVENTORY",
      },
      select: { id: true },
    });
    empty[index]!.item = { id: created.id };
  }
  if (plan.newStacks.length > 0) await saveInventorySlots(tx, userId, slots);

  // Take what moved out of the stored stack, only while it still holds it.
  const left = source.quantity - quantity;
  const where = { id: source.id, quantity: source.quantity };
  const written =
    left > 0
      ? await tx.userItem.updateMany({ where, data: { quantity: left } })
      : await tx.userItem.deleteMany({ where });
  if (written.count !== 1) {
    throw new Error("Your storage changed. Please try again.");
  }
  return { itemName: item.name, quantity, direction: "WITHDRAW" as const };
}
