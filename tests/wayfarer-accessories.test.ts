import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  WAYFARER_ACCESSORIES,
  wayfarerAccessoryCreateData,
  wayfarerAccessorySpritePath,
} from "../prisma/content/wayfarerAccessories";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";

void test("the pack contains the requested low-tier equipment mix", () => {
  assert.equal(WAYFARER_ACCESSORIES.length, 6);
  assert.equal(new Set(WAYFARER_ACCESSORIES.map((item) => item.slug)).size, 6);
  assert.equal(new Set(WAYFARER_ACCESSORIES.map((item) => item.name)).size, 6);
  assert.deepEqual(
    Object.fromEntries(
      ["RING", "AMULET", "NECKLACE", "BACKPACK"].map((itemType) => [
        itemType,
        WAYFARER_ACCESSORIES.filter((item) => item.itemType === itemType)
          .length,
      ]),
    ),
    { RING: 2, AMULET: 2, NECKLACE: 1, BACKPACK: 1 },
  );
  for (const item of WAYFARER_ACCESSORIES) {
    assert.ok(["COMMON", "UNCOMMON"].includes(item.rarity));
    assert.ok(item.requiredLevel >= 1 && item.requiredLevel <= 5);
    assert.ok(item.price > 0);
  }
});

void test("all six definitions point to separate optimized RGBA sprites", () => {
  assert.equal(
    new Set(WAYFARER_ACCESSORIES.map(wayfarerAccessorySpritePath)).size,
    6,
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

void test("Traveler's Backpack always grants exactly 50 slots at a 5% speed cost", () => {
  const backpack = WAYFARER_ACCESSORIES.find(
    (item) => item.slug === "travelers-backpack",
  );
  assert.ok(backpack);
  assert.deepEqual(backpack.stats, {
    CARRYING_CAPACITY: 50,
    MOVEMENT_SPEED: -5,
  });
  assert.equal(backpack.statRarityOverrides?.length, 24);

  for (const [rarity, rarityMultiplier] of [
    ["WORTHLESS", 0.5],
    ["COMMON", 1],
    ["DIVINE", 3],
  ] as const) {
    const stats = resolveEffectiveItemStats({
      rarity,
      rarityMultiplier,
      stats: Object.entries(backpack.stats).map(([statType, value]) => ({
        statType: statType as keyof typeof backpack.stats,
        value,
      })),
      statRarityOverrides: backpack.statRarityOverrides,
    });
    assert.deepEqual(stats, [
      { statType: "CARRYING_CAPACITY", value: 50 },
      { statType: "MOVEMENT_SPEED", value: -5 },
    ]);
  }
});
