import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  WAYFARER_ACCESSORIES,
  wayfarerAccessoryCreateData,
  wayfarerAccessorySpritePath,
} from "../prisma/content/wayfarerAccessories";
import { StatType } from "../src/generated/prisma/enums";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";

const BACKPACK_LADDER = [
  ["novices-satchel", 1, 3],
  ["foragers-pouch", 10, 5],
  ["trail-satchel", 20, 8],
  ["leatherway-pack", 35, 11],
  ["scouts-knapsack", 50, 15],
  ["rangers-fieldpack", 70, 19],
  ["expedition-rucksack", 95, 22],
  ["travelers-backpack", 120, 25],
  ["wayfinders-pack", 150, 29],
  ["caravan-pack", 185, 34],
  ["surveyors-rig", 225, 40],
  ["trailblazers-loadpack", 270, 47],
  ["wardens-supply-pack", 320, 55],
  ["horizon-hauler", 380, 64],
  ["atlas-bearers-pack", 450, 74],
] as const;

void test("the pack contains the accessory mix and a fifteen-tier backpack ladder", () => {
  assert.equal(WAYFARER_ACCESSORIES.length, 20);
  assert.equal(new Set(WAYFARER_ACCESSORIES.map((item) => item.slug)).size, 20);
  assert.equal(new Set(WAYFARER_ACCESSORIES.map((item) => item.name)).size, 20);
  assert.deepEqual(
    Object.fromEntries(
      ["RING", "AMULET", "NECKLACE", "BACKPACK"].map((itemType) => [
        itemType,
        WAYFARER_ACCESSORIES.filter((item) => item.itemType === itemType)
          .length,
      ]),
    ),
    { RING: 2, AMULET: 2, NECKLACE: 1, BACKPACK: 15 },
  );
  for (const item of WAYFARER_ACCESSORIES) {
    assert.ok(item.requiredLevel >= 1 && item.requiredLevel <= 450);
    assert.ok(item.price > 0);
  }
});

void test("all twenty definitions point to separate optimized RGBA sprites", () => {
  assert.equal(
    new Set(WAYFARER_ACCESSORIES.map(wayfarerAccessorySpritePath)).size,
    20,
  );
  for (const item of WAYFARER_ACCESSORIES) {
    const sprite = readFileSync(
      new URL(`../public${wayfarerAccessorySpritePath(item)}`, import.meta.url),
    );
    assert.equal(sprite.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(sprite.readUInt32BE(16), 256);
    assert.equal(sprite.readUInt32BE(20), 256);
    assert.equal(sprite[25], 6, `${item.slug} needs RGB plus alpha`);
    assert.ok(sprite.length < 150_000);
  }
});

void test("templates are non-stackable and keep canonical base stats", () => {
  for (const item of WAYFARER_ACCESSORIES) {
    const data = wayfarerAccessoryCreateData(item);
    assert.equal(data.stackable, false);
    assert.equal(data.maxStackSize, 1);
    assert.equal(data.itemType, item.itemType);
    assert.equal(data.equipTo, item.equipTo);
    assert.equal(data.requiredLevel, item.requiredLevel);
    assert.equal(data.armor, item.stats.ARMOR ?? 0);
    assert.deepEqual(
      data.stats?.create,
      Object.entries(item.stats).map(([statType, value]) => ({
        statType,
        value,
      })),
    );
  }
});

void test("backpack capacity rises cleanly through the level ladder", () => {
  const backpacks = WAYFARER_ACCESSORIES.filter(
    (item) => item.itemType === "BACKPACK",
  );
  assert.equal(backpacks.length, BACKPACK_LADDER.length);
  assert.deepEqual(
    backpacks.map((item) => [
      item.slug,
      item.requiredLevel,
      item.stats.CARRYING_CAPACITY,
    ]),
    BACKPACK_LADDER,
  );

  for (let index = 1; index < backpacks.length; index += 1) {
    const current = backpacks[index];
    const previous = backpacks[index - 1];
    if (!current || !previous) throw new Error("backpack tier is missing");
    assert.ok(current.requiredLevel > previous.requiredLevel);
    assert.ok(
      (current.stats.CARRYING_CAPACITY ?? 0) >
        (previous.stats.CARRYING_CAPACITY ?? 0),
    );
  }
});

void test("backpack capacity and load trade-offs stay exact at every rarity", () => {
  for (const backpack of WAYFARER_ACCESSORIES.filter(
    (item) => item.itemType === "BACKPACK",
  )) {
    const expectedStats = Object.entries(backpack.stats).map(
      ([statType, value]) => ({ statType: statType as StatType, value }),
    );
    assert.equal(
      backpack.statRarityOverrides?.length,
      expectedStats.length * 12,
    );

    for (const [rarity, rarityMultiplier] of [
      ["WORTHLESS", 0.5],
      ["COMMON", 1],
      ["DIVINE", 3],
    ] as const) {
      const stats = resolveEffectiveItemStats({
        rarity,
        rarityMultiplier,
        stats: expectedStats,
        statRarityOverrides: backpack.statRarityOverrides,
      });
      assert.deepEqual(stats, expectedStats);
    }
  }
});
