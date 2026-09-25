import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  ARMOR_SET_BLUEPRINTS,
  ARMOR_SET_COMPONENTS,
  ARMOR_SET_EXISTING_DEPENDENCY_TYPES,
  ARMOR_SET_GARDEN_SEED,
  ARMOR_SET_GATHERING_MATERIALS,
  ARMOR_SET_GEAR,
  ARMOR_SET_ITEMS,
  armorSetItemCreateData,
  armorSetRequirementsForCraft,
} from "../prisma/content/armorSets";
import { ItemType, VocationalActionType } from "../src/generated/prisma/enums";
import { getCraftingRule } from "../src/game/crafting";
import {
  SHIPPED_SKILL_ITEM_RULES,
  shippedCraftConflict,
} from "./shippedSkillItemRules";

const EXPECTED_SLOTS = new Set([
  "head",
  "chest",
  "pauldrons",
  "bracers",
  "gloves",
  "greaves",
  "boots",
  "belt",
]);

void test("four complete armor sets have one physical blueprint per slot", () => {
  const setPrefixes = ["Mossweave", "Ironbark", "Frostsilver", "Cinderweave"];
  assert.equal(ARMOR_SET_GEAR.length, 32);
  assert.equal(ARMOR_SET_BLUEPRINTS.length, 32);

  const blueprintByGear = new Map(
    ARMOR_SET_BLUEPRINTS.map((blueprint) => [
      blueprint.requiredForItemName,
      blueprint.name,
    ]),
  );
  for (const prefix of setPrefixes) {
    const set = ARMOR_SET_GEAR.filter((gear) => gear.name.startsWith(prefix));
    assert.equal(set.length, 8, prefix + " must be a full eight-slot set");
    assert.deepEqual(
      new Set(set.map((gear) => gear.equipTo)),
      EXPECTED_SLOTS,
      prefix + " must fill every armor slot",
    );
    for (const gear of set) {
      assert.equal(blueprintByGear.get(gear.name), gear.requiredBlueprintName);
      assert.deepEqual(armorSetRequirementsForCraft(gear)[0], {
        itemName: gear.requiredBlueprintName,
        quantityPerUnit: 1,
      });
    }
  }
});

void test("armor production has meaningful cross-vocation chains", () => {
  assert.deepEqual(
    new Set(ARMOR_SET_COMPONENTS.map((component) => component.actionType)),
    new Set([
      "ALCHEMY",
      "BLACKSMITHING",
      "CARPENTRY",
      "TAILORING",
      "WEAPONSMITHING",
    ]),
  );
  assert.deepEqual(
    ARMOR_SET_GATHERING_MATERIALS.map((material) => material.name),
    ["Cinder Fiber"],
  );
  assert.equal(ARMOR_SET_GARDEN_SEED.seedYieldItemName, "Emberbloom");

  const components = new Map(
    ARMOR_SET_COMPONENTS.map((component) => [component.name, component]),
  );
  assert.deepEqual(
    components.get("Mossweave Bolt")?.requirements.map((item) => item.itemName),
    ["Cloth Scraps", "Spider Silk", "Animal Sinew", "Verdant Dye"],
  );
  assert.deepEqual(
    components
      .get("Ironbark Lamella")
      ?.requirements.map((item) => item.itemName),
    ["Oak Plank", "Hardened Leather", "Iron Ingot", "Tempering Resin"],
  );
  assert.deepEqual(
    components
      .get("Frostscale Leather")
      ?.requirements.map((item) => item.itemName),
    ["Frostscale Char", "Thick Fur", "Winter Tannin"],
  );
  assert.deepEqual(
    components
      .get("Frostsilver Wire")
      ?.requirements.map((item) => item.itemName),
    ["Frostsilver Ingot", "Animal Sinew", "Dusk Oil"],
  );
  assert.deepEqual(
    components
      .get("Cindercloth Bolt")
      ?.requirements.map((item) => item.itemName),
    ["Cinder Fiber", "Spider Silk", "Cinder Dye", "Doomsteel Links"],
  );

  assert.equal(ARMOR_SET_EXISTING_DEPENDENCY_TYPES["Frostscale Char"], "FISH");
  assert.equal(ARMOR_SET_EXISTING_DEPENDENCY_TYPES["Emberwood Log"], "LOG");
  assert.equal(ARMOR_SET_EXISTING_DEPENDENCY_TYPES["Doomsteel Ingot"], "INGOT");
});

void test("the crafting registry admits every authored armor recipe", () => {
  const itemTypes = new Map<string, ItemType>(
    ARMOR_SET_ITEMS.map((item) => [item.name, item.itemType]),
  );
  for (const [name, itemType] of Object.entries(
    ARMOR_SET_EXISTING_DEPENDENCY_TYPES,
  )) {
    itemTypes.set(name, itemType);
  }

  for (const craft of [...ARMOR_SET_COMPONENTS, ...ARMOR_SET_GEAR]) {
    const rule = getCraftingRule(craft.actionType as VocationalActionType);
    assert.ok(rule, craft.name + " needs a crafting rule");
    assert.equal(
      shippedCraftConflict({
        actionType: craft.actionType as VocationalActionType,
        outputType: craft.itemType,
        inputTypes: armorSetRequirementsForCraft(craft).map((requirement) =>
          itemTypes.get(requirement.itemName),
        ),
      }),
      null,
      craft.name + " must fit the " + craft.actionType + " contract",
    );
  }

  assert.ok(
    SHIPPED_SKILL_ITEM_RULES.CARPENTRY?.outputTypes.includes(
      ItemType.CHESTPLATE,
    ),
  );
  assert.ok(
    SHIPPED_SKILL_ITEM_RULES.TAILORING?.inputTypes.includes(ItemType.FISH),
  );
  assert.ok(
    SHIPPED_SKILL_ITEM_RULES.WEAPONSMITHING?.outputTypes.includes(
      ItemType.MATERIAL,
    ),
  );
});

void test("armor item templates preserve their base armor and non-stackable equipment state", () => {
  for (const gear of ARMOR_SET_GEAR) {
    const data = armorSetItemCreateData(gear);
    assert.equal(data.stackable, false);
    assert.equal(data.maxStackSize, 1);
    assert.equal(data.armor, gear.stats.ARMOR);
    assert.equal(data.requiredLevel, gear.requiredLevel);
    assert.ok((gear.stats.ARMOR ?? 0) > 0);
  }
  for (const component of ARMOR_SET_COMPONENTS) {
    const data = armorSetItemCreateData(component);
    assert.equal(data.stackable, true);
    assert.equal(data.maxStackSize, 9_999);
    assert.equal(data.armor, 0);
  }
});

void test("armor set runtime artwork is compact 256px RGBA PNG", () => {
  assert.equal(new Set(ARMOR_SET_ITEMS.map((item) => item.sprite)).size, 77);
  for (const spritePath of ARMOR_SET_ITEMS.map((item) => item.sprite)) {
    const png = readFileSync(
      new URL("../public" + spritePath, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[24], 8);
    assert.equal(png[25], 6);
    assert.ok(png.length < 130_000, spritePath + " is not optimized");
  }
});
