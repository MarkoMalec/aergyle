import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addQuestProgress,
  contributionShare,
  isOfferAvailable,
  objectiveProgress,
  parseQuestProgress,
  questPeriod,
  questResetsAt,
} from "../src/server/settlements/rules";
import {
  clampHeadCrop,
  DEFAULT_HEAD_CROP,
  headCrop,
  mapPoint,
} from "../src/game/world/maps";

// Wednesday 17 September 2026, late evening UTC.
const WEDNESDAY = new Date("2026-09-17T23:30:00Z");

void test("daily quests reset at midnight UTC", () => {
  assert.equal(questPeriod("DAILY", WEDNESDAY), "2026-09-17");
  assert.equal(
    questPeriod("DAILY", new Date("2026-09-18T00:00:00Z")),
    "2026-09-18",
  );
  assert.equal(
    questResetsAt("DAILY", WEDNESDAY)?.toISOString(),
    "2026-09-18T00:00:00.000Z",
  );
});

void test("weekly quests reset on Monday at midnight UTC", () => {
  assert.equal(questPeriod("WEEKLY", WEDNESDAY), "W2026-09-14");
  // Sunday still belongs to the week that began on Monday the 14th.
  assert.equal(
    questPeriod("WEEKLY", new Date("2026-09-20T23:59:59Z")),
    "W2026-09-14",
  );
  assert.equal(
    questPeriod("WEEKLY", new Date("2026-09-21T00:00:00Z")),
    "W2026-09-21",
  );
  assert.equal(
    questResetsAt("WEEKLY", WEDNESDAY)?.toISOString(),
    "2026-09-21T00:00:00.000Z",
  );
});

void test("one-time quests have a single period and never reset", () => {
  assert.equal(questPeriod("ONCE", WEDNESDAY), "ONCE");
  assert.equal(questResetsAt("ONCE", WEDNESDAY), null);
});

void test("a rare find is only for sale inside its window", () => {
  const window = {
    availableFrom: new Date("2026-09-17T12:00:00Z"),
    availableUntil: new Date("2026-09-18T12:00:00Z"),
  };
  assert.equal(
    isOfferAvailable(window, new Date("2026-09-17T11:59:59Z")),
    false,
  );
  assert.equal(
    isOfferAvailable(window, new Date("2026-09-17T12:00:00Z")),
    true,
  );
  assert.equal(
    isOfferAvailable(window, new Date("2026-09-18T12:00:00Z")),
    false,
  );
  assert.equal(
    isOfferAvailable({ availableFrom: null, availableUntil: null }, WEDNESDAY),
    true,
  );
});

const goblins = {
  type: "HUNT" as const,
  itemId: null,
  creatureId: 7,
  dungeonId: null,
  quantity: 10,
};
const gloamvault = {
  type: "CLEAR" as const,
  itemId: null,
  creatureId: null,
  dungeonId: 3,
  quantity: 2,
};
const ironOre = {
  type: "DELIVER" as const,
  itemId: 42,
  creatureId: null,
  dungeonId: null,
  quantity: 20,
};

void test("kills and clears add up per target", () => {
  const first = addQuestProgress({}, [goblins, gloamvault], {
    kills: [
      { creatureId: 7, count: 3 },
      { creatureId: 8, count: 5 },
    ],
    clearedDungeonId: 3,
  });
  assert.deepEqual(first, { "creature:7": 3, "dungeon:3": 1 });
  const second = addQuestProgress(first!, [goblins, gloamvault], {
    kills: [{ creatureId: 7, count: 4 }],
    clearedDungeonId: null,
  });
  assert.deepEqual(second, { "creature:7": 7, "dungeon:3": 1 });
});

void test("an unrelated claim leaves quest progress untouched", () => {
  assert.equal(
    addQuestProgress({}, [goblins, ironOre], {
      kills: [{ creatureId: 99, count: 5 }],
      clearedDungeonId: 3,
    }),
    null,
  );
});

void test("objective progress is capped, and deliveries count what is held", () => {
  const progress = { "creature:7": 14 };
  const held = new Map([[42, 12]]);
  assert.equal(objectiveProgress(goblins, progress, held), 10);
  assert.equal(objectiveProgress(gloamvault, progress, held), 0);
  assert.equal(objectiveProgress(ironOre, progress, held), 12);
  assert.equal(objectiveProgress(ironOre, progress, new Map([[42, 50]])), 20);
});

void test("stored progress ignores broken values", () => {
  assert.deepEqual(
    parseQuestProgress({ "creature:1": 2.9, "creature:2": -1, bad: "x" }),
    { "creature:1": 2 },
  );
  assert.deepEqual(parseQuestProgress(null), {});
  assert.deepEqual(parseQuestProgress([1, 2]), {});
});

void test("each project requirement weighs the same in a contribution share", () => {
  // Half the planks and none of the iron is a quarter of the project.
  assert.equal(
    contributionShare([
      { quantity: 1_000, contributed: 500 },
      { quantity: 10, contributed: 0 },
    ]),
    0.25,
  );
  // Giving more than a requirement needs never counts past it.
  assert.equal(contributionShare([{ quantity: 10, contributed: 20 }]), 1);
  assert.equal(contributionShare([]), 0);
});

void test("a place is on the map only with both coordinates", () => {
  assert.deepEqual(mapPoint({ mapX: 12.5, mapY: 80 }), { x: 12.5, y: 80 });
  assert.equal(mapPoint({ mapX: 12.5, mapY: null }), null);
  assert.equal(mapPoint({ mapX: null, mapY: null }), null);
});

void test("an NPC without a chosen head uses the default crop", () => {
  assert.deepEqual(
    headCrop({ headX: null, headY: 0.1, headSize: 0.5 }),
    DEFAULT_HEAD_CROP,
  );
  assert.deepEqual(headCrop({ headX: 0.3, headY: 0.1, headSize: 0.4 }), {
    x: 0.3,
    y: 0.1,
    size: 0.4,
  });
});

void test("a head crop stays square and inside the portrait", () => {
  // A 2:3 portrait: a crop of 0.6 of the width is 0.4 of the height.
  const corner = clampHeadCrop({ x: 0.9, y: 0.9, size: 0.6 }, 1.5);
  assert.equal(corner.size, 0.6);
  assert.ok(Math.abs(corner.x - 0.4) < 1e-9);
  assert.ok(Math.abs(corner.y - 0.6) < 1e-9);
  assert.deepEqual(clampHeadCrop({ x: -1, y: -1, size: 0.01 }, 1.5), {
    x: 0,
    y: 0,
    size: 0.15,
  });
  // A wide image caps the square at its height.
  assert.deepEqual(clampHeadCrop({ x: 0, y: 0, size: 1 }, 0.5), {
    x: 0,
    y: 0,
    size: 0.5,
  });
});
