import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completedWindow,
  itemPlacement,
  maxCurveLevel,
  resolveLevelEdit,
  withoutItem,
  type CarriedLayout,
} from "../src/server/admin/playerRules";
import { toXpCurve } from "../src/utils/xpCurve";

const curve = toXpCurve([
  { level: 2, xpTotal: 100n },
  { level: 3, xpTotal: 250n },
  { level: 4, xpTotal: 500n },
]);

function layout(overrides: Partial<CarriedLayout> = {}): CarriedLayout {
  return {
    slots: [
      { slotIndex: 0, item: { id: 10 } },
      { slotIndex: 1, item: null },
      { slotIndex: 2, item: { id: 11 } },
    ],
    equipment: { weaponItemId: 20, ring2ItemId: 21 },
    deleteSlotId: 30,
    ...overrides,
  };
}

void test("items are found where the game keeps them", () => {
  const carried = layout();
  assert.deepEqual(itemPlacement({ id: 11, status: "IN_INVENTORY" }, carried), {
    kind: "BAG",
    slotIndex: 2,
  });
  assert.deepEqual(itemPlacement({ id: 21, status: "IN_INVENTORY" }, carried), {
    kind: "EQUIPPED",
    slot: "ring2",
  });
  assert.deepEqual(itemPlacement({ id: 30, status: "IN_INVENTORY" }, carried), {
    kind: "DELETE_SLOT",
  });
  assert.deepEqual(itemPlacement({ id: 99, status: "IN_INVENTORY" }, carried), {
    kind: "UNPLACED",
  });
  // Status decides first for items that live outside the carried layout.
  assert.deepEqual(itemPlacement({ id: 10, status: "LISTED" }, carried), {
    kind: "LISTED",
  });
  assert.deepEqual(itemPlacement({ id: 10, status: "IN_STORAGE" }, carried), {
    kind: "STORAGE",
  });
});

void test("equipment wins when a layout lists an item twice", () => {
  const carried = layout({
    slots: [{ slotIndex: 0, item: { id: 20 } }],
  });
  assert.equal(itemPlacement({ id: 20, status: "EQUIPPED" }, carried).kind, "EQUIPPED");
});

void test("removing an item clears every reference to it and nothing else", () => {
  const bag = withoutItem(layout(), 10);
  assert.equal(bag.slotsChanged, true);
  assert.deepEqual(
    bag.slots.map((slot) => slot.item?.id ?? null),
    [null, null, 11],
  );
  assert.deepEqual(bag.equipment, {});
  assert.equal(bag.deleteSlotId, 30);

  const equipped = withoutItem(layout(), 20);
  assert.equal(equipped.slotsChanged, false);
  assert.deepEqual(equipped.equipment, { weaponItemId: null });

  const pending = withoutItem(layout(), 30);
  assert.equal(pending.deleteSlotId, null);
  assert.deepEqual(pending.equipment, {});
});

void test("a level edit starts the player at the beginning of that level", () => {
  assert.deepEqual(resolveLevelEdit(curve, { level: 3 }), {
    level: 3,
    experience: 250n,
  });
  assert.deepEqual(resolveLevelEdit(curve, { level: 1 }), {
    level: 1,
    experience: 0n,
  });
  assert.throws(() => resolveLevelEdit(curve, { level: 5 }), /1 to 4/);
  assert.throws(() => resolveLevelEdit(curve, { level: 0 }), /1 to 4/);
});

void test("an XP edit moves the level to match", () => {
  assert.deepEqual(resolveLevelEdit(curve, { experience: 249n }), {
    level: 2,
    experience: 249n,
  });
  assert.deepEqual(resolveLevelEdit(curve, { experience: 10_000n }), {
    level: 4,
    experience: 10_000n,
  });
  assert.equal(maxCurveLevel(curve), 4);
});

void test("completing an activity keeps its length and ends it now", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  const running = completedWindow(
    {
      startedAt: new Date("2026-09-24T11:30:00Z"),
      endsAt: new Date("2026-09-24T13:00:00Z"),
    },
    now,
  );
  assert.equal(running.endsAt.toISOString(), now.toISOString());
  assert.equal(running.startedAt.toISOString(), "2026-09-24T10:30:00.000Z");

  // Already over: left as it was.
  const done = completedWindow(
    {
      startedAt: new Date("2026-09-24T10:00:00Z"),
      endsAt: new Date("2026-09-24T11:00:00Z"),
    },
    now,
  );
  assert.equal(done.endsAt.toISOString(), "2026-09-24T11:00:00.000Z");
});
