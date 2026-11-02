import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { ATLAS_EQUIPMENT } from "../prisma/content/atlasEquipment";
import {
  CRAFTED_WEAPON_DEPENDENCY_TYPES,
  CRAFTED_WEAPON_SKILL_OUTPUTS,
  CRAFTED_WEAPONS,
  EXISTING_WEAPON_CRAFTS,
  craftedWeaponCreateData,
  type CraftedWeaponDefinition,
  type ExistingWeaponCraftDefinition,
} from "../prisma/content/craftedWeapons";
import type {
  ItemRarity,
  ItemType,
  StatType,
} from "../src/generated/prisma/enums";
import {
  budgetItemStats,
  REFERENCE_RARITY_MULTIPLIER,
  TWO_HANDED_FACTOR,
  weaponBudget,
  type BudgetContext,
} from "../src/game/balance/budget";
import {
  getResourceSkillConflict,
  type SkillItemRules,
} from "../src/game/crafting";
import { DEFAULT_COMBAT_CONFIG } from "../src/server/combat/rules";
import { getDefaultStatGrowthRules } from "../src/utils/stats";
import { SHIPPED_SKILL_ITEM_RULES } from "./shippedSkillItemRules";

const WEAPONS: readonly CraftedWeaponDefinition[] = CRAFTED_WEAPONS;
const EXISTING: readonly ExistingWeaponCraftDefinition[] =
  EXISTING_WEAPON_CRAFTS;
const ALL_CRAFTS = [
  ...WEAPONS.map((item) => ({ itemName: item.name, ...item })),
  ...EXISTING,
];

const ctx: BudgetContext = {
  combat: DEFAULT_COMBAT_CONFIG,
  growth: getDefaultStatGrowthRules(),
};

const stat = (item: CraftedWeaponDefinition, statType: StatType) =>
  item.stats.find((entry) => entry.statType === statType)?.value ?? 0;

/** Average damage per round of a Common-equivalent template. */
function damagePerRound(item: {
  stats: readonly { statType: StatType; value: number }[];
}) {
  const get = (statType: StatType) =>
    item.stats.find((entry) => entry.statType === statType)?.value ?? 0;
  const average =
    (get("PHYSICAL_DAMAGE_MIN") +
      get("PHYSICAL_DAMAGE_MAX") +
      get("MAGIC_DAMAGE_MIN") +
      get("MAGIC_DAMAGE_MAX")) /
    2;
  return average * get("ATTACK_SPEED");
}

const RARITY_MULTIPLIER: Partial<Record<ItemRarity, number>> = {
  COMMON: 1,
  UNCOMMON: 1.1,
};

void test("every categorized weapon sprite is in the catalog exactly once", () => {
  const root = new URL("../public/assets/items/weapons/", import.meta.url);
  const categorized = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(new URL(`${dir.name}/`, root))
        .filter((file) => file.endsWith(".png"))
        .map((file) => `/assets/items/weapons/${dir.name}/${file}`),
    );
  // Already in the game before this pack.
  const existing = new Set([
    "/assets/items/weapons/swords/tin-sword.png",
    "/assets/items/weapons/swords/ogre-cleaver-atlas-v2.png",
    "/assets/items/weapons/shields/buckler-v1.png",
    "/assets/items/weapons/greataxes/bearded-greataxe-v1.png",
  ]);
  const packSprites = WEAPONS.map((item) => item.sprite);

  assert.equal(WEAPONS.length, 53);
  assert.equal(new Set(packSprites).size, WEAPONS.length);
  assert.equal(new Set(WEAPONS.map((item) => item.name)).size, WEAPONS.length);
  assert.deepEqual(
    new Set(packSprites),
    new Set(categorized.filter((sprite) => !existing.has(sprite))),
  );

  for (const item of WEAPONS) {
    const png = readFileSync(
      new URL(`../public${item.sprite}`, import.meta.url),
    );
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 256, item.name);
    assert.equal(png.readUInt32BE(20), 256, item.name);
    assert.equal(png[25], 6, `${item.name} needs RGB plus alpha`);
    assert.ok(png.length < 150_000, item.name);
  }
});

void test("stats are the on-level gear budget for the weapon's type", () => {
  const secondary: Partial<Record<ItemType, StatType[]>> = {
    SWORD: ["ACCURACY", "CRITICAL_CHANCE"],
    DAGGER: ["CRITICAL_CHANCE"],
    AXE: ["CRITICAL_DAMAGE"],
    GREATAXE: ["CRITICAL_DAMAGE"],
    MACE: ["ARMOR"],
    FLAIL: ["CRITICAL_CHANCE", "CRITICAL_DAMAGE"],
    SPEAR: ["EVASION_MELEE"],
    BOW: ["ACCURACY", "CRITICAL_CHANCE"],
    CROSSBOW: ["CRITICAL_DAMAGE"],
    STAFF: ["CRITICAL_CHANCE"],
    WAND: ["CRITICAL_DAMAGE"],
    SHIELD: ["HEALTH"],
  };
  for (const item of WEAPONS) {
    const weights = Object.fromEntries(
      secondary[item.itemType]!.map((statType) => [statType, 1]),
    );
    const expected = budgetItemStats(
      {
        level: item.requiredLevel,
        equipTo: item.equipTo,
        itemType: item.itemType,
        twoHanded: item.twoHanded ?? false,
        attackSpeed: stat(item, "ATTACK_SPEED") || undefined,
        stats: weights,
      },
      ctx,
    );
    // Health follows the live CharacterStatGrowth rows, which /admin can
    // change; the generator used them, so only its presence is checked here.
    const comparable = (
      stats: readonly {
        statType: StatType;
        value: number;
        maxValue?: number | null;
      }[],
    ) =>
      stats
        .filter((entry) => entry.statType !== "HEALTH")
        .map((entry) => ({ maxValue: null, ...entry }));
    assert.deepEqual(comparable(item.stats), comparable(expected), item.name);
    assert.equal(
      stat(item, "HEALTH") > 0,
      expected.some((entry) => entry.statType === "HEALTH"),
      item.name,
    );
  }
});

void test("crafted weapons stay below on-level Rare drops and the Ogre Cleaver", () => {
  const ogreCleaver = ATLAS_EQUIPMENT.find(
    (item) => item.name === "Ogre Cleaver",
  )!;
  const ogre = damagePerRound({
    stats: Object.entries(ogreCleaver.stats).map(([statType, value]) => ({
      statType: statType as StatType,
      value,
    })),
  });

  for (const item of WEAPONS) {
    assert.ok(item.requiredLevel <= 80, `${item.name} is beginner gear`);
    assert.ok(
      item.rarity in RARITY_MULTIPLIER,
      `${item.name} is Common or Uncommon`,
    );
    assert.equal(item.rarity, item.requiredLevel >= 40 ? "UNCOMMON" : "COMMON");
    if (item.equipTo !== "weapon") continue;

    const crafted = damagePerRound(item) * RARITY_MULTIPLIER[item.rarity]!;
    const hands = item.twoHanded ? TWO_HANDED_FACTOR : 1;
    const rareDrop =
      weaponBudget(item.requiredLevel) * hands * REFERENCE_RARITY_MULTIPLIER;
    assert.ok(crafted < 0.85 * rareDrop, `${item.name} vs an on-level Rare`);
    assert.ok(crafted < 0.7 * ogre * REFERENCE_RARITY_MULTIPLIER, item.name);
  }
});

void test("each profession makes its own weapons, at the level they are worn", () => {
  const skillFor = (itemType: ItemType) =>
    itemType === "SHIELD"
      ? "BLACKSMITHING"
      : ["BOW", "CROSSBOW", "STAFF", "WAND"].includes(itemType)
        ? "CARPENTRY"
        : "WEAPONSMITHING";

  const rules: SkillItemRules = structuredClone(SHIPPED_SKILL_ITEM_RULES);
  for (const [skill, outputs] of Object.entries(CRAFTED_WEAPON_SKILL_OUTPUTS)) {
    rules[skill as keyof SkillItemRules]!.outputTypes.push(...outputs);
  }

  for (const craft of ALL_CRAFTS) {
    assert.equal(
      craft.craft.actionType,
      skillFor(craft.itemType),
      craft.itemName,
    );
    assert.equal(
      getResourceSkillConflict({
        actionType: craft.craft.actionType,
        outputType: craft.itemType,
        requirementTypes: craft.craft.requirements.map(
          (requirement) =>
            CRAFTED_WEAPON_DEPENDENCY_TYPES[
              requirement.itemName as keyof typeof CRAFTED_WEAPON_DEPENDENCY_TYPES
            ],
        ),
        hasRecipeGate: false,
        itemRules: rules,
      }),
      null,
      `${craft.itemName} must fit the ${craft.craft.actionType} rules`,
    );
  }
  for (const item of WEAPONS) {
    assert.equal(item.craft.requiredSkillLevel, item.requiredLevel, item.name);
  }

  // Every profession has an entry recipe. Weaponsmithing had none below
  // level 65, so this ladder is its whole early progression: no long gaps.
  const levels = (skill: string) =>
    ALL_CRAFTS.filter((craft) => craft.craft.actionType === skill)
      .map((craft) => craft.craft.requiredSkillLevel)
      .sort((a, b) => a - b);
  for (const skill of ["WEAPONSMITHING", "CARPENTRY", "BLACKSMITHING"]) {
    assert.ok(levels(skill)[0]! <= 2, `${skill} starts at ${levels(skill)[0]}`);
  }
  const weaponsmithing = levels("WEAPONSMITHING");
  for (let index = 1; index < weaponsmithing.length; index++) {
    assert.ok(
      weaponsmithing[index]! - weaponsmithing[index - 1]! <= 6,
      `Weaponsmithing gap at ${weaponsmithing[index]}`,
    );
  }
});

void test("no recipe needs a material that unlocks after it", () => {
  // The earliest character level each material can be produced at: its
  // skill level and the location level of its source.
  const unlocks: Record<keyof typeof CRAFTED_WEAPON_DEPENDENCY_TYPES, number> =
    {
      "Copper Ingot": 5,
      "Iron Ingot": 5,
      "Bronze Ingot": 10,
      "Steel Ingot": 40,
      "Oak Plank": 1,
      "Birch Plank": 1,
      "Pine Plank": 1,
      "Willow Plank": 10,
      "Ash Plank": 40,
      "Frostpine Plank": 50,
      "Wooden Handle": 1,
      "Raw Hide": 3,
      "Small Bones": 1,
      "Hardened Leather": 40,
      "Animal Sinew": 8,
      "Stag Antler": 12,
      "Curved Horn": 50,
      "Tempering Resin": 40,
    };
  for (const { itemName, craft } of ALL_CRAFTS) {
    for (const { itemName: material } of craft.requirements) {
      const unlock = unlocks[material as keyof typeof unlocks];
      // Copper and iron ore need Mining 5, like the level 1 ingot recipes.
      const slack = unlock === 5 ? 4 : 0;
      assert.ok(
        unlock <= craft.requiredSkillLevel + slack,
        `${itemName} (${craft.requiredSkillLevel}) needs ${material} (${unlock})`,
      );
    }
  }
});

void test("recipes are distinct and pay crafting XP at the usual rate", () => {
  const signatures = ALL_CRAFTS.map((craft) =>
    craft.craft.requirements
      .map((requirement) => requirement.itemName)
      .sort()
      .join("+"),
  );
  assert.equal(
    new Set(signatures).size,
    signatures.length,
    "identical ingredients",
  );

  for (const { itemName, craft } of ALL_CRAFTS) {
    const xpPerHour = (craft.xpPerUnit * 3_600) / craft.defaultSeconds;
    const target = 1_000 + 13 * craft.requiredSkillLevel;
    assert.ok(
      Math.abs(xpPerHour / target - 1) < 0.1,
      `${itemName}: ${xpPerHour} XP/h`,
    );
    assert.ok(
      craft.requirements.every(
        (requirement) => requirement.quantityPerUnit >= 1,
      ),
    );
  }
});

void test("templates keep base values and index their damage and armor", () => {
  for (const item of WEAPONS) {
    const data = craftedWeaponCreateData(item);
    assert.equal(data.rarity, item.rarity);
    assert.equal(data.twoHanded, item.twoHanded ?? false);
    assert.equal(data.stackable, false);
    assert.equal(data.minPhysicalDamage, stat(item, "PHYSICAL_DAMAGE_MIN"));
    assert.equal(data.maxPhysicalDamage, stat(item, "PHYSICAL_DAMAGE_MAX"));
    assert.equal(data.minMagicDamage, stat(item, "MAGIC_DAMAGE_MIN"));
    assert.equal(data.maxMagicDamage, stat(item, "MAGIC_DAMAGE_MAX"));
    assert.equal(data.armor, stat(item, "ARMOR"));
    assert.deepEqual(
      data.stats?.create,
      item.stats.map((entry) => ({ maxValue: null, ...entry })),
    );
    assert.ok(item.price > 0 && item.description.length > 20, item.name);
  }
});
