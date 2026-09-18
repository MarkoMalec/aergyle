import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import {
  COOKING_DISHES,
  COOKING_EXISTING_INGREDIENT_TYPES,
  COOKING_INGREDIENTS,
  COOKING_ITEMS,
  COOKING_RECIPES,
  COOKING_RECIPE_SPRITE,
  COOKING_SEEDS,
  cookingItemCreateData,
} from "../prisma/content/cooking";
import { StatType } from "../src/generated/prisma/enums";
import { calculateFinalStats, getDefaultBaseStats } from "../src/utils/stats";

function countAlphaPixels(png: Buffer) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const idatChunks: Buffer[] = [];
  let offset = 8;

  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") {
      idatChunks.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
    if (type === "IEND") break;
  }

  const decoded = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  let sourceOffset = 0;
  let previous = Buffer.alloc(stride);
  let transparent = 0;
  let visible = 0;

  const paeth = (left: number, above: number, upperLeft: number) => {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
      return left;
    }
    return aboveDistance <= upperLeftDistance ? above : upperLeft;
  };

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
      if (alpha === 0) transparent += 1;
      if (alpha > 16) visible += 1;
    }
    previous = current;
  }

  return { transparent, visible, total: width * height };
}

void test("cooking ships seven dishes, five learnable recipes and two starter dishes", () => {
  assert.equal(COOKING_DISHES.length, 7);
  assert.equal(COOKING_RECIPES.length, 5);
  assert.equal(
    COOKING_DISHES.filter((dish) => dish.requiredRecipeName === null).length,
    2,
  );
  assert.equal(
    COOKING_DISHES.filter((dish) => dish.requiredRecipeName !== null).length,
    5,
  );
  assert.equal(new Set(COOKING_DISHES.map((dish) => dish.slug)).size, 7);
  assert.equal(new Set(COOKING_DISHES.map((dish) => dish.name)).size, 7);
  assert.ok(COOKING_DISHES.every((dish) => dish.itemType === "FOOD"));
  assert.ok(COOKING_RECIPES.every((recipe) => recipe.itemType === "RECIPE"));

  const recipeNames = new Set(COOKING_RECIPES.map((recipe) => recipe.name));
  for (const dish of COOKING_DISHES) {
    if (dish.requiredRecipeName) {
      assert.ok(recipeNames.has(dish.requiredRecipeName));
    }
  }
});

void test("new vegetables have complete, plantable seed definitions", () => {
  assert.equal(COOKING_SEEDS.length, 6);
  assert.deepEqual(
    new Set(COOKING_SEEDS.map((seed) => seed.seedYieldItemName)),
    new Set([
      "Potato",
      "Onion",
      "Garlic",
      "Bell Pepper",
      "Chili Pepper",
      "Asparagus",
    ]),
  );

  const ingredientNames = new Set(
    COOKING_INGREDIENTS.map((ingredient) => ingredient.name),
  );
  for (const seed of COOKING_SEEDS) {
    assert.equal(seed.itemType, "SEED");
    assert.ok(ingredientNames.has(seed.seedYieldItemName));
    assert.ok(seed.seedGrowSeconds > 0);
    assert.ok(seed.seedHarvestSeconds > 0);
    assert.ok(seed.seedYieldMin > 0);
    assert.ok(seed.seedYieldMax >= seed.seedYieldMin);
    assert.ok(seed.seedXp > 0);
  }
});

void test("Pan-fried Perch is an immediately available level-one dish", () => {
  const dish = COOKING_DISHES.find(
    (candidate) => candidate.name === "Pan-fried Perch",
  );
  assert.ok(dish);
  assert.equal(dish.requiredSkillLevel, 1);
  assert.equal(dish.requiredRecipeName, null);
  assert.deepEqual(dish.requirements, [
    { itemName: "Perch", quantityPerUnit: 1 },
    { itemName: "Garlic", quantityPerUnit: 1 },
  ]);
});

void test("every cooking requirement is a concrete fish, meat or vegetable", () => {
  const typesByName = new Map<string, string>([
    ...Object.entries(COOKING_EXISTING_INGREDIENT_TYPES),
    ...COOKING_INGREDIENTS.map(
      (ingredient) => [ingredient.name, ingredient.itemType] as const,
    ),
  ]);
  const allowedTypes = new Set(["FISH", "MEAT", "VEGETABLE"]);

  for (const dish of COOKING_DISHES) {
    assert.ok(dish.requirements.length > 0, `${dish.name} needs ingredients`);
    assert.ok(dish.defaultSeconds > 0, `${dish.name} needs cooking time`);
    assert.ok(dish.xpPerUnit > 0, `${dish.name} needs vocational XP`);
    assert.equal(
      new Set(dish.requirements.map((requirement) => requirement.itemName))
        .size,
      dish.requirements.length,
      `${dish.name} repeats an ingredient`,
    );
    for (const requirement of dish.requirements) {
      assert.ok(requirement.quantityPerUnit > 0);
      assert.ok(
        allowedTypes.has(typesByName.get(requirement.itemName) ?? ""),
        `${requirement.itemName} has an invalid cooking type`,
      );
    }
  }
});

void test("every dish has a finite, configurable timed stat benefit", () => {
  const supportedStats = new Set(Object.values(StatType));
  for (const dish of COOKING_DISHES) {
    assert.ok(dish.foodEffectSeconds > 0, `${dish.name} needs a duration`);
    assert.ok(dish.foodEffectStats.length > 0, `${dish.name} needs a benefit`);
    assert.equal(
      new Set(dish.foodEffectStats.map((stat) => stat.statType)).size,
      dish.foodEffectStats.length,
      `${dish.name} repeats a benefit`,
    );
    for (const stat of dish.foodEffectStats) {
      assert.ok(supportedStats.has(stat.statType));
      assert.ok(Number.isFinite(stat.value));
      assert.notEqual(stat.value, 0);
    }
    assert.equal(
      cookingItemCreateData(dish).foodEffectSeconds,
      dish.foodEffectSeconds,
    );
  }
});

void test("temporary food bonuses are included in final character stats", () => {
  const equipment = Object.fromEntries(
    Object.values(StatType).map((statType) => [statType, 0]),
  ) as Record<StatType, number>;
  const stats = calculateFinalStats(getDefaultBaseStats(), equipment, {
    [StatType.HEALTH]: 25,
    [StatType.HEALTH_REGEN]: 2,
    [StatType.PHYSICAL_DAMAGE_MIN]: 4,
    [StatType.COLD_RESIST]: 80,
  });

  assert.equal(stats.health, 125);
  assert.equal(stats.healthRegen, 3);
  assert.equal(stats.minPhysicalDamage, 5);
  assert.equal(stats.coldResist, 75, "normal stat caps still apply");
});

void test("runtime cooking artwork is compact 256px RGBA with real transparency", () => {
  assert.equal(new Set(COOKING_RECIPES.map((recipe) => recipe.sprite)).size, 1);
  assert.equal(COOKING_RECIPES[0]?.sprite, COOKING_RECIPE_SPRITE);

  const uniqueSprites = new Set(COOKING_ITEMS.map((item) => item.sprite));
  assert.equal(uniqueSprites.size, 21);
  for (const spritePath of uniqueSprites) {
    const png = readFileSync(
      new URL(`../public${spritePath}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[24], 8);
    assert.equal(png[25], 6);
    assert.equal(png[28], 0);
    assert.ok(png.length < 130_000, `${spritePath} is not optimized`);

    const alpha = countAlphaPixels(png);
    assert.ok(
      alpha.transparent > alpha.total * 0.2,
      `${spritePath} needs padding`,
    );
    assert.ok(
      alpha.visible > alpha.total * 0.08,
      `${spritePath} is unreadable`,
    );
  }
});
