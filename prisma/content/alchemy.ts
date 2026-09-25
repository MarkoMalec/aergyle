import type { Prisma } from "../../src/generated/prisma/client";
import type { ItemRarity, ItemType } from "../../src/generated/prisma/enums";

export interface AlchemyItemDefinition {
  slug: string;
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  sprite: string;
  healingAmount?: number;
}

export interface AlchemyPotionDefinition extends AlchemyItemDefinition {
  itemType: "POTION" | "ELIXIR";
  healingAmount: number;
  requiredSkillLevel: number;
  defaultSeconds: number;
  xpPerUnit: number;
  sortOrder: number;
  requirements: readonly {
    itemName: string;
    quantityPerUnit: number;
  }[];
}

/** Gathered potion reagents supplied by the Gathering content pack. */
export const ALCHEMY_HERB_TYPES = {
  Yarrow: "HERB",
  Aloe: "HERB",
  Ginseng: "HERB",
  Echinacea: "HERB",
  Amrans: "HERB",
  "Arkasu Bark": "HERB",
} as const satisfies Readonly<Record<string, ItemType>>;

/** Basic vendor reagent plus the rare monster component. */
export const ALCHEMY_MATERIALS = [
  {
    slug: "water",
    name: "Water",
    description:
      "Clean, corked water for infusions, washes, dilutions and nearly every basic alchemical preparation. Most town merchants keep it in steady stock.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 2,
    sprite: "/assets/items/resources/alchemy/water-alchemy-v1.png",
  },
  {
    slug: "troll-blood",
    name: "Troll Blood",
    description:
      "A sealed jar of exceptionally potent troll blood. Its regenerative charge makes it invaluable, but only a dangerous troll yields a usable sample.",
    itemType: "MATERIAL",
    rarity: "EPIC",
    price: 320,
    sprite: "/assets/items/resources/alchemy/troll-blood-alchemy-v1.png",
  },
] as const satisfies readonly AlchemyItemDefinition[];

export const ALCHEMY_POTIONS = [
  {
    slug: "minor-healing-potion",
    name: "Minor Healing Potion",
    description:
      "A compact red restorative brewed for a quick recovery after a minor scrape.",
    itemType: "POTION",
    rarity: "COMMON",
    price: 18,
    sprite:
      "/assets/items/consumables/potions/minor-healing-potion-alchemy-v1.png",
    healingAmount: 30,
    requiredSkillLevel: 1,
    defaultSeconds: 8,
    xpPerUnit: 3,
    sortOrder: 10,
    requirements: [
      { itemName: "Water", quantityPerUnit: 1 },
      { itemName: "Yarrow", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "small-healing-potion",
    name: "Small Healing Potion",
    description:
      "A fuller red flask steeped with fresh field herbs for a dependable battlefield recovery.",
    itemType: "POTION",
    rarity: "UNCOMMON",
    price: 52,
    sprite:
      "/assets/items/consumables/potions/small-healing-potion-alchemy-v1.png",
    healingAmount: 75,
    requiredSkillLevel: 10,
    defaultSeconds: 18,
    xpPerUnit: 8,
    sortOrder: 20,
    requirements: [
      { itemName: "Water", quantityPerUnit: 1 },
      { itemName: "Yarrow", quantityPerUnit: 2 },
      { itemName: "Aloe", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "medium-healing-potion",
    name: "Medium Healing Potion",
    description:
      "A broad red apothecary flask that restores a substantial measure of health.",
    itemType: "POTION",
    rarity: "RARE",
    price: 135,
    sprite:
      "/assets/items/consumables/potions/medium-healing-potion-alchemy-v1.png",
    healingAmount: 150,
    requiredSkillLevel: 25,
    defaultSeconds: 38,
    xpPerUnit: 18,
    sortOrder: 30,
    requirements: [
      { itemName: "Water", quantityPerUnit: 2 },
      { itemName: "Aloe", quantityPerUnit: 2 },
      { itemName: "Ginseng", quantityPerUnit: 1 },
      { itemName: "Echinacea", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "big-healing-potion",
    name: "Big Healing Potion",
    description:
      "A reinforced red flask for a deep recovery when a common draught will not do.",
    itemType: "POTION",
    rarity: "EXQUISITE",
    price: 310,
    sprite:
      "/assets/items/consumables/potions/big-healing-potion-alchemy-v1.png",
    healingAmount: 325,
    requiredSkillLevel: 50,
    defaultSeconds: 75,
    xpPerUnit: 36,
    sortOrder: 40,
    requirements: [
      { itemName: "Water", quantityPerUnit: 2 },
      { itemName: "Ginseng", quantityPerUnit: 2 },
      { itemName: "Echinacea", quantityPerUnit: 2 },
      { itemName: "Amrans", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "trollblood-elixir",
    name: "Trollblood Elixir",
    description:
      "A massive, heavily sealed red elixir whose troll-blood regenerative charge provides the strongest healing in the series.",
    itemType: "ELIXIR",
    rarity: "EPIC",
    price: 900,
    sprite:
      "/assets/items/consumables/elixirs/trollblood-elixir-alchemy-v1.png",
    healingAmount: 750,
    requiredSkillLevel: 80,
    defaultSeconds: 150,
    xpPerUnit: 80,
    sortOrder: 50,
    requirements: [
      { itemName: "Water", quantityPerUnit: 3 },
      { itemName: "Troll Blood", quantityPerUnit: 1 },
      { itemName: "Ginseng", quantityPerUnit: 2 },
      { itemName: "Amrans", quantityPerUnit: 2 },
      { itemName: "Arkasu Bark", quantityPerUnit: 2 },
    ],
  },
] as const satisfies readonly AlchemyPotionDefinition[];

export const ALCHEMY_ITEMS = [
  ...ALCHEMY_MATERIALS,
  ...ALCHEMY_POTIONS,
] as const;

export function alchemyItemCreateData(
  definition: AlchemyItemDefinition,
): Prisma.ItemCreateInput {
  return {
    name: definition.name,
    description: definition.description,
    itemType: definition.itemType,
    rarity: definition.rarity,
    price: definition.price,
    sprite: definition.sprite,
    equipTo: null,
    twoHanded: false,
    stackable: true,
    maxStackSize: 9999,
    foodEffectSeconds: null,
    healingAmount: definition.healingAmount ?? null,
    flipNegativeStatsWithRarity: false,
    armor: 0,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    requiredLevel: 1,
  };
}
