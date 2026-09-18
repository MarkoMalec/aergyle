import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import {
  CARPENTRY_PLANKS,
  carpentryPlankItemCreateData,
  carpentryRequirementsForPlank,
} from "../prisma/content/carpentry";
import { VOCATION_EXPANSION } from "../prisma/content/vocationExpansion";
import { ItemType, VocationalActionType } from "../src/generated/prisma/enums";
import {
  getCraftingRule,
  validateCraftingItemTypes,
} from "../src/game/crafting";

type PngInspection = {
  transparentPixels: number;
  opaquePixels: number;
  longestOccupiedDimension: number;
};

function paeth(left: number, above: number, upperLeft: number) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function inspectRgbaPng(png: Buffer): PngInspection {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(png[24], 8, "expected 8-bit PNG channels");
  assert.equal(png[25], 6, "expected RGBA PNG");
  assert.equal(png[28], 0, "expected a non-interlaced PNG");

  const idatChunks: Buffer[] = [];
  let chunkOffset = 8;
  while (chunkOffset < png.length) {
    const length = png.readUInt32BE(chunkOffset);
    const type = png.toString("ascii", chunkOffset + 4, chunkOffset + 8);
    if (type === "IDAT") {
      idatChunks.push(png.subarray(chunkOffset + 8, chunkOffset + 8 + length));
    }
    chunkOffset += length + 12;
    if (type === "IEND") break;
  }

  const decoded = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  let sourceOffset = 0;
  let previous = Buffer.alloc(stride);
  let transparentPixels = 0;
  let opaquePixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    const filter = decoded[sourceOffset++];
    const current = Buffer.alloc(stride);
    for (let byteIndex = 0; byteIndex < stride; byteIndex += 1) {
      const raw = decoded[sourceOffset++];
      const left =
        byteIndex >= bytesPerPixel ? current[byteIndex - bytesPerPixel]! : 0;
      const above = previous[byteIndex]!;
      const upperLeft =
        byteIndex >= bytesPerPixel ? previous[byteIndex - bytesPerPixel]! : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : filter === 4
                  ? paeth(left, above, upperLeft)
                  : Number.NaN;
      assert.ok(Number.isFinite(predictor), `unsupported PNG filter ${filter}`);
      current[byteIndex] = (raw! + predictor) & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const alpha = current[x * bytesPerPixel + 3]!;
      if (alpha === 0) transparentPixels += 1;
      if (alpha >= 250) opaquePixels += 1;
      if (alpha > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    previous = current;
  }

  return {
    transparentPixels,
    opaquePixels,
    longestOccupiedDimension: Math.max(maxX - minX + 1, maxY - minY + 1),
  };
}

void test("Carpentry defines one plank for every live log species", () => {
  assert.equal(CARPENTRY_PLANKS.length, 8);
  assert.deepEqual(
    new Set(CARPENTRY_PLANKS.map((plank) => plank.sourceLogName)),
    new Set([
      "Oak Log",
      "Birch Log",
      "Pine Log",
      "Willow Log",
      "Ash Log",
      "Frostpine Log",
      "Elderwood Log",
      "Emberwood Log",
    ]),
  );
  assert.equal(
    new Set(CARPENTRY_PLANKS.map((plank) => plank.name)).size,
    CARPENTRY_PLANKS.length,
  );
  assert.equal(
    new Set(CARPENTRY_PLANKS.map((plank) => plank.sprite)).size,
    CARPENTRY_PLANKS.length,
  );
});

void test("every plank is a profitable one-log material recipe", () => {
  const sourcePrices = new Map<string, number>([
    ["Oak Log", 1],
    ["Birch Log", 1],
    ...VOCATION_EXPANSION.filter((item) => item.itemType === "LOG").map(
      (item) => [item.name, item.price] as [string, number],
    ),
  ]);

  for (const plank of CARPENTRY_PLANKS) {
    assert.deepEqual(carpentryRequirementsForPlank(plank), [
      { itemName: plank.sourceLogName, quantityPerUnit: 1 },
    ]);
    assert.ok(plank.price > sourcePrices.get(plank.sourceLogName)!);
    assert.equal(plank.yieldPerUnit, 1);
    const item = carpentryPlankItemCreateData(plank);
    assert.equal(item.itemType, "MATERIAL");
    assert.equal(item.stackable, true);
    assert.equal(item.maxStackSize, 9999);
    assert.equal(item.rarity, plank.rarity);
  }
});

void test("plank progression increases with the source-log tiers", () => {
  const ordered = [...CARPENTRY_PLANKS].sort(
    (left, right) =>
      left.requiredSkillLevel - right.requiredSkillLevel ||
      left.price - right.price,
  );
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(
      ordered[index]!.requiredSkillLevel >=
        ordered[index - 1]!.requiredSkillLevel,
    );
    assert.ok(
      ordered[index]!.defaultSeconds >= ordered[index - 1]!.defaultSeconds,
    );
    assert.ok(ordered[index]!.xpPerUnit >= ordered[index - 1]!.xpPerUnit);
    assert.ok(ordered[index]!.price >= ordered[index - 1]!.price);
  }
});

void test("the shared crafting rules accept log-to-material Carpentry", () => {
  const rule = getCraftingRule(VocationalActionType.CARPENTRY);
  assert.ok(rule?.outputTypes.includes(ItemType.MATERIAL));
  assert.ok(rule?.inputTypes.includes(ItemType.LOG));
  assert.equal(
    validateCraftingItemTypes({
      actionType: VocationalActionType.CARPENTRY,
      outputType: ItemType.MATERIAL,
      inputTypes: [ItemType.LOG],
    }),
    null,
  );
});

void test("all plank sprites are compact transparent 256px RGBA assets", () => {
  for (const plank of CARPENTRY_PLANKS) {
    const png = readFileSync(
      new URL(`../public${plank.sprite}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.ok(png.length < 130_000, `${plank.slug} is not optimized`);

    const inspection = inspectRgbaPng(png);
    assert.ok(
      inspection.transparentPixels > 256 * 256 * 0.25,
      `${plank.slug} needs true transparent space`,
    );
    assert.ok(
      inspection.opaquePixels > 256 * 256 * 0.08,
      `${plank.slug} has too little readable subject matter`,
    );
    assert.ok(
      inspection.longestOccupiedDimension >= 190 &&
        inspection.longestOccupiedDimension <= 224,
      `${plank.slug} does not fit its safe area (${inspection.longestOccupiedDimension}px)`,
    );
  }
});
