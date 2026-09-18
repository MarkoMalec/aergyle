import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import {
  VOCATION_DEPENDENCY_ITEMS,
  VOCATION_EXPANSION,
  VOCATION_EXPANSION_LOCATIONS,
  vocationItemCreateData,
  vocationSpritePath,
} from "../prisma/content/vocationExpansion";
import {
  getLocationRequiredLevel,
  meetsLocationLevelRequirement,
} from "../src/server/travel/requirements";

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
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance)
    return left;
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

void test("the pack contains six distinct resources for every requested vocation", () => {
  assert.equal(VOCATION_EXPANSION.length, 24);
  assert.equal(new Set(VOCATION_EXPANSION.map((item) => item.slug)).size, 24);
  assert.equal(new Set(VOCATION_EXPANSION.map((item) => item.name)).size, 24);
  assert.equal(new Set(VOCATION_EXPANSION.map(vocationSpritePath)).size, 24);

  for (const actionType of [
    "MINING",
    "WOODCUTTING",
    "FISHING",
    "BLACKSMITHING",
  ] as const) {
    const resources = VOCATION_EXPANSION.filter(
      (resource) => resource.actionType === actionType,
    );
    assert.equal(resources.length, 6, actionType);
    const ordered = [...resources].sort(
      (a, b) => a.requiredSkillLevel - b.requiredSkillLevel,
    );
    for (let index = 1; index < ordered.length; index += 1) {
      assert.ok(
        ordered[index]!.defaultSeconds >= ordered[index - 1]!.defaultSeconds,
      );
      assert.ok(ordered[index]!.xpPerUnit >= ordered[index - 1]!.xpPerUnit);
      assert.ok(ordered[index]!.price >= ordered[index - 1]!.price);
    }
  }
});

void test("atlas locations retain the map names and exact access thresholds", () => {
  assert.deepEqual(VOCATION_EXPANSION_LOCATIONS, [
    { name: "Citadel", requiredLevel: 1 },
    { name: "Goblins Camp", requiredLevel: 40 },
    { name: "Frostcrown Peaks", requiredLevel: 50 },
    { name: "Ruins of Caldrath", requiredLevel: 80 },
    { name: "Mount Doom", requiredLevel: 150 },
    { name: "Pirate Island", requiredLevel: 200 },
  ]);
  const levels = new Map(
    VOCATION_EXPANSION_LOCATIONS.map((location) => [
      location.name,
      location.requiredLevel,
    ]),
  );
  for (const resource of VOCATION_EXPANSION) {
    for (const location of resource.locations) {
      assert.ok(
        resource.requiredSkillLevel >= levels.get(location)!,
        `${resource.name} is too easy for ${location}`,
      );
    }
  }
});

void test("location access unlocks on the exact player level boundary", () => {
  assert.equal(getLocationRequiredLevel({ requiredLevel: null }), 1);
  assert.equal(meetsLocationLevelRequirement({ requiredLevel: 80 }, 79), false);
  assert.equal(meetsLocationLevelRequirement({ requiredLevel: 80 }, 80), true);
  assert.equal(
    meetsLocationLevelRequirement({ requiredLevel: 1 }, Number.NaN),
    false,
  );
});

void test("bait and blacksmithing recipes have increasing, profitable input costs", () => {
  const fishing = VOCATION_EXPANSION.filter(
    (resource) => resource.actionType === "FISHING",
  ).sort((a, b) => a.requiredSkillLevel - b.requiredSkillLevel);
  assert.deepEqual(
    fishing.map((resource) => resource.requirements[0]?.quantityPerUnit),
    [1, 1, 2, 2, 3, 4],
  );
  assert.ok(
    fishing.every(
      (resource) =>
        resource.requirements.length === 1 &&
        resource.requirements[0]?.itemName === "Worm",
    ),
  );

  const prices = new Map([
    ...VOCATION_DEPENDENCY_ITEMS.map(
      (item) => [item.name, item.price] as const,
    ),
    ...VOCATION_EXPANSION.map((item) => [item.name, item.price] as const),
  ]);
  for (const resource of VOCATION_EXPANSION.filter(
    (item) =>
      item.actionType === "FISHING" || item.actionType === "BLACKSMITHING",
  )) {
    const inputValue = resource.requirements.reduce(
      (sum, requirement) =>
        sum + prices.get(requirement.itemName)! * requirement.quantityPerUnit,
      0,
    );
    assert.ok(
      resource.price > inputValue,
      `${resource.name} has no value margin`,
    );
  }

  const blacksmithing = VOCATION_EXPANSION.filter(
    (resource) => resource.actionType === "BLACKSMITHING",
  );
  assert.ok(
    blacksmithing.every((resource) => resource.requirements.length >= 2),
  );
  for (const [index, resource] of blacksmithing.entries()) {
    for (const requirement of resource.requirements) {
      const dependencyIndex = blacksmithing.findIndex(
        (candidate) => candidate.name === requirement.itemName,
      );
      assert.ok(
        dependencyIndex === -1 || dependencyIndex < index,
        `${resource.name} has a forward/cyclic blacksmithing dependency`,
      );
    }
  }
});

void test("all runtime sprites are compact 256px RGBA assets with true transparency", () => {
  for (const resource of VOCATION_EXPANSION) {
    const sprite = readFileSync(
      new URL(`../public${vocationSpritePath(resource)}`, import.meta.url),
    );
    assert.equal(sprite.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(sprite.readUInt32BE(16), 256);
    assert.equal(sprite.readUInt32BE(20), 256);
    assert.ok(sprite.length < 150_000, `${resource.slug} is not optimized`);

    const inspection = inspectRgbaPng(sprite);
    assert.ok(
      inspection.transparentPixels > 256 * 256 * 0.25,
      `${resource.slug} needs true transparent space`,
    );
    assert.ok(
      inspection.opaquePixels > 256 * 256 * 0.1,
      `${resource.slug} has too little readable subject matter`,
    );
    assert.ok(
      inspection.longestOccupiedDimension >= 190 &&
        inspection.longestOccupiedDimension <= 224,
      `${resource.slug} does not fit its safe area (${inspection.longestOccupiedDimension}px)`,
    );

    const item = vocationItemCreateData(resource);
    assert.equal(item.stackable, true);
    assert.equal(item.maxStackSize, 9999);
    assert.equal(item.rarity, resource.rarity);
  }
});
