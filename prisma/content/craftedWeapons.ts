import type { Prisma } from "../../src/generated/prisma/client";
import type {
  ItemEquipTo,
  ItemRarity,
  ItemType,
  StatType,
  VocationalActionType,
} from "../../src/generated/prisma/enums";
import { bakeLegacyRarity } from "./legacyRarity";

/**
 * Crafted weapons pack: the beginner weapons in public/assets/items/weapons/
 * <type>/ (character levels 1-72), each made by the matching profession.
 * Weaponsmithing forges melee weapons, Carpentry makes bows, crossbows,
 * staves and wands, and Blacksmithing makes shields.
 *
 * Stats are the gear budget for the item's level (budgetItemStats in
 * src/game/balance/budget.ts) at COMMON-equivalent values, so each weapon is
 * an on-level item. Crafts produce Common (up to level 38) or Uncommon
 * (level 42 and up) copies, which keeps them below on-level Rare and Epic
 * drops. The craft level equals the level needed to equip the result, and
 * every material can be gathered by the time its recipe unlocks. Rationale
 * and the full ladder: docs/CRAFTED_WEAPONS.md.
 */

export type WeaponCraftSkill = Extract<
  VocationalActionType,
  "WEAPONSMITHING" | "CARPENTRY" | "BLACKSMITHING"
>;

export interface WeaponCraftDefinition {
  actionType: WeaponCraftSkill;
  requiredSkillLevel: number;
  defaultSeconds: number;
  xpPerUnit: number;
  requirements: readonly {
    itemName: string;
    quantityPerUnit: number;
  }[];
}

export interface CraftedWeaponStat {
  statType: StatType;
  /** COMMON-equivalent; instance creation applies rarity once. */
  value: number;
  /** Percentage stats: the most rarity can raise them to. */
  maxValue?: number;
}

export interface CraftedWeaponDefinition {
  name: string;
  description: string;
  sprite: string;
  itemType: ItemType;
  equipTo: Extract<ItemEquipTo, "weapon" | "offhand">;
  twoHanded?: boolean;
  rarity: ItemRarity;
  requiredLevel: number;
  price: number;
  stats: readonly CraftedWeaponStat[];
  craft: WeaponCraftDefinition;
}

export interface ExistingWeaponCraftDefinition {
  itemName: string;
  itemType: ItemType;
  rarity: ItemRarity;
  craft: WeaponCraftDefinition;
}

/** Existing materials the recipes use, with the item type each must have. */
export const CRAFTED_WEAPON_DEPENDENCY_TYPES = {
  "Copper Ingot": "INGOT",
  "Bronze Ingot": "INGOT",
  "Iron Ingot": "INGOT",
  "Steel Ingot": "INGOT",
  "Oak Plank": "MATERIAL",
  "Birch Plank": "MATERIAL",
  "Pine Plank": "MATERIAL",
  "Willow Plank": "MATERIAL",
  "Ash Plank": "MATERIAL",
  "Frostpine Plank": "MATERIAL",
  "Wooden Handle": "MATERIAL",
  "Raw Hide": "HIDE",
  "Small Bones": "MATERIAL",
  "Hardened Leather": "HIDE",
  "Animal Sinew": "MATERIAL",
  "Stag Antler": "MATERIAL",
  "Curved Horn": "MATERIAL",
  "Tempering Resin": "MATERIAL",
} as const satisfies Readonly<Record<string, ItemType>>;

/**
 * Item types a skill must be allowed to output for this pack. The shipped
 * rules give no skill staves or wands; the seeder adds them to Carpentry's
 * rule on /admin/vocations/rules and leaves every other entry as it is.
 */
export const CRAFTED_WEAPON_SKILL_OUTPUTS = {
  CARPENTRY: ["STAFF", "WAND"],
} as const satisfies Partial<Record<WeaponCraftSkill, readonly ItemType[]>>;

export const CRAFTED_WEAPONS = bakeLegacyRarity([
  {
    name: "Copper Longsword",
    description:
      "A long copper blade on a plain oak grip. It dents easily, but it gives a new fighter real reach.",
    sprite: "/assets/items/weapons/swords/copper-longsword-v1.png",
    itemType: "SWORD",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 6,
    price: 50,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 10 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 16 },
      { statType: "ATTACK_SPEED", value: 1 },
      { statType: "ACCURACY", value: 2 },
      { statType: "CRITICAL_CHANCE", value: 2.3, maxValue: 4.6 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 6,
      defaultSeconds: 40,
      xpPerUnit: 12,
      requirements: [
        { itemName: "Copper Ingot", quantityPerUnit: 3 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Militia Sword",
    description:
      "The bronze sidearm issued to town levies: short, sturdy and easy to keep sharp.",
    sprite: "/assets/items/weapons/swords/militia-sword-v1.png",
    itemType: "SWORD",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 12,
    price: 85,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 16 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 27 },
      { statType: "ATTACK_SPEED", value: 1 },
      { statType: "ACCURACY", value: 3 },
      { statType: "CRITICAL_CHANCE", value: 2.4, maxValue: 4.8 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 12,
      defaultSeconds: 50,
      xpPerUnit: 16,
      requirements: [
        { itemName: "Bronze Ingot", quantityPerUnit: 2 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Guard Sword",
    description:
      "An iron arming sword with a bronze-capped guard, standard issue for the Citadel's gate wardens.",
    sprite: "/assets/items/weapons/swords/guard-sword-v1.png",
    itemType: "SWORD",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 24,
    price: 60,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 29 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 48 },
      { statType: "ATTACK_SPEED", value: 1 },
      { statType: "ACCURACY", value: 5 },
      { statType: "CRITICAL_CHANCE", value: 2.5, maxValue: 5 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 24,
      defaultSeconds: 75,
      xpPerUnit: 27,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 4 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Iron Falchion",
    description:
      "A heavy single-edged iron blade that widens toward the tip, its hide-wrapped grip set behind a bronze guard.",
    sprite: "/assets/items/weapons/swords/iron-falchion-v1.png",
    itemType: "SWORD",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 34,
    price: 65,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 39 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 65 },
      { statType: "ATTACK_SPEED", value: 1 },
      { statType: "ACCURACY", value: 6 },
      { statType: "CRITICAL_CHANCE", value: 2.6, maxValue: 5.2 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 34,
      defaultSeconds: 90,
      xpPerUnit: 36,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 6 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Steel Bastard Sword",
    description:
      "A hand-and-a-half steel blade with a brass guard and a long leather grip. Slower than an arming sword, but it carries real weight in both hands.",
    sprite: "/assets/items/weapons/swords/steel-bastard-sword-v1.png",
    itemType: "SWORD",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "UNCOMMON",
    requiredLevel: 60,
    price: 440,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 102 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 169 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "ACCURACY", value: 13 },
      { statType: "CRITICAL_CHANCE", value: 3.8, maxValue: 7.6 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 60,
      defaultSeconds: 180,
      xpPerUnit: 89,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 7 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Hardened Leather", quantityPerUnit: 2 },
        { itemName: "Tempering Resin", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Hand Axe",
    description:
      "A small iron head wedged onto a birch haft. As useful for kindling as it is in a scrap.",
    sprite: "/assets/items/weapons/axes/hand-axe-v1.png",
    itemType: "AXE",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 3,
    price: 10,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 7 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 13 },
      { statType: "ATTACK_SPEED", value: 0.9 },
      { statType: "CRITICAL_DAMAGE", value: 12 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 3,
      defaultSeconds: 35,
      xpPerUnit: 10,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 2 },
        { itemName: "Birch Plank", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Iron Hand Axe",
    description:
      "A double-bitted iron hatchet lashed with sinew, balanced for quick chopping strokes.",
    sprite: "/assets/items/weapons/axes/iron-hand-axe-v1.png",
    itemType: "AXE",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 20,
    price: 30,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 25 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 47 },
      { statType: "ATTACK_SPEED", value: 0.9 },
      { statType: "CRITICAL_DAMAGE", value: 14 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 20,
      defaultSeconds: 65,
      xpPerUnit: 23,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 4 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Bearded Axe",
    description:
      "The long lower edge of this iron head hooks shields and guards. Sinew lashing keeps it tight on the haft.",
    sprite: "/assets/items/weapons/axes/bearded-axe-v1.png",
    itemType: "AXE",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 32,
    price: 45,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 38 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 71 },
      { statType: "ATTACK_SPEED", value: 0.9 },
      { statType: "CRITICAL_DAMAGE", value: 14 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 32,
      defaultSeconds: 90,
      xpPerUnit: 35,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 5 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Steel Axe",
    description:
      "A forged steel head on an ash haft. It holds its edge through a long day of hard work.",
    sprite: "/assets/items/weapons/axes/steel-axe-v1.png",
    itemType: "AXE",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 46,
    price: 250,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 54 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 100 },
      { statType: "ATTACK_SPEED", value: 0.9 },
      { statType: "CRITICAL_DAMAGE", value: 15 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 46,
      defaultSeconds: 115,
      xpPerUnit: 51,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 4 },
        { itemName: "Ash Plank", quantityPerUnit: 1 },
        { itemName: "Hardened Leather", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Iron Greataxe",
    description:
      "Two broad iron blades on a long willow haft. Clumsy until it lands.",
    sprite: "/assets/items/weapons/greataxes/iron-greataxe-v1.png",
    itemType: "GREATAXE",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "COMMON",
    requiredLevel: 30,
    price: 65,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 74 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 100 },
      { statType: "ATTACK_SPEED", value: 0.7 },
      { statType: "CRITICAL_DAMAGE", value: 19 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 30,
      defaultSeconds: 110,
      xpPerUnit: 42,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 8 },
        { itemName: "Willow Plank", quantityPerUnit: 2 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Splitting Greataxe",
    description:
      "A steel greataxe with thick, wedge-shaped bits on a rawhide-wrapped ash haft, made to split timber and shields alike.",
    sprite: "/assets/items/weapons/greataxes/splitting-greataxe-v1.png",
    itemType: "GREATAXE",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "UNCOMMON",
    requiredLevel: 44,
    price: 280,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 105 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 141 },
      { statType: "ATTACK_SPEED", value: 0.7 },
      { statType: "CRITICAL_DAMAGE", value: 20 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 44,
      defaultSeconds: 140,
      xpPerUnit: 61,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 5 },
        { itemName: "Ash Plank", quantityPerUnit: 2 },
        { itemName: "Raw Hide", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Steel Greataxe",
    description:
      "Etched double steel bits on a frostpine haft: the heaviest axe an ordinary smithy can turn out.",
    sprite: "/assets/items/weapons/greataxes/steel-greataxe-v1.png",
    itemType: "GREATAXE",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "UNCOMMON",
    requiredLevel: 72,
    price: 670,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 166 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 225 },
      { statType: "ATTACK_SPEED", value: 0.7 },
      { statType: "CRITICAL_DAMAGE", value: 23 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 72,
      defaultSeconds: 205,
      xpPerUnit: 110,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 10 },
        { itemName: "Frostpine Plank", quantityPerUnit: 2 },
        { itemName: "Hardened Leather", quantityPerUnit: 2 },
        { itemName: "Tempering Resin", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Boot Dagger",
    description:
      "A short copper blade that rides in a boot top. Small, quick and easy to overlook.",
    sprite: "/assets/items/weapons/daggers/boot-dagger-v1.png",
    itemType: "DAGGER",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 1,
    price: 20,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 3.2 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 5 },
      { statType: "ATTACK_SPEED", value: 1.4 },
      { statType: "CRITICAL_CHANCE", value: 3, maxValue: 6 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 1,
      defaultSeconds: 30,
      xpPerUnit: 8,
      requirements: [
        { itemName: "Copper Ingot", quantityPerUnit: 1 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Guard Dagger",
    description:
      "A bronze parrying dagger with a bone grip and a wide crossguard for catching an opponent's blade.",
    sprite: "/assets/items/weapons/daggers/guard-dagger-v1.png",
    itemType: "DAGGER",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 16,
    price: 85,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 14 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 24 },
      { statType: "ATTACK_SPEED", value: 1.4 },
      { statType: "CRITICAL_CHANCE", value: 3.2, maxValue: 6.4 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 16,
      defaultSeconds: 60,
      xpPerUnit: 20,
      requirements: [
        { itemName: "Bronze Ingot", quantityPerUnit: 2 },
        { itemName: "Small Bones", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Iron Dirk",
    description:
      "A long, slim iron dirk with a bone hilt, made for thrusting through gaps in hide and mail.",
    sprite: "/assets/items/weapons/daggers/iron-dirk-v1.png",
    itemType: "DAGGER",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 30,
    price: 25,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 25 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 42 },
      { statType: "ATTACK_SPEED", value: 1.4 },
      { statType: "CRITICAL_CHANCE", value: 3.4, maxValue: 6.8 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 30,
      defaultSeconds: 85,
      xpPerUnit: 33,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 4 },
        { itemName: "Small Bones", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Steel Stiletto",
    description:
      "A needle-thin steel spike with a brass pommel, made to find the one weak point in armor.",
    sprite: "/assets/items/weapons/daggers/steel-stiletto-v1.png",
    itemType: "DAGGER",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 54,
    price: 210,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 43 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 72 },
      { statType: "ATTACK_SPEED", value: 1.4 },
      { statType: "CRITICAL_CHANCE", value: 3.7, maxValue: 7.4 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 54,
      defaultSeconds: 125,
      xpPerUnit: 59,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 3 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Hardened Leather", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Cudgel Mace",
    description:
      "An iron-capped club on an oak handle. Crude, cheap and convincing.",
    sprite: "/assets/items/weapons/maces/cudgel-mace-v1.png",
    itemType: "MACE",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 5,
    price: 15,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 11 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 16 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "ARMOR", value: 7 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 5,
      defaultSeconds: 40,
      xpPerUnit: 12,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 2 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
        { itemName: "Oak Plank", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Flanged Mace",
    description:
      "Raised iron flanges concentrate each blow, and a bronze collar keeps the head from working loose.",
    sprite: "/assets/items/weapons/maces/flanged-mace-v1.png",
    itemType: "MACE",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 22,
    price: 45,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 33 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 50 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "ARMOR", value: 12 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 22,
      defaultSeconds: 70,
      xpPerUnit: 25,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 4 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Oak Plank", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Iron Mace",
    description:
      "A spiked iron head on a sinew-bound oak haft, heavy enough to dent a helm.",
    sprite: "/assets/items/weapons/maces/iron-mace-v1.png",
    itemType: "MACE",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 36,
    price: 35,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 52 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 78 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "ARMOR", value: 16 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 36,
      defaultSeconds: 95,
      xpPerUnit: 39,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 7 },
        { itemName: "Oak Plank", quantityPerUnit: 1 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Steel Mace",
    description:
      "A steel head around a weighted iron core, on an ash haft bound in hardened leather. It turns blows aside as readily as it deals them.",
    sprite: "/assets/items/weapons/maces/steel-mace-v1.png",
    itemType: "MACE",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 56,
    price: 330,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 78 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 117 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "ARMOR", value: 21 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 56,
      defaultSeconds: 130,
      xpPerUnit: 62,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 6 },
        { itemName: "Iron Ingot", quantityPerUnit: 2 },
        { itemName: "Ash Plank", quantityPerUnit: 1 },
        { itemName: "Hardened Leather", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Ball Flail",
    description:
      "An iron ball on a short copper chain. Hard to aim and harder to stop.",
    sprite: "/assets/items/weapons/flails/ball-flail-v1.png",
    itemType: "FLAIL",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 8,
    price: 25,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 14 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 26 },
      { statType: "ATTACK_SPEED", value: 0.8 },
      { statType: "CRITICAL_CHANCE", value: 2.3, maxValue: 4.6 },
      { statType: "CRITICAL_DAMAGE", value: 9 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 8,
      defaultSeconds: 45,
      xpPerUnit: 14,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 3 },
        { itemName: "Copper Ingot", quantityPerUnit: 1 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Chain Flail",
    description:
      "A heavier iron ball on bronze-linked chain that swings around a raised guard.",
    sprite: "/assets/items/weapons/flails/chain-flail-v1.png",
    itemType: "FLAIL",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 14,
    price: 50,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 21 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 39 },
      { statType: "ATTACK_SPEED", value: 0.8 },
      { statType: "CRITICAL_CHANCE", value: 2.4, maxValue: 4.8 },
      { statType: "CRITICAL_DAMAGE", value: 10 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 14,
      defaultSeconds: 55,
      xpPerUnit: 18,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 3 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Iron Flail",
    description:
      "A studded iron ball on a hide-wrapped haft. Its arc is difficult to read.",
    sprite: "/assets/items/weapons/flails/iron-flail-v1.png",
    itemType: "FLAIL",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 26,
    price: 30,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 36 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 67 },
      { statType: "ATTACK_SPEED", value: 0.8 },
      { statType: "CRITICAL_CHANCE", value: 2.5, maxValue: 5 },
      { statType: "CRITICAL_DAMAGE", value: 10 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 26,
      defaultSeconds: 75,
      xpPerUnit: 28,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 5 },
        { itemName: "Wooden Handle", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Spiked Flail",
    description:
      "Iron spikes stud this flail's head, and sinew lashing holds the chain fast to its oak haft.",
    sprite: "/assets/items/weapons/flails/spiked-flail-v1.png",
    itemType: "FLAIL",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 38,
    price: 45,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 51 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 94 },
      { statType: "ATTACK_SPEED", value: 0.8 },
      { statType: "CRITICAL_CHANCE", value: 2.6, maxValue: 5.2 },
      { statType: "CRITICAL_DAMAGE", value: 11 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 38,
      defaultSeconds: 100,
      xpPerUnit: 42,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 7 },
        { itemName: "Oak Plank", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Morning Flail",
    description:
      "A star-headed steel flail on an ash haft. Every swing is a gamble that often pays.",
    sprite: "/assets/items/weapons/flails/morning-flail-v1.png",
    itemType: "FLAIL",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 50,
    price: 260,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 65 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 121 },
      { statType: "ATTACK_SPEED", value: 0.8 },
      { statType: "CRITICAL_CHANCE", value: 2.7, maxValue: 5.4 },
      { statType: "CRITICAL_DAMAGE", value: 12 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 50,
      defaultSeconds: 120,
      xpPerUnit: 55,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 4 },
        { itemName: "Ash Plank", quantityPerUnit: 1 },
        { itemName: "Hardened Leather", quantityPerUnit: 1 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Steel Flail",
    description:
      "A flanged steel head on a heavy chain and frostpine haft, the flail of a seasoned fighter.",
    sprite: "/assets/items/weapons/flails/steel-flail-v1.png",
    itemType: "FLAIL",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 64,
    price: 450,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 82 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 153 },
      { statType: "ATTACK_SPEED", value: 0.8 },
      { statType: "CRITICAL_CHANCE", value: 2.9, maxValue: 5.8 },
      { statType: "CRITICAL_DAMAGE", value: 13 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 64,
      defaultSeconds: 145,
      xpPerUnit: 74,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 7 },
        { itemName: "Frostpine Plank", quantityPerUnit: 1 },
        { itemName: "Hardened Leather", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Leaf Spear",
    description:
      "A leaf-shaped copper head on a pine shaft. Its reach keeps trouble at arm's length.",
    sprite: "/assets/items/weapons/spears/leaf-spear-v1.png",
    itemType: "SPEAR",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 7,
    price: 45,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 12 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 18 },
      { statType: "ATTACK_SPEED", value: 0.95 },
      { statType: "EVASION_MELEE", value: 3.1, maxValue: 6.2 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 7,
      defaultSeconds: 45,
      xpPerUnit: 14,
      requirements: [
        { itemName: "Copper Ingot", quantityPerUnit: 2 },
        { itemName: "Pine Plank", quantityPerUnit: 2 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Boar Spear",
    description:
      "A bronze spear on a willow shaft, with lugs below the blade that stop a charging animal short of the hunter.",
    sprite: "/assets/items/weapons/spears/boar-spear-v1.png",
    itemType: "SPEAR",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 18,
    price: 110,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 25 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 38 },
      { statType: "ATTACK_SPEED", value: 0.95 },
      { statType: "EVASION_MELEE", value: 3.2, maxValue: 6.4 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 18,
      defaultSeconds: 60,
      xpPerUnit: 21,
      requirements: [
        { itemName: "Bronze Ingot", quantityPerUnit: 2 },
        { itemName: "Willow Plank", quantityPerUnit: 2 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Iron Spear",
    description:
      "A plain iron spearhead lashed to a pine shaft, the weapon of every second soldier in the realm.",
    sprite: "/assets/items/weapons/spears/iron-spear-v1.png",
    itemType: "SPEAR",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 28,
    price: 35,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 37 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 55 },
      { statType: "ATTACK_SPEED", value: 0.95 },
      { statType: "EVASION_MELEE", value: 3.4, maxValue: 6.8 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 28,
      defaultSeconds: 80,
      xpPerUnit: 30,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 4 },
        { itemName: "Pine Plank", quantityPerUnit: 2 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Ash Spear",
    description:
      "A steel point on a straight ash shaft, springy and strong, bound with sinew at the socket.",
    sprite: "/assets/items/weapons/spears/ash-spear-v1.png",
    itemType: "SPEAR",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 42,
    price: 160,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 53 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 80 },
      { statType: "ATTACK_SPEED", value: 0.95 },
      { statType: "EVASION_MELEE", value: 3.6, maxValue: 7.2 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 42,
      defaultSeconds: 105,
      xpPerUnit: 45,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 2 },
        { itemName: "Ash Plank", quantityPerUnit: 2 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Winged Spear",
    description:
      "Steel wings flank this spear's blade, catching weapons and holding foes at a distance.",
    sprite: "/assets/items/weapons/spears/winged-spear-v1.png",
    itemType: "SPEAR",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 52,
    price: 240,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 65 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 98 },
      { statType: "ATTACK_SPEED", value: 0.95 },
      { statType: "EVASION_MELEE", value: 3.7, maxValue: 7.4 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 52,
      defaultSeconds: 125,
      xpPerUnit: 58,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 4 },
        { itemName: "Ash Plank", quantityPerUnit: 2 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Steel Spear",
    description:
      "A long steel head bound to a frostpine shaft with sinew and sealed with resin against the weather.",
    sprite: "/assets/items/weapons/spears/steel-spear-v1.png",
    itemType: "SPEAR",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 68,
    price: 360,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 84 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 126 },
      { statType: "ATTACK_SPEED", value: 0.95 },
      { statType: "EVASION_MELEE", value: 3.9, maxValue: 7.8 },
    ],
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 68,
      defaultSeconds: 150,
      xpPerUnit: 79,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 5 },
        { itemName: "Frostpine Plank", quantityPerUnit: 2 },
        { itemName: "Animal Sinew", quantityPerUnit: 2 },
        { itemName: "Tempering Resin", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Yew Shortbow",
    description:
      "A compact shortbow strung with deer sinew, quick to draw and forgiving for a new archer.",
    sprite: "/assets/items/weapons/bows/yew-shortbow-v1.png",
    itemType: "BOW",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 9,
    price: 25,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 14 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 21 },
      { statType: "ATTACK_SPEED", value: 1 },
      { statType: "ACCURACY", value: 3 },
      { statType: "CRITICAL_CHANCE", value: 2.3, maxValue: 4.6 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 9,
      defaultSeconds: 45,
      xpPerUnit: 14,
      requirements: [
        { itemName: "Pine Plank", quantityPerUnit: 2 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Elm Recurve Bow",
    description:
      "Recurved limbs tipped with antler nocks store more power than their size suggests.",
    sprite: "/assets/items/weapons/bows/elm-recurve-bow-v1.png",
    itemType: "BOW",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 22,
    price: 85,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 28 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 42 },
      { statType: "ATTACK_SPEED", value: 1 },
      { statType: "ACCURACY", value: 5 },
      { statType: "CRITICAL_CHANCE", value: 2.5, maxValue: 5 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 22,
      defaultSeconds: 70,
      xpPerUnit: 25,
      requirements: [
        { itemName: "Willow Plank", quantityPerUnit: 3 },
        { itemName: "Animal Sinew", quantityPerUnit: 2 },
        { itemName: "Stag Antler", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Ash Longbow",
    description:
      "A tall ash longbow with a hardened-leather grip. Slow to master, steady once mastered.",
    sprite: "/assets/items/weapons/bows/ash-longbow-v1.png",
    itemType: "BOW",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 42,
    price: 190,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 51 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 76 },
      { statType: "ATTACK_SPEED", value: 1 },
      { statType: "ACCURACY", value: 7 },
      { statType: "CRITICAL_CHANCE", value: 2.7, maxValue: 5.4 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 42,
      defaultSeconds: 105,
      xpPerUnit: 45,
      requirements: [
        { itemName: "Ash Plank", quantityPerUnit: 3 },
        { itemName: "Animal Sinew", quantityPerUnit: 2 },
        { itemName: "Hardened Leather", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Hornwood Bow",
    description:
      "Frostpine, curved horn and sinew glued together with resin. Compact and fiercely strong.",
    sprite: "/assets/items/weapons/bows/hornwood-bow-v1.png",
    itemType: "BOW",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 58,
    price: 210,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 69 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 103 },
      { statType: "ATTACK_SPEED", value: 1 },
      { statType: "ACCURACY", value: 10 },
      { statType: "CRITICAL_CHANCE", value: 2.8, maxValue: 5.6 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 58,
      defaultSeconds: 135,
      xpPerUnit: 66,
      requirements: [
        { itemName: "Frostpine Plank", quantityPerUnit: 2 },
        { itemName: "Curved Horn", quantityPerUnit: 2 },
        { itemName: "Animal Sinew", quantityPerUnit: 2 },
        { itemName: "Tempering Resin", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Light Crossbow",
    description:
      "A simple iron-armed crossbow on a willow stock. Anyone can learn to aim it in an afternoon.",
    sprite: "/assets/items/weapons/crossbows/light-crossbow-v1.png",
    itemType: "CROSSBOW",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 14,
    price: 45,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 29 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 40 },
      { statType: "ATTACK_SPEED", value: 0.7 },
      { statType: "CRITICAL_DAMAGE", value: 13 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 14,
      defaultSeconds: 55,
      xpPerUnit: 18,
      requirements: [
        { itemName: "Willow Plank", quantityPerUnit: 2 },
        { itemName: "Iron Ingot", quantityPerUnit: 2 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Lever Crossbow",
    description:
      "A bronze cocking lever lets this crossbow draw a heavier iron prod than arms alone could.",
    sprite: "/assets/items/weapons/crossbows/lever-crossbow-v1.png",
    itemType: "CROSSBOW",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 28,
    price: 80,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 53 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 72 },
      { statType: "ATTACK_SPEED", value: 0.7 },
      { statType: "CRITICAL_DAMAGE", value: 14 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 28,
      defaultSeconds: 80,
      xpPerUnit: 30,
      requirements: [
        { itemName: "Willow Plank", quantityPerUnit: 2 },
        { itemName: "Iron Ingot", quantityPerUnit: 3 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Animal Sinew", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Reinforced Crossbow",
    description:
      "Steel braces stiffen an ash stock so it can carry a heavy steel prod, loosed by a bronze trigger.",
    sprite: "/assets/items/weapons/crossbows/reinforced-crossbow-v1.png",
    itemType: "CROSSBOW",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 48,
    price: 240,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 87 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 118 },
      { statType: "ATTACK_SPEED", value: 0.7 },
      { statType: "CRITICAL_DAMAGE", value: 16 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 48,
      defaultSeconds: 115,
      xpPerUnit: 52,
      requirements: [
        { itemName: "Ash Plank", quantityPerUnit: 2 },
        { itemName: "Steel Ingot", quantityPerUnit: 3 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Animal Sinew", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Steel Crossbow",
    description:
      "An all-steel prod on a frostpine stock. Its bolts punch through shields.",
    sprite: "/assets/items/weapons/crossbows/steel-crossbow-v1.png",
    itemType: "CROSSBOW",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 66,
    price: 440,
    stats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 118 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 159 },
      { statType: "ATTACK_SPEED", value: 0.7 },
      { statType: "CRITICAL_DAMAGE", value: 17 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 66,
      defaultSeconds: 150,
      xpPerUnit: 77,
      requirements: [
        { itemName: "Frostpine Plank", quantityPerUnit: 2 },
        { itemName: "Steel Ingot", quantityPerUnit: 6 },
        { itemName: "Animal Sinew", quantityPerUnit: 2 },
        { itemName: "Hardened Leather", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Reed Staff",
    description:
      "A slender staff capped with a copper knob, light as a reed and kind to a first apprentice.",
    sprite: "/assets/items/weapons/staffs/reed-staff-v1.png",
    itemType: "STAFF",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "COMMON",
    requiredLevel: 2,
    price: 25,
    stats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 9 },
      { statType: "MAGIC_DAMAGE_MAX", value: 14 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "CRITICAL_CHANCE", value: 4, maxValue: 8 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 2,
      defaultSeconds: 45,
      xpPerUnit: 13,
      requirements: [
        { itemName: "Pine Plank", quantityPerUnit: 2 },
        { itemName: "Copper Ingot", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Ironwood Staff",
    description:
      "A dark, dense staff banded in iron and carved at the crown to steady a caster's focus.",
    sprite: "/assets/items/weapons/staffs/ironwood-staff-v1.png",
    itemType: "STAFF",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "COMMON",
    requiredLevel: 24,
    price: 40,
    stats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 47 },
      { statType: "MAGIC_DAMAGE_MAX", value: 70 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "CRITICAL_CHANCE", value: 4.4, maxValue: 8.8 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 24,
      defaultSeconds: 95,
      xpPerUnit: 35,
      requirements: [
        { itemName: "Willow Plank", quantityPerUnit: 3 },
        { itemName: "Iron Ingot", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Ash Staff",
    description:
      "A pale ash staff with a curled crook. Its even grain carries a spell cleanly.",
    sprite: "/assets/items/weapons/staffs/ash-staff-v1.png",
    itemType: "STAFF",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "UNCOMMON",
    requiredLevel: 44,
    price: 160,
    stats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 81 },
      { statType: "MAGIC_DAMAGE_MAX", value: 121 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "CRITICAL_CHANCE", value: 4.8, maxValue: 9.6 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 44,
      defaultSeconds: 140,
      xpPerUnit: 61,
      requirements: [
        { itemName: "Ash Plank", quantityPerUnit: 3 },
        { itemName: "Hardened Leather", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Steel-Capped Staff",
    description:
      "A frostpine staff whose steel cap cradles an orb of hardened amber resin.",
    sprite: "/assets/items/weapons/staffs/steel-capped-staff-v1.png",
    itemType: "STAFF",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "UNCOMMON",
    requiredLevel: 62,
    price: 300,
    stats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 112 },
      { statType: "MAGIC_DAMAGE_MAX", value: 168 },
      { statType: "ATTACK_SPEED", value: 0.85 },
      { statType: "CRITICAL_CHANCE", value: 5.1, maxValue: 10.2 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 62,
      defaultSeconds: 185,
      xpPerUnit: 93,
      requirements: [
        { itemName: "Frostpine Plank", quantityPerUnit: 3 },
        { itemName: "Steel Ingot", quantityPerUnit: 2 },
        { itemName: "Tempering Resin", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Copper-Tipped Wand",
    description:
      "An oak wand with a copper point that narrows a novice's spell into a single sharp line.",
    sprite: "/assets/items/weapons/wands/copper-tipped-wand-v1.png",
    itemType: "WAND",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 5,
    price: 15,
    stats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 8 },
      { statType: "MAGIC_DAMAGE_MAX", value: 12 },
      { statType: "ATTACK_SPEED", value: 1.2 },
      { statType: "CRITICAL_DAMAGE", value: 12 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 5,
      defaultSeconds: 40,
      xpPerUnit: 12,
      requirements: [
        { itemName: "Oak Plank", quantityPerUnit: 1 },
        { itemName: "Copper Ingot", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Rowan Wand",
    description:
      "A carved wand with bronze fittings, carried by hedge mages for protection.",
    sprite: "/assets/items/weapons/wands/rowan-wand-v1.png",
    itemType: "WAND",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 18,
    price: 60,
    stats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 20 },
      { statType: "MAGIC_DAMAGE_MAX", value: 30 },
      { statType: "ATTACK_SPEED", value: 1.2 },
      { statType: "CRITICAL_DAMAGE", value: 13 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 18,
      defaultSeconds: 60,
      xpPerUnit: 21,
      requirements: [
        { itemName: "Willow Plank", quantityPerUnit: 2 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Ironbound Wand",
    description:
      "Iron bands keep this dark wand from splitting under the strain of stronger spells.",
    sprite: "/assets/items/weapons/wands/ironbound-wand-v1.png",
    itemType: "WAND",
    equipTo: "weapon",
    rarity: "COMMON",
    requiredLevel: 32,
    price: 15,
    stats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 33 },
      { statType: "MAGIC_DAMAGE_MAX", value: 49 },
      { statType: "ATTACK_SPEED", value: 1.2 },
      { statType: "CRITICAL_DAMAGE", value: 14 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 32,
      defaultSeconds: 90,
      xpPerUnit: 35,
      requirements: [
        { itemName: "Pine Plank", quantityPerUnit: 2 },
        { itemName: "Iron Ingot", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Ash Wand",
    description:
      "A smooth ash wand sealed in amber resin. Plain to look at, but it answers quickly.",
    sprite: "/assets/items/weapons/wands/ash-wand-v1.png",
    itemType: "WAND",
    equipTo: "weapon",
    rarity: "UNCOMMON",
    requiredLevel: 48,
    price: 90,
    stats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 48 },
      { statType: "MAGIC_DAMAGE_MAX", value: 72 },
      { statType: "ATTACK_SPEED", value: 1.2 },
      { statType: "CRITICAL_DAMAGE", value: 16 },
    ],
    craft: {
      actionType: "CARPENTRY",
      requiredSkillLevel: 48,
      defaultSeconds: 115,
      xpPerUnit: 52,
      requirements: [
        { itemName: "Ash Plank", quantityPerUnit: 2 },
        { itemName: "Tempering Resin", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Woodbound Shield",
    description:
      "Oak planks bound in iron and copper rivets around a central boss. Heavy, but it stops most things.",
    sprite: "/assets/items/weapons/shields/woodbound-shield-v1.png",
    itemType: "SHIELD",
    equipTo: "offhand",
    rarity: "COMMON",
    requiredLevel: 8,
    price: 30,
    stats: [
      { statType: "ARMOR", value: 8 },
      { statType: "BLOCK_CHANCE", value: 10.2, maxValue: 20.5 },
      { statType: "HEALTH", value: 9 },
    ],
    craft: {
      actionType: "BLACKSMITHING",
      requiredSkillLevel: 8,
      defaultSeconds: 55,
      xpPerUnit: 17,
      requirements: [
        { itemName: "Oak Plank", quantityPerUnit: 4 },
        { itemName: "Iron Ingot", quantityPerUnit: 2 },
        { itemName: "Copper Ingot", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Round Shield",
    description:
      "A willow round shield with a bronze boss and a rawhide rim, light enough to keep raised.",
    sprite: "/assets/items/weapons/shields/round-shield-v1.png",
    itemType: "SHIELD",
    equipTo: "offhand",
    rarity: "COMMON",
    requiredLevel: 18,
    price: 85,
    stats: [
      { statType: "ARMOR", value: 11 },
      { statType: "BLOCK_CHANCE", value: 10.5, maxValue: 21.1 },
      { statType: "HEALTH", value: 14 },
    ],
    craft: {
      actionType: "BLACKSMITHING",
      requiredSkillLevel: 18,
      defaultSeconds: 75,
      xpPerUnit: 26,
      requirements: [
        { itemName: "Willow Plank", quantityPerUnit: 3 },
        { itemName: "Iron Ingot", quantityPerUnit: 2 },
        { itemName: "Bronze Ingot", quantityPerUnit: 1 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Iron Heater Shield",
    description:
      "An iron-faced heater shield over an oak core, its edges wrapped in hide.",
    sprite: "/assets/items/weapons/shields/iron-heater-shield-v1.png",
    itemType: "SHIELD",
    equipTo: "offhand",
    rarity: "COMMON",
    requiredLevel: 32,
    price: 40,
    stats: [
      { statType: "ARMOR", value: 14 },
      { statType: "BLOCK_CHANCE", value: 10.9, maxValue: 21.9 },
      { statType: "HEALTH", value: 22 },
    ],
    craft: {
      actionType: "BLACKSMITHING",
      requiredSkillLevel: 32,
      defaultSeconds: 105,
      xpPerUnit: 41,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 6 },
        { itemName: "Oak Plank", quantityPerUnit: 2 },
        { itemName: "Raw Hide", quantityPerUnit: 2 },
      ],
    },
  },
  {
    name: "Kite Shield",
    description:
      "A tall, resin-sealed shield of ash and steel that covers a fighter from shoulder to knee.",
    sprite: "/assets/items/weapons/shields/kite-shield-v1.png",
    itemType: "SHIELD",
    equipTo: "offhand",
    rarity: "UNCOMMON",
    requiredLevel: 46,
    price: 300,
    stats: [
      { statType: "ARMOR", value: 18 },
      { statType: "BLOCK_CHANCE", value: 11.4, maxValue: 22.7 },
      { statType: "HEALTH", value: 29 },
    ],
    craft: {
      actionType: "BLACKSMITHING",
      requiredSkillLevel: 46,
      defaultSeconds: 135,
      xpPerUnit: 60,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 3 },
        { itemName: "Ash Plank", quantityPerUnit: 3 },
        { itemName: "Hardened Leather", quantityPerUnit: 1 },
        { itemName: "Tempering Resin", quantityPerUnit: 1 },
      ],
    },
  },
  {
    name: "Steel Shield",
    description:
      "A riveted steel shield lined with hardened leather, a full bulwark for the front line.",
    sprite: "/assets/items/weapons/shields/steel-shield-v1.png",
    itemType: "SHIELD",
    equipTo: "offhand",
    rarity: "UNCOMMON",
    requiredLevel: 64,
    price: 410,
    stats: [
      { statType: "ARMOR", value: 23 },
      { statType: "BLOCK_CHANCE", value: 11.9, maxValue: 23.8 },
      { statType: "HEALTH", value: 38 },
    ],
    craft: {
      actionType: "BLACKSMITHING",
      requiredSkillLevel: 64,
      defaultSeconds: 175,
      xpPerUnit: 89,
      requirements: [
        { itemName: "Steel Ingot", quantityPerUnit: 7 },
        { itemName: "Hardened Leather", quantityPerUnit: 2 },
        { itemName: "Tempering Resin", quantityPerUnit: 1 },
      ],
    },
  },
] as const satisfies readonly CraftedWeaponDefinition[]);

/** Weapons that were already in the catalog and only gain a recipe. */
export const EXISTING_WEAPON_CRAFTS = [
  {
    itemName: "Bearded Greataxe",
    itemType: "GREATAXE",
    rarity: "COMMON",
    craft: {
      actionType: "WEAPONSMITHING",
      requiredSkillLevel: 20,
      defaultSeconds: 85,
      xpPerUnit: 30,
      requirements: [
        { itemName: "Iron Ingot", quantityPerUnit: 6 },
        { itemName: "Willow Plank", quantityPerUnit: 2 },
        { itemName: "Raw Hide", quantityPerUnit: 1 },
      ],
    },
  },
  {
    itemName: "Buckler",
    itemType: "SHIELD",
    rarity: "COMMON",
    craft: {
      actionType: "BLACKSMITHING",
      requiredSkillLevel: 1,
      defaultSeconds: 40,
      xpPerUnit: 11,
      requirements: [
        { itemName: "Oak Plank", quantityPerUnit: 2 },
        { itemName: "Iron Ingot", quantityPerUnit: 1 },
      ],
    },
  },
] as const satisfies readonly ExistingWeaponCraftDefinition[];

export function craftedWeaponCreateData(
  item: CraftedWeaponDefinition,
): Prisma.ItemCreateInput {
  const stat = (statType: StatType) =>
    item.stats.find((entry) => entry.statType === statType)?.value ?? 0;
  return {
    name: item.name,
    description: item.description,
    price: item.price,
    sprite: item.sprite,
    itemType: item.itemType,
    equipTo: item.equipTo,
    twoHanded: item.twoHanded ?? false,
    rarity: item.rarity,
    requiredLevel: item.requiredLevel,
    stackable: false,
    maxStackSize: 1,
    minPhysicalDamage: stat("PHYSICAL_DAMAGE_MIN"),
    maxPhysicalDamage: stat("PHYSICAL_DAMAGE_MAX"),
    minMagicDamage: stat("MAGIC_DAMAGE_MIN"),
    maxMagicDamage: stat("MAGIC_DAMAGE_MAX"),
    armor: stat("ARMOR"),
    stats: {
      create: item.stats.map((entry) => ({
        statType: entry.statType,
        value: entry.value,
        maxValue: entry.maxValue ?? null,
      })),
    },
  };
}
