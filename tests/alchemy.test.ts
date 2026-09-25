import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ALCHEMY_HERB_TYPES,
  ALCHEMY_ITEMS,
  ALCHEMY_POTIONS,
  alchemyItemCreateData,
} from "../prisma/content/alchemy";
import { DUNGEON_MONSTERS, DUNGEONS } from "../prisma/content/dungeons";
import {
  GATHERING_ITEMS,
  GATHERING_LOCATIONS,
} from "../prisma/content/gathering";
import { VocationalActionType } from "../src/generated/prisma/enums";
import { getCraftingRule } from "../src/game/crafting";

void test("Alchemy ships a five-step immediate-healing progression", () => {
  assert.deepEqual(
    ALCHEMY_POTIONS.map((potion) => ({
      name: potion.name,
      itemType: potion.itemType,
      healingAmount: potion.healingAmount,
      requiredSkillLevel: potion.requiredSkillLevel,
    })),
    [
      {
        name: "Minor Healing Potion",
        itemType: "POTION",
        healingAmount: 30,
        requiredSkillLevel: 1,
      },
      {
        name: "Small Healing Potion",
        itemType: "POTION",
        healingAmount: 75,
        requiredSkillLevel: 10,
      },
      {
        name: "Medium Healing Potion",
        itemType: "POTION",
        healingAmount: 150,
        requiredSkillLevel: 25,
      },
      {
        name: "Big Healing Potion",
        itemType: "POTION",
        healingAmount: 325,
        requiredSkillLevel: 50,
      },
      {
        name: "Trollblood Elixir",
        itemType: "ELIXIR",
        healingAmount: 750,
        requiredSkillLevel: 80,
      },
    ],
  );

  for (const potion of ALCHEMY_POTIONS) {
    const item = alchemyItemCreateData(potion);
    assert.equal(item.stackable, true);
    assert.equal(item.maxStackSize, 9999);
    assert.equal(item.healingAmount, potion.healingAmount);
    assert.equal(item.foodEffectSeconds, null);
  }
});

void test("every new herb is gathered and every potion uses Water", () => {
  const herbNames = Object.keys(ALCHEMY_HERB_TYPES);
  assert.deepEqual(herbNames, [
    "Yarrow",
    "Aloe",
    "Ginseng",
    "Echinacea",
    "Amrans",
    "Arkasu Bark",
  ]);

  for (const herbName of herbNames) {
    const herb = GATHERING_ITEMS.find((item) => item.name === herbName);
    assert.equal(herb?.itemType, "HERB", `${herbName} must be a herb`);
    assert.ok(
      GATHERING_LOCATIONS.some((location) =>
        location.resources.some((resource) => resource.itemName === herbName),
      ),
      `${herbName} needs at least one gathering source`,
    );
    assert.ok(
      ALCHEMY_POTIONS.some((potion) =>
        potion.requirements.some(
          (requirement) => requirement.itemName === herbName,
        ),
      ),
      `${herbName} must be useful in a healing recipe`,
    );
  }

  assert.ok(
    ALCHEMY_POTIONS.every((potion) =>
      potion.requirements.some(
        (requirement) => requirement.itemName === "Water",
      ),
    ),
    "Water should be essential to the full healing-potion line",
  );
});

void test("Trollblood Elixir has a hard rare-monster recipe", () => {
  const elixir = ALCHEMY_POTIONS.at(-1)!;
  assert.deepEqual(elixir.requirements, [
    { itemName: "Water", quantityPerUnit: 3 },
    { itemName: "Troll Blood", quantityPerUnit: 1 },
    { itemName: "Ginseng", quantityPerUnit: 2 },
    { itemName: "Amrans", quantityPerUnit: 2 },
    { itemName: "Arkasu Bark", quantityPerUnit: 2 },
  ]);

  const troll = DUNGEON_MONSTERS.find(
    (monster) => monster.name === "Stoneback Troll",
  );
  assert.ok(troll);
  assert.deepEqual(
    troll.drops.find((drop) => drop.itemName === "Troll Blood"),
    {
      itemName: "Troll Blood",
      baseChance: 0.12,
      minQuantity: 1,
      maxQuantity: 1,
      requiredLevel: 65,
    },
  );
  assert.ok(
    DUNGEONS.some(
      (dungeon) =>
        dungeon.name === "Trollbreaker Cavern" &&
        dungeon.requiredLevel >= 65 &&
        dungeon.monsters.some((monster) => monster.name === troll.name),
    ),
  );
});

void test("Alchemy is a crafting vocation and all new artwork is deployable", () => {
  assert.deepEqual(getCraftingRule(VocationalActionType.ALCHEMY), {
    label: "Alchemy",
    catalogNoun: "reagents",
    allowsLearnedRecipes: false,
  });

  const newHerbs = GATHERING_ITEMS.filter((item) =>
    Object.hasOwn(ALCHEMY_HERB_TYPES, item.name),
  );
  const assets = [...ALCHEMY_ITEMS, ...newHerbs];
  assert.equal(assets.length, 13);
  assert.equal(new Set(assets.map((item) => item.sprite)).size, assets.length);

  for (const item of assets) {
    const png = readFileSync(
      new URL(`../public${item.sprite}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[24], 8);
    assert.equal(png[25], 6, `${item.name} must be transparent RGBA`);
  }
});
