import assert from "node:assert/strict";
import { test } from "node:test";
import { StatType } from "../src/generated/prisma/enums";
import { getQuickEquipSlot } from "../src/utils/inventoryClient";
import {
  compareItemStats,
  countChanges,
  getCompareSlots,
  getReplacedItems,
} from "../src/utils/itemCompare";

const stat = (statType: StatType, value: number) => ({ statType, value });
const worn = (
  stats: Array<{ statType: StatType; value: number }>,
  twoHanded = false,
) => ({ stats, twoHanded });

void test("rows cover both sides, in card order, with signed changes", () => {
  const rows = compareItemStats(
    [stat(StatType.ARMOR, 50), stat(StatType.CRITICAL_CHANCE, 2.5)],
    [stat(StatType.ARMOR, 38), stat(StatType.HEALTH, 40)],
  );
  assert.deepEqual(
    rows.map((row) => [row.key, row.item, row.equipped, row.change, row.direction]),
    [
      [StatType.CRITICAL_CHANCE, "+2.5%", null, "+2.5%", "up"],
      [StatType.ARMOR, "+50", "+38", "+12", "up"],
      [StatType.HEALTH, null, "+40", "−40", "down"],
    ],
  );
  assert.deepEqual(countChanges(rows), { better: 2, worse: 1 });
});

void test("a change only shows when the printed value changes", () => {
  const [armor, speed] = compareItemStats(
    [stat(StatType.ARMOR, 12.9), stat(StatType.ATTACK_SPEED, 1.204)],
    [stat(StatType.ARMOR, 12.1), stat(StatType.ATTACK_SPEED, 1.2)],
  );
  assert.equal(armor?.direction, "same");
  assert.equal(armor?.change, null);
  assert.equal(speed?.direction, "same");
});

void test("damage ranges merge into one row compared by average hit", () => {
  const [damage] = compareItemStats(
    [
      stat(StatType.PHYSICAL_DAMAGE_MIN, 10),
      stat(StatType.PHYSICAL_DAMAGE_MAX, 20),
    ],
    [
      stat(StatType.PHYSICAL_DAMAGE_MIN, 8),
      stat(StatType.PHYSICAL_DAMAGE_MAX, 14),
    ],
  );
  assert.equal(damage?.label, "Physical Damage");
  assert.equal(damage?.item, "10.00-20.00");
  assert.equal(damage?.equipped, "8.00-14.00");
  assert.equal(damage?.change, "+4.00");
});

void test("an empty slot makes every stat a gain; nothing on either side has no rows", () => {
  const rows = compareItemStats([stat(StatType.LUCK, 3)], []);
  assert.deepEqual(countChanges(rows), { better: 1, worse: 0 });
  assert.deepEqual(compareItemStats([stat(StatType.LUCK, 0)], []), []);
});

void test("a less negative stat counts as better", () => {
  const [speed] = compareItemStats(
    [stat(StatType.MOVEMENT_SPEED, -2)],
    [stat(StatType.MOVEMENT_SPEED, -5)],
  );
  assert.equal(speed?.direction, "up");
  assert.equal(speed?.change, "+3.0%");
});

void test("rings compare against both slots, opening on the free one", () => {
  const ring = { equipTo: "ring", twoHanded: false, stats: [stat(StatType.LUCK, 5)] };
  assert.deepEqual(getCompareSlots(ring, { ring1: worn([]) }), {
    slots: ["ring1", "ring2"],
    initial: "ring2",
  });
  // Both taken: open on the ring this one improves most.
  assert.deepEqual(
    getCompareSlots(ring, {
      ring1: worn([stat(StatType.LUCK, 9)]),
      ring2: worn([stat(StatType.LUCK, 1)]),
    })?.initial,
    "ring2",
  );
});

void test("one-handed weapons offer both hands; Equip's choice opens first", () => {
  const dagger = { equipTo: "weapon", twoHanded: false, stats: [] };
  assert.deepEqual(getCompareSlots(dagger, {})?.slots, ["weapon", "offhand"]);
  assert.equal(getCompareSlots(dagger, {})?.initial, "weapon");
  assert.equal(
    getCompareSlots(dagger, { weapon: worn([]) })?.initial,
    "offhand",
  );
  const greatsword = { equipTo: "weapon", twoHanded: true, stats: [] };
  assert.deepEqual(getCompareSlots(greatsword, {})?.slots, ["weapon"]);
  assert.equal(getCompareSlots({ equipTo: null, stats: [] }, {}), null);
});

void test("two-handed swaps also take the other hand off", () => {
  const shield = worn([stat(StatType.ARMOR, 30)]);
  const sword = worn([stat(StatType.ARMOR, 1)]);
  const greatsword = { equipTo: "weapon", twoHanded: true };

  const both = getReplacedItems(greatsword, "weapon", {
    weapon: sword,
    offhand: shield,
  });
  assert.equal(both.current, sword);
  assert.deepEqual(both.displaced, { slot: "offhand", item: shield });

  // A shield in the off hand pushes out a two-handed weapon.
  const wornGreatsword = worn([], true);
  const blocked = getReplacedItems(
    { equipTo: "offhand", twoHanded: false },
    "offhand",
    { weapon: wornGreatsword },
  );
  assert.equal(blocked.current, null);
  assert.deepEqual(blocked.displaced, { slot: "weapon", item: wornGreatsword });

  assert.equal(
    getReplacedItems(greatsword, "weapon", { weapon: sword }).displaced,
    null,
  );
});

void test("quick equip keeps its old slot choices", () => {
  const ring = { equipTo: "ring", twoHanded: false };
  assert.equal(getQuickEquipSlot(ring, {}), "ring1");
  assert.equal(getQuickEquipSlot(ring, { ring1: {} }), "ring2");
  assert.equal(getQuickEquipSlot(ring, { ring1: {}, ring2: {} }), null);
  assert.equal(
    getQuickEquipSlot(
      { equipTo: "weapon", twoHanded: false },
      { weapon: { twoHanded: true } },
    ),
    "weapon",
  );
  assert.equal(getQuickEquipSlot({ equipTo: "head" }, {}), "head");
  assert.equal(getQuickEquipSlot({ equipTo: null }, {}), null);
});
