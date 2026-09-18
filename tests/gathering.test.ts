import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  GATHERING_DURATIONS,
  GATHERING_ITEMS,
  GATHERING_LOCATIONS,
} from "../prisma/content/gathering";
import { COOKING_INGREDIENTS } from "../prisma/content/cooking";
import {
  calculateGatheringRewardModifiers,
  calculateGatheringRewards,
} from "../src/server/gathering/rewards";
import { runGatheringSimulation } from "../src/server/gathering/simulator";

void test("initial Gathering pool contains six distinct forage foods and six herbs", () => {
  const food = GATHERING_ITEMS.filter((item) => item.itemType === "VEGETABLE");
  const herbs = GATHERING_ITEMS.filter((item) => item.itemType === "HERB");
  assert.equal(food.length, 6);
  assert.equal(herbs.length, 6);
  assert.ok(food.some((item) => item.name === "Mushrooms"));
  assert.deepEqual(
    new Set(herbs.map((item) => item.name)),
    new Set(["Mint", "Sage", "Rosemary", "Chamomile", "Lavender", "Thyme"]),
  );
  assert.equal(new Set(GATHERING_ITEMS.map((item) => item.name)).size, 12);

  const existingCookingNames = new Set(
    COOKING_INGREDIENTS.map((item) => item.name),
  );
  assert.ok(
    GATHERING_ITEMS.every(
      (item) => !existingCookingNames.has(item.name as never),
    ),
    "Gathering content must not duplicate existing cooking ingredients",
  );
});

void test("Gathering uses only existing-location definitions and valid pool balance", () => {
  const itemNames = new Set(GATHERING_ITEMS.map((item) => item.name));
  assert.ok(GATHERING_LOCATIONS.length >= 2);
  for (const location of GATHERING_LOCATIONS) {
    assert.ok(location.requiredGatheringLevel >= 1);
    assert.ok(location.resources.length > 0);
    for (const entry of location.resources) {
      assert.ok(itemNames.has(entry.itemName));
      assert.ok(entry.baseChance > 0 && entry.baseChance <= 1);
      assert.ok(entry.minQuantity >= 1);
      assert.ok(entry.maxQuantity >= entry.minQuantity);
    }
  }
});

void test("longer configured expeditions improve rolls, quantity scaling, and XP", () => {
  const sorted = [...GATHERING_DURATIONS].sort(
    (a, b) => a.durationSeconds - b.durationSeconds,
  );
  assert.deepEqual(
    sorted.map((duration) => duration.durationSeconds),
    [3_600, 7_200, 10_800, 14_400],
  );
  assert.deepEqual(
    sorted.map((duration) => duration.requiredGatheringLevel),
    [0, 15, 50, 100],
  );
  for (let index = 1; index < sorted.length; index += 1) {
    assert.ok(
      sorted[index]!.requiredGatheringLevel >
        sorted[index - 1]!.requiredGatheringLevel,
    );
    assert.ok(sorted[index]!.rewardRolls > sorted[index - 1]!.rewardRolls);
    assert.ok(
      sorted[index]!.quantityMultiplier >=
        sorted[index - 1]!.quantityMultiplier,
    );
    assert.ok(sorted[index]!.xpReward > sorted[index - 1]!.xpReward);
  }
});

const pool = [
  {
    resourceId: 1,
    itemId: 10,
    name: "Mushrooms",
    sprite: "/mushrooms.png",
    rarity: "COMMON" as const,
    baseChance: 0.2,
    minQuantity: 1,
    maxQuantity: 1,
  },
  {
    resourceId: 2,
    itemId: 11,
    name: "Mint",
    sprite: "/mint.png",
    rarity: "UNCOMMON" as const,
    baseChance: 0.2,
    minQuantity: 1,
    maxQuantity: 1,
  },
];

void test("skill, Luck, and Gathering Efficiency modify the same clear find formula", () => {
  const baseline = calculateGatheringRewards({
    pool,
    rewardRolls: 1,
    quantityMultiplier: 1,
    skillLevel: 1,
    luck: 0,
    gatheringEfficiency: 0,
    random: () => 0.3,
  });
  const improved = calculateGatheringRewards({
    pool,
    rewardRolls: 1,
    quantityMultiplier: 1,
    skillLevel: 51,
    luck: 50,
    gatheringEfficiency: 60,
    random: () => 0.3,
  });
  assert.equal(baseline.length, 1, "empty hauls receive one weighted fallback");
  assert.equal(
    improved.length,
    2,
    "improved chance can find several resources",
  );
});

void test("duration and stat quantity modifiers scale a successful haul", () => {
  const short = calculateGatheringRewards({
    pool: [pool[0]!],
    rewardRolls: 1,
    quantityMultiplier: 1,
    skillLevel: 1,
    luck: 0,
    gatheringEfficiency: 0,
    random: () => 0,
  });
  const long = calculateGatheringRewards({
    pool: [pool[0]!],
    rewardRolls: 3,
    quantityMultiplier: 1.6,
    skillLevel: 30,
    luck: 20,
    gatheringEfficiency: 20,
    random: () => 0,
  });
  assert.equal(short[0]?.quantity, 1);
  assert.ok((long[0]?.quantity ?? 0) > 3);
});

void test("admin simulator uses the live modifiers and reports normalized yield", () => {
  const modifiers = calculateGatheringRewardModifiers({
    skillLevel: 51,
    luck: 50,
    gatheringEfficiency: 60,
    quantityMultiplier: 1.6,
  });
  assert.equal(modifiers.findModifierPercent, 105);
  assert.equal(modifiers.quantityModifierPercent, 45);
  assert.equal(modifiers.quantityScale, 2.32);

  const simulation = runGatheringSimulation({
    pool,
    durationSeconds: 7_200,
    rewardRolls: 1,
    quantityMultiplier: 1,
    skillLevel: 1,
    luck: 0,
    gatheringEfficiency: 0,
    iterations: 10,
    random: () => 0,
  });
  assert.equal(simulation.averageItemsPerExpedition, 2);
  assert.equal(simulation.averageItemsPerHour, 1);
  assert.equal(simulation.averageDistinctResources, 2);
  assert.ok(
    simulation.resources.every((resource) => resource.expeditionFindRate === 1),
  );
});

void test("all Gathering sprites are production-sized RGBA PNGs", () => {
  for (const item of GATHERING_ITEMS) {
    const png = readFileSync(
      new URL(`../public${item.sprite}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[25], 6, `${item.name} must retain RGBA transparency`);
  }
});
