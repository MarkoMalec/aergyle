import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  TAILORING_BLUEPRINTS,
  TAILORING_GATHERING_POOLS,
  TAILORING_GEAR,
  TAILORING_ITEMS,
  TAILORING_MATERIALS,
  TAILORING_TEXTILES,
  tailoringItemCreateData,
  tailoringRequirementsForGear,
} from "../prisma/content/tailoring";
import {
  ItemEquipTo,
  ItemRarity,
  ItemType,
  StatType,
  VocationalActionType,
} from "../src/generated/prisma/enums";
import {
  bakeLegacyRarity,
  legacyRarityStat,
} from "../prisma/content/legacyRarity";
import { getCraftingCategory, getCraftingRule } from "../src/game/crafting";
import {
  SHIPPED_SKILL_ITEM_RULES,
  shippedCraftConflict,
} from "./shippedSkillItemRules";
import { grantStackableItemToInventory } from "../src/server/items/grantItem";
import { resolveEffectiveItemStats } from "../src/utils/itemInstanceStats";
import { toVocationalActionTypeFromSkillName } from "../src/utils/vocations";

void test("Tailoring ships four blueprint-gated gathering armor crafts", () => {
  assert.equal(TAILORING_GEAR.length, 4);
  assert.equal(TAILORING_BLUEPRINTS.length, 4);
  assert.deepEqual(
    new Set(TAILORING_GEAR.map((gear) => gear.equipTo)),
    new Set(["gloves", "boots", "greaves", "chest"]),
  );

  const blueprintByOutput = new Map(
    TAILORING_BLUEPRINTS.map((blueprint) => [
      blueprint.requiredForItemName,
      blueprint.name,
    ]),
  );
  assert.ok(
    TAILORING_BLUEPRINTS.every(
      (blueprint) => blueprint.itemType === "BLUEPRINT",
    ),
  );
  for (const gear of TAILORING_GEAR) {
    assert.equal(gear.requiredBlueprintName, blueprintByOutput.get(gear.name));
    const requirements = tailoringRequirementsForGear(gear);
    assert.equal(requirements[0]?.itemName, gear.requiredBlueprintName);
    assert.equal(requirements[0]?.quantityPerUnit, 1);
    assert.ok(requirements.length > 1);
    assert.ok((gear.stats.GATHERING_EFFICIENCY ?? 0) > 0);
    assert.equal(tailoringItemCreateData(gear).stackable, false);
  }
});

void test("Tailoring inputs are obtainable and higher textiles form a craft chain", () => {
  const gatheringMaterialNames = new Set<string>(
    TAILORING_MATERIALS.filter(
      (material) => material.acquisition === "GATHERING",
    ).map((material) => material.name),
  );
  const materialNames = new Set<string>(
    TAILORING_MATERIALS.map((material) => material.name),
  );
  const textileNames = new Set<string>(
    TAILORING_TEXTILES.map((textile) => textile.name),
  );
  const gatheredNames = new Set(
    TAILORING_GATHERING_POOLS.flatMap((pool) =>
      pool.resources.map((resource) => resource.itemName),
    ),
  );

  assert.deepEqual(gatheredNames, gatheringMaterialNames);
  assert.deepEqual(
    TAILORING_MATERIALS.filter(
      (material) => material.acquisition === "IMPORT",
    ).map((material) => material.name),
    ["Silk Bolt"],
  );
  assert.deepEqual(
    TAILORING_TEXTILES.find((textile) => textile.name === "Linen Cloth")
      ?.requirements,
    [{ itemName: "Flax Fiber", quantityPerUnit: 3 }],
  );
  for (const gear of TAILORING_GEAR) {
    for (const requirement of gear.requirements) {
      assert.ok(
        materialNames.has(requirement.itemName) ||
          textileNames.has(requirement.itemName),
      );
      assert.ok(requirement.quantityPerUnit > 0);
    }
  }

  for (const textile of TAILORING_TEXTILES) {
    assert.ok(textile.requiredSkillLevel > 0);
    assert.ok(textile.requirements.length > 0);
    for (const requirement of textile.requirements) {
      assert.ok(
        materialNames.has(requirement.itemName) ||
          textileNames.has(requirement.itemName),
      );
      assert.notEqual(requirement.itemName, textile.name);
      assert.ok(requirement.quantityPerUnit > 0);
    }
  }
});

void test("crafting rules make profession ownership explicit", () => {
  const tailoring = SHIPPED_SKILL_ITEM_RULES.TAILORING;
  const blacksmithing = SHIPPED_SKILL_ITEM_RULES.BLACKSMITHING;
  const weaponsmithing = SHIPPED_SKILL_ITEM_RULES.WEAPONSMITHING;
  const carpentry = SHIPPED_SKILL_ITEM_RULES.CARPENTRY;
  assert.ok(tailoring);
  assert.ok(blacksmithing);
  assert.ok(weaponsmithing);
  assert.ok(carpentry);
  assert.ok(tailoring.outputTypes.includes(ItemType.CHESTPLATE));
  assert.ok(tailoring.inputTypes.includes(ItemType.MATERIAL));
  assert.ok(tailoring.inputTypes.includes(ItemType.HIDE));
  assert.ok(tailoring.inputTypes.includes(ItemType.BLUEPRINT));
  assert.equal(
    getCraftingRule(VocationalActionType.TAILORING)?.allowsLearnedRecipes,
    false,
  );
  assert.ok(blacksmithing.outputTypes.includes(ItemType.INGOT));
  assert.ok(blacksmithing.outputTypes.includes(ItemType.CHESTPLATE));
  assert.ok(blacksmithing.outputTypes.includes(ItemType.MATERIAL));
  assert.ok(blacksmithing.outputTypes.includes(ItemType.PICKAXE));
  assert.ok(blacksmithing.outputTypes.includes(ItemType.OTHER));
  assert.ok(weaponsmithing.outputTypes.includes(ItemType.SWORD));
  assert.ok(weaponsmithing.outputTypes.includes(ItemType.SPEAR));
  assert.ok(weaponsmithing.inputTypes.includes(ItemType.MATERIAL));
  assert.ok(carpentry.outputTypes.includes(ItemType.BOW));
  assert.ok(carpentry.outputTypes.includes(ItemType.MATERIAL));
  assert.ok(carpentry.inputTypes.includes(ItemType.LOG));
  assert.equal(
    toVocationalActionTypeFromSkillName("Blacksmithing"),
    VocationalActionType.BLACKSMITHING,
  );
  assert.equal(
    toVocationalActionTypeFromSkillName("Weaponsmithing"),
    VocationalActionType.WEAPONSMITHING,
  );
  assert.equal(
    toVocationalActionTypeFromSkillName("Carpentry"),
    VocationalActionType.CARPENTRY,
  );
  assert.equal(toVocationalActionTypeFromSkillName("Smelting"), null);
  assert.equal(getCraftingCategory(ItemType.GLOVES).label, "Gloves");
  assert.equal(getCraftingCategory(ItemType.MACE).label, "Maces");
  assert.equal(
    getCraftingRule(VocationalActionType.BLACKSMITHING)?.catalogNoun,
    "metalwork",
  );

  assert.equal(
    shippedCraftConflict({
      actionType: VocationalActionType.TAILORING,
      outputType: ItemType.GLOVES,
      inputTypes: [ItemType.BLUEPRINT, ItemType.MATERIAL, ItemType.HIDE],
    }),
    null,
  );
  assert.match(
    shippedCraftConflict({
      actionType: VocationalActionType.TAILORING,
      outputType: ItemType.FOOD,
      inputTypes: [ItemType.MATERIAL],
    }) ?? "",
    /Tailoring can't output FOOD/,
  );

  assert.equal(
    shippedCraftConflict({
      actionType: VocationalActionType.WEAPONSMITHING,
      outputType: ItemType.SWORD,
      inputTypes: [ItemType.INGOT, ItemType.MATERIAL],
    }),
    null,
  );
  assert.equal(
    shippedCraftConflict({
      actionType: VocationalActionType.CARPENTRY,
      outputType: ItemType.BOW,
      inputTypes: [ItemType.LOG, ItemType.MATERIAL],
    }),
    null,
  );
});

void test("content stats are baked by their old rarity multiplier exactly once", () => {
  const item = { rarity: ItemRarity.RARE, equipTo: ItemEquipTo.weapon };
  assert.equal(legacyRarityStat(StatType.LUCK, 2, item), 2.3);
  // A weapon's attack speed never scaled with rarity, and caps still hold.
  assert.equal(legacyRarityStat(StatType.ATTACK_SPEED, 1.1, item), 1.1);
  assert.equal(legacyRarityStat(StatType.CRITICAL_CHANCE, 4, item, 4.5), 4.5);

  const [baked] = bakeLegacyRarity([
    { rarity: ItemRarity.EPIC, equipTo: ItemEquipTo.chest, stats: { ARMOR: 10 } },
  ]);
  assert.deepEqual(baked?.stats, { ARMOR: 12.5 });
  // The game then uses them as they are: rarity no longer scales anything.
  assert.deepEqual(
    resolveEffectiveItemStats({
      stats: [{ statType: StatType.ARMOR, value: 12.5 }],
    }),
    [{ statType: StatType.ARMOR, value: 12.5 }],
  );
});

void test("the production grant path does not snapshot shared balance stats", async () => {
  let persistedModifiers: Array<{ statType: StatType; value: number }> = [];

  const db = {
    $queryRaw: async () => [{ slots: [], maxSlots: 1, deleteSlotId: null }],
    item: {
      findUnique: async () => ({
        stackable: false,
        maxStackSize: 1,
      }),
    },
    inventory: {
      findUnique: async () => ({ maxSlots: 1, slots: [] }),
      update: async () => ({}),
    },
    userItem: {
      findMany: async () => [],
      update: async () => ({}),
      create: async ({
        data,
      }: {
        data: {
          statModifiers?: {
            create: Array<{ statType: StatType; value: number }>;
          };
        };
      }) => {
        persistedModifiers = data.statModifiers?.create ?? [];
        return { id: 501 };
      },
    },
  };

  const result = await grantStackableItemToInventory({
    db: db as never,
    userId: "tailor-test",
    itemId: 42,
    quantity: 1,
  });

  assert.equal(result.addedQuantity, 1);
  assert.equal(result.remainingQuantity, 0);
  assert.deepEqual(persistedModifiers, []);
});

void test("Tailoring runtime artwork is compact 256px RGBA PNG", () => {
  assert.equal(new Set(TAILORING_ITEMS.map((item) => item.sprite)).size, 20);
  for (const spritePath of TAILORING_ITEMS.map((item) => item.sprite)) {
    const png = readFileSync(
      new URL(`../public${spritePath}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[24], 8);
    assert.equal(png[25], 6);
    assert.ok(png.length < 130_000, `${spritePath} is not optimized`);
  }
});
