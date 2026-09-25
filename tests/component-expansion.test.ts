import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import {
  BASIC_PICKAXE_REQUIREMENTS,
  COMPONENT_CRAFTS,
  COMPONENT_GATHERING_SOURCES,
  COMPONENT_ITEMS,
  componentItemCreateData,
} from "../prisma/content/componentExpansion";
import { ItemType, VocationalActionType } from "../src/generated/prisma/enums";
import {
  SHIPPED_SKILL_ITEM_RULES,
  shippedCraftConflict,
} from "./shippedSkillItemRules";

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

function inspectRgbaPng(png: Buffer) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
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
  const stride = width * 4;
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
      const left = byteIndex >= 4 ? current[byteIndex - 4]! : 0;
      const above = previous[byteIndex]!;
      const upperLeft = byteIndex >= 4 ? previous[byteIndex - 4]! : 0;
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
      const alpha = current[x * 4 + 3]!;
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

void test("component expansion defines five reusable stackable items", () => {
  assert.deepEqual(
    COMPONENT_ITEMS.map((item) => item.name),
    [
      "Wooden Handle",
      "Duskbound Handle",
      "Dusk Oil",
      "Tempering Resin",
      "Hardened Leather",
    ],
  );
  assert.equal(new Set(COMPONENT_ITEMS.map((item) => item.slug)).size, 5);
  assert.equal(new Set(COMPONENT_ITEMS.map((item) => item.sprite)).size, 5);

  for (const definition of COMPONENT_ITEMS) {
    const item = componentItemCreateData(definition);
    assert.equal(item.stackable, true);
    assert.equal(item.maxStackSize, 9999);
    assert.equal(item.equipTo, null);
    assert.ok(
      !definition.description.includes("Basic Pickaxe"),
      `${definition.name} should not be tied to one consumer`,
    );
  }
});

void test("crafting chains preserve general-purpose component types", () => {
  const crafts = new Map(
    COMPONENT_CRAFTS.map((craft) => [craft.outputItemName, craft]),
  );
  assert.deepEqual(crafts.get("Wooden Handle")?.requirements, [
    { itemName: "Oak Plank", quantityPerUnit: 1 },
  ]);
  assert.deepEqual(crafts.get("Hardened Leather")?.requirements, [
    { itemName: "Soft Hide", quantityPerUnit: 2 },
    { itemName: "Tempering Resin", quantityPerUnit: 1 },
  ]);
  assert.deepEqual(crafts.get("Duskbound Handle")?.requirements, [
    { itemName: "Elderwood Plank", quantityPerUnit: 1 },
    { itemName: "Dusk Oil", quantityPerUnit: 1 },
    { itemName: "Hardened Leather", quantityPerUnit: 1 },
  ]);
  assert.equal(
    COMPONENT_ITEMS.find((item) => item.name === "Hardened Leather")?.itemType,
    "HIDE",
  );
  assert.ok(
    COMPONENT_ITEMS.filter((item) => item.name !== "Hardened Leather").every(
      (item) => item.itemType === "MATERIAL",
    ),
  );
});

void test("Basic Pickaxe consumes a normal Wooden Handle", () => {
  assert.deepEqual(BASIC_PICKAXE_REQUIREMENTS, [
    { itemName: "Iron Ingot", quantityPerUnit: 1 },
    { itemName: "Wooden Handle", quantityPerUnit: 1 },
  ]);
});

void test("crafting rules support prepared leather and wrapped woodwork", () => {
  const carpentry = SHIPPED_SKILL_ITEM_RULES.CARPENTRY;
  const tailoring = SHIPPED_SKILL_ITEM_RULES.TAILORING;
  assert.ok(carpentry?.inputTypes.includes(ItemType.HIDE));
  assert.ok(tailoring?.outputTypes.includes(ItemType.HIDE));
  assert.equal(
    shippedCraftConflict({
      actionType: VocationalActionType.CARPENTRY,
      outputType: ItemType.MATERIAL,
      inputTypes: [ItemType.MATERIAL, ItemType.HIDE],
    }),
    null,
  );
  assert.equal(
    shippedCraftConflict({
      actionType: VocationalActionType.TAILORING,
      outputType: ItemType.HIDE,
      inputTypes: [ItemType.HIDE, ItemType.MATERIAL],
    }),
    null,
  );
});

void test("Tempering Resin has gathering sources", () => {
  assert.deepEqual(COMPONENT_GATHERING_SOURCES, [
    {
      itemName: "Tempering Resin",
      requiredSkillLevel: 18,
      locations: [
        {
          locationName: "Goblins Camp",
          baseChance: 0.16,
          minQuantity: 1,
          maxQuantity: 1,
        },
        {
          locationName: "Ruins of Caldrath",
          baseChance: 0.28,
          minQuantity: 1,
          maxQuantity: 2,
        },
      ],
    },
  ]);
});

void test("all component sprites are compact transparent inventory assets", () => {
  for (const item of COMPONENT_ITEMS) {
    const png = readFileSync(
      new URL(`../public${item.sprite}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[24], 8);
    assert.equal(png[25], 6);
    assert.equal(png[28], 0);
    assert.ok(png.length < 130_000, `${item.slug} is not optimized`);

    const inspection = inspectRgbaPng(png);
    assert.ok(
      inspection.transparentPixels > 256 * 256 * 0.25,
      `${item.slug} needs true transparent space`,
    );
    assert.ok(
      inspection.opaquePixels > 256 * 256 * 0.04,
      `${item.slug} has too little readable subject matter`,
    );
    assert.ok(
      inspection.longestOccupiedDimension >= 190 &&
        inspection.longestOccupiedDimension <= 224,
      `${item.slug} does not fit its safe area (${inspection.longestOccupiedDimension}px)`,
    );
  }
});
