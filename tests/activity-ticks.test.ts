import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { ItemRarity } from "../src/generated/prisma/enums";
import {
  countFinishedHarvestTiles,
  hasDueHarvestTiles,
} from "../src/server/garden/harvestSchedule";
import {
  getStackCapacity,
  grantStackableItemToInventory,
} from "../src/server/items/grantItem";
import {
  takeFromStack,
  takeFromStacks,
} from "../src/server/items/consumeItems";
import { applyItemChanges } from "../src/lib/player-sync";
import { inventoryQueryKeys } from "../src/lib/query-keys";

function fakeGrantDb(options: {
  maxStackSize: number;
  maxSlots: number;
  slots: Array<{ slotIndex: number; item: { id: number } | null }>;
  stacks: Array<{ id: number; quantity: number }>;
}) {
  const writes = {
    stackUpdates: [] as number[][],
    created: [] as number[],
    slots: 0,
  };
  let nextId = 900;
  const db = {
    $queryRaw: async () => [
      { slots: options.slots, maxSlots: options.maxSlots, deleteSlotId: null },
    ],
    item: {
      findUnique: async () => ({
        stackable: true,
        maxStackSize: options.maxStackSize,
      }),
    },
    inventory: {
      findUnique: async () => ({
        maxSlots: options.maxSlots,
        slots: options.slots,
      }),
      update: async () => {
        writes.slots++;
        return {};
      },
    },
    userItem: {
      findMany: async () => options.stacks,
      updateMany: async (args: {
        where: { id: number; quantity: number };
        data: { quantity: number };
      }) => {
        const stack = options.stacks.find((entry) => entry.id === args.where.id);
        if (stack?.quantity !== args.where.quantity) return { count: 0 };
        writes.stackUpdates.push([args.where.id, args.data.quantity]);
        return { count: 1 };
      },
      create: async (args: { data: { quantity: number } }) => {
        writes.created.push(args.data.quantity);
        return { id: nextId++ };
      },
    },
  };
  return { db, writes };
}

// One stack of 8/10 and one empty slot: room for 12.
const twoSlotInventory = {
  maxStackSize: 10,
  maxSlots: 2,
  slots: [
    { slotIndex: 0, item: { id: 1 } },
    { slotIndex: 1, item: null },
  ],
  stacks: [{ id: 1, quantity: 8 }],
};

void test("stack capacity counts room in matching stacks plus empty slots", () => {
  assert.equal(
    getStackCapacity({
      stackable: true,
      maxStackSize: 10,
      stackQuantities: [8, 10, 3],
      emptySlots: 2,
    }),
    29,
  );
  assert.equal(
    getStackCapacity({
      stackable: false,
      maxStackSize: 1,
      stackQuantities: [],
      emptySlots: 3,
    }),
    3,
  );
});

void test("grants only whole units that fit and reports every changed stack", async () => {
  const { db, writes } = fakeGrantDb(twoSlotInventory);
  const result = await grantStackableItemToInventory({
    db: db as never,
    userId: "u1",
    itemId: 7,
    rarity: ItemRarity.COMMON,
    quantity: 15,
    unitSize: 5,
  });

  assert.equal(result.addedQuantity, 10);
  assert.equal(result.remainingQuantity, 5);
  assert.equal(result.newStacks, true);
  assert.deepEqual(result.itemChanges, [
    { userItemId: 1, quantity: 10 },
    { userItemId: 900, quantity: 8 },
  ]);
  assert.equal(writes.slots, 1);
});

void test("a unit that doesn't fit is not granted at all", async () => {
  const { db, writes } = fakeGrantDb(twoSlotInventory);
  const result = await grantStackableItemToInventory({
    db: db as never,
    userId: "u1",
    itemId: 7,
    rarity: ItemRarity.COMMON,
    quantity: 13,
    unitSize: 13,
  });

  assert.equal(result.addedQuantity, 0);
  assert.equal(result.remainingQuantity, 13);
  assert.deepEqual(result.itemChanges, []);
  assert.deepEqual(writes.stackUpdates, []);
  assert.equal(writes.slots, 0);
});

void test("topping up an existing stack doesn't rewrite the slots", async () => {
  const { db, writes } = fakeGrantDb(twoSlotInventory);
  const result = await grantStackableItemToInventory({
    db: db as never,
    userId: "u1",
    itemId: 7,
    rarity: ItemRarity.COMMON,
    quantity: 2,
  });

  assert.equal(result.addedQuantity, 2);
  assert.equal(result.newStacks, false);
  assert.deepEqual(result.itemChanges, [{ userItemId: 1, quantity: 10 }]);
  assert.equal(writes.slots, 0);
});

// Writes only apply while the stack still holds the quantity that was read.
function fakeTakeDb(stored: Map<number, number>) {
  const guarded =
    (write: (id: number, quantity?: number) => void) =>
    async (args: {
      where: { id: number; quantity: number };
      data?: { quantity: number };
    }) => {
      if (stored.get(args.where.id) !== args.where.quantity)
        return { count: 0 };
      write(args.where.id, args.data?.quantity);
      return { count: 1 };
    };
  return {
    userItem: {
      updateMany: guarded((id, quantity) => stored.set(id, quantity!)),
      deleteMany: guarded((id) => stored.delete(id)),
    },
  };
}

function oreStacks() {
  // Slot order: a RARE stack of 3, then a COMMON stack of 4.
  return {
    slots: [
      { slotIndex: 0, item: { id: 1 } },
      { slotIndex: 1, item: { id: 2 } },
    ],
    stacks: [
      { id: 1, itemId: 7, rarity: ItemRarity.RARE, quantity: 3 },
      { id: 2, itemId: 7, rarity: ItemRarity.COMMON, quantity: 4 },
    ],
  };
}

void test("taking by rarity spends the plainest copies first", async () => {
  const { slots, stacks } = oreStacks();
  const stored = new Map([
    [1, 3],
    [2, 4],
  ]);
  const changes = await takeFromStacks({
    db: fakeTakeDb(stored) as never,
    slots,
    stacks,
    items: [{ itemId: 7, quantity: 5 }],
    order: "rarity",
  });

  assert.deepEqual(changes, [
    { userItemId: 2, quantity: 0 },
    { userItemId: 1, quantity: 2 },
  ]);
  assert.equal(slots[1]?.item, null);
  assert.deepEqual([...stored], [[1, 2]]);
});

void test("taking in slot order spends the first stacks first", async () => {
  const { slots, stacks } = oreStacks();
  const changes = await takeFromStacks({
    db: fakeTakeDb(
      new Map([
        [1, 3],
        [2, 4],
      ]),
    ) as never,
    slots,
    stacks,
    items: [{ itemId: 7, quantity: 5 }],
    order: "slot",
  });

  assert.deepEqual(changes, [
    { userItemId: 1, quantity: 0 },
    { userItemId: 2, quantity: 2 },
  ]);
  assert.equal(slots[0]?.item, null);
});

void test("taking more than is held, or from a stack that changed, throws", async () => {
  const held = oreStacks();
  await assert.rejects(
    takeFromStacks({
      db: fakeTakeDb(
        new Map([
          [1, 3],
          [2, 4],
        ]),
      ) as never,
      slots: held.slots,
      stacks: held.stacks,
      items: [{ itemId: 7, quantity: 8 }],
      order: "slot",
    }),
    /don't have enough/,
  );

  const { slots, stacks } = oreStacks();
  // The stored stack no longer holds the 3 that was read.
  const db = fakeTakeDb(
    new Map([
      [1, 1],
      [2, 4],
    ]),
  );
  await assert.rejects(
    takeFromStack(db as never, slots, stacks[0]!, 1),
    /inventory changed/,
  );
  await assert.rejects(
    takeFromStack(db as never, slots, stacks[1]!, 5),
    /only have 4/,
  );
});

void test("harvest tiles finish one after another on whole seconds", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const at = (seconds: number) =>
    new Date(startedAt.getTime() + seconds * 1000);
  const schedule = [
    { harvestSeconds: 5 },
    { harvestSeconds: 10 },
    { harvestSeconds: 3 },
  ];

  assert.equal(countFinishedHarvestTiles(schedule, startedAt, at(4.999)), 0);
  assert.equal(countFinishedHarvestTiles(schedule, startedAt, at(5)), 1);
  assert.equal(countFinishedHarvestTiles(schedule, startedAt, at(14.9)), 1);
  assert.equal(countFinishedHarvestTiles(schedule, startedAt, at(15)), 2);
  assert.equal(countFinishedHarvestTiles(schedule, startedAt, at(100)), 3);
});

void test("a harvest is due only for finished tiles that haven't paid out", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const at = (seconds: number) =>
    new Date(startedAt.getTime() + seconds * 1000);
  const tiles = [
    { tileIndex: 0, harvestSeconds: 5, yieldItemId: 1, harvested: true },
    { tileIndex: 1, harvestSeconds: 10, yieldItemId: 1, harvested: false },
  ];

  assert.equal(hasDueHarvestTiles({ startedAt, tiles }, at(6)), false);
  assert.equal(hasDueHarvestTiles({ startedAt, tiles }, at(15)), true);
  // Harvests started before per-tile payout need their timings backfilled.
  assert.equal(
    hasDueHarvestTiles({ startedAt, tiles: [{ tileIndex: 3 }] }, at(0)),
    true,
  );
});

void test("item changes patch the cached inventory and sell list in place", () => {
  const queryClient = new QueryClient();
  const userId = "u1";
  const inventoryKey = inventoryQueryKeys.byUser(userId);
  const sellableKey = inventoryQueryKeys.sellable(userId);
  const deleteSlot = { slotIndex: 999, item: null };

  queryClient.setQueryData(inventoryKey, {
    slots: [
      { slotIndex: 0, item: { id: 1, quantity: 5 } },
      { slotIndex: 1, item: { id: 2, quantity: 3 } },
      { slotIndex: 2, item: null },
    ],
    deleteSlot,
  });
  queryClient.setQueryData(sellableKey, {
    items: [
      { id: 1, quantity: 5 },
      { id: 2, quantity: 3 },
    ],
  });

  applyItemChanges(
    queryClient,
    userId,
    [
      { userItemId: 1, quantity: 6 },
      { userItemId: 2, quantity: 0 },
    ],
    false,
  );

  assert.deepEqual(queryClient.getQueryData(inventoryKey), {
    slots: [
      { slotIndex: 0, item: { id: 1, quantity: 6 } },
      { slotIndex: 1, item: null },
      { slotIndex: 2, item: null },
    ],
    deleteSlot,
  });
  assert.deepEqual(queryClient.getQueryData(sellableKey), {
    items: [{ id: 1, quantity: 6 }],
  });
  assert.equal(queryClient.getQueryState(inventoryKey)?.isInvalidated, false);
});

void test("changes the cache can't apply fall back to a refetch", () => {
  const queryClient = new QueryClient();
  const userId = "u1";
  const inventoryKey = inventoryQueryKeys.byUser(userId);
  const seed = () =>
    queryClient.setQueryData(inventoryKey, {
      slots: [{ slotIndex: 0, item: { id: 1, quantity: 5 } }],
    });

  seed();
  applyItemChanges(
    queryClient,
    userId,
    [{ userItemId: 99, quantity: 4 }],
    false,
  );
  assert.equal(queryClient.getQueryState(inventoryKey)?.isInvalidated, true);

  seed();
  applyItemChanges(queryClient, userId, [], true);
  assert.equal(queryClient.getQueryState(inventoryKey)?.isInvalidated, true);
});
