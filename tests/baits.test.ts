import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BAIT_ITEMS,
  baitItemCreateData,
  baitSpritePath,
} from "../prisma/content/baits";

void test("the bait pack contains fifteen stackable fishing baits from level 1 to 500", () => {
  assert.equal(BAIT_ITEMS.length, 15);
  assert.deepEqual(
    BAIT_ITEMS.map((item) => item.requiredLevel),
    [1, 8, 16, 28, 42, 58, 76, 98, 122, 150, 185, 225, 270, 325, 500],
  );
  assert.equal(new Set(BAIT_ITEMS.map((item) => item.slug)).size, 15);
  assert.equal(new Set(BAIT_ITEMS.map((item) => item.name)).size, 15);
  assert.equal(new Set(BAIT_ITEMS.map(baitSpritePath)).size, 15);

  for (const bait of BAIT_ITEMS) {
    assert.equal(bait.itemType, "BAIT");
    const item = baitItemCreateData(bait);
    assert.equal(item.stackable, true);
    assert.equal(item.maxStackSize, 9_999);
    assert.equal(item.requiredLevel, bait.requiredLevel);
    assert.equal(item.sprite, baitSpritePath(bait));
  }
});

void test("every bait has a 256px RGBA runtime sprite", () => {
  for (const bait of BAIT_ITEMS) {
    const png = readFileSync(
      new URL(`../public${baitSpritePath(bait)}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[25], 6, `${bait.name} must preserve RGBA transparency`);
  }
});
