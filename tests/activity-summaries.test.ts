import assert from "node:assert/strict";
import { test } from "node:test";
import { toXpCurve } from "../src/utils/xpCurve";

// Pure helpers only: this suite never connects to a game database.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:1/summary_tests";
const { addToTotals, levelChange, readTotals } = await import(
  "../src/server/activitySummaries"
);

void test("session totals add up payouts per item and rarity", () => {
  let totals = addToTotals(null, {
    items: [{ itemId: 7, rarity: "COMMON", quantity: 2 }],
    xp: 10,
    skillXp: 8,
  });
  totals = addToTotals(totals, {
    items: [
      { itemId: 7, rarity: "COMMON", quantity: 3 },
      { itemId: 7, rarity: "RARE", quantity: 1 },
      { itemId: 9, rarity: "COMMON", quantity: 0 },
    ],
    xp: 20,
    skillXp: 16,
  });

  assert.deepEqual(totals, {
    items: [
      { itemId: 7, rarity: "COMMON", quantity: 5 },
      { itemId: 7, rarity: "RARE", quantity: 1 },
    ],
    xp: 30,
    skillXp: 24,
  });
});

void test("adding a payout leaves the stored totals untouched", () => {
  const stored = {
    items: [{ itemId: 1, rarity: "COMMON", quantity: 1 }],
    xp: 1,
    skillXp: 1,
  };
  addToTotals(stored, {
    items: [{ itemId: 1, rarity: "COMMON", quantity: 4 }],
    xp: 5,
  });
  assert.equal(stored.items[0]?.quantity, 1);
  assert.equal(stored.xp, 1);
});

void test("missing or malformed totals read as empty", () => {
  for (const value of [null, undefined, "totals", 3, [], { items: "none" }]) {
    assert.deepEqual(readTotals(value), { items: [], xp: 0, skillXp: 0 });
  }
  assert.deepEqual(
    readTotals({
      items: [
        { itemId: 2, rarity: "COMMON", quantity: -3 },
        { itemId: "2", rarity: "COMMON", quantity: 3 },
      ],
      xp: Number.NaN,
      skillXp: 4,
    }),
    {
      items: [{ itemId: 2, rarity: "COMMON", quantity: 0 }],
      xp: 0,
      skillXp: 4,
    },
  );
});

void test("a level change spans the levels the session's XP passed", () => {
  const curve = toXpCurve([
    { level: 2, xpTotal: 100n },
    { level: 3, xpTotal: 250n },
    { level: 4, xpTotal: 500n },
  ]);

  assert.deepEqual(levelChange(curve, 260n, 200), { from: 1, to: 3 });
  assert.deepEqual(levelChange(curve, 260n, 10), { from: 3, to: 3 });
  assert.deepEqual(levelChange(curve, 500n, 250), { from: 3, to: 4 });
  // XP from other sources can't make the start of the session negative.
  assert.deepEqual(levelChange(curve, 50n, 500), { from: 1, to: 1 });
});
