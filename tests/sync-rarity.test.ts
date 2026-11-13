import assert from "node:assert/strict";
import { test } from "node:test";
import { syncItemRarity } from "../src/server/items/syncRarity";

void test("a rarity change rewrites only that item's copies, orders and history", async () => {
  const calls: Array<{ table: string; args: unknown }> = [];
  const table = (name: string) => ({
    updateMany: async (args: unknown) => {
      calls.push({ table: name, args });
      return { count: 0 };
    },
  });
  const db = {
    userItem: table("userItem"),
    marketBuyOrder: table("marketBuyOrder"),
    marketTransaction: table("marketTransaction"),
  } as unknown as Parameters<typeof syncItemRarity>[0];

  await syncItemRarity(db, 42, "UNIQUE");

  assert.deepEqual(
    calls.map((call) => call.table),
    ["userItem", "marketBuyOrder", "marketTransaction"],
  );
  for (const call of calls) {
    assert.deepEqual(call.args, {
      where: { itemId: 42, rarity: { not: "UNIQUE" } },
      data: { rarity: "UNIQUE" },
    });
  }
});
