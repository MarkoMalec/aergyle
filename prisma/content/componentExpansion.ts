import type { Prisma } from "../../src/generated/prisma/client";
import type {
  ItemRarity,
  ItemType,
  VocationalActionType,
} from "../../src/generated/prisma/enums";

export interface ComponentItemDefinition {
  slug: string;
  name: string;
  description: string;
  itemType: "MATERIAL" | "HIDE";
  rarity: ItemRarity;
  price: number;
  sprite: string;
}

export interface ComponentCraftDefinition {
  outputItemName: string;
  actionType: Extract<VocationalActionType, "CARPENTRY" | "TAILORING">;
  requiredSkillLevel: number;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  requirements: readonly {
    itemName: string;
    quantityPerUnit: number;
  }[];
}

export interface GatheringSourceDefinition {
  itemName: string;
  requiredSkillLevel: number;
  locations: readonly {
    locationName: string;
    baseChance: number;
    minQuantity: number;
    maxQuantity: number;
  }[];
}

export const COMPONENT_ITEMS = [
  {
    slug: "wooden-handle",
    name: "Wooden Handle",
    description:
      "A balanced oak handle shaped for tools, weapons, mechanisms and other crafted assemblies.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 7,
    sprite: "/assets/items/resources/components/wooden-handle-atlas-v1.png",
  },
  {
    slug: "duskbound-handle",
    name: "Duskbound Handle",
    description:
      "A reinforced elderwood handle sealed with Dusk Oil and wrapped in Hardened Leather for demanding tools, weapons and arcane mechanisms.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 275,
    sprite: "/assets/items/resources/components/duskbound-handle-atlas-v1.png",
  },
  {
    slug: "dusk-oil",
    name: "Dusk Oil",
    description:
      "A dense violet-black oil that penetrates wood, leather and metal, preserving the material while carrying subtle shadow-bound properties.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 65,
    sprite: "/assets/items/resources/alchemy/dusk-oil-atlas-v1.png",
  },
  {
    slug: "tempering-resin",
    name: "Tempering Resin",
    description:
      "A mineral-rich amber resin that sets hard under heat and pressure, useful for stiffening leather, sealing wood and binding layered materials.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 18,
    sprite: "/assets/items/resources/resins/tempering-resin-atlas-v1.png",
  },
  {
    slug: "hardened-leather",
    name: "Hardened Leather",
    description:
      "Thick hide cured with Tempering Resin and compressed into rigid, resilient sheets for armor, tools, cases and structural bindings.",
    itemType: "HIDE",
    rarity: "UNCOMMON",
    price: 50,
    sprite: "/assets/items/resources/textiles/hardened-leather-atlas-v1.png",
  },
] as const satisfies readonly ComponentItemDefinition[];

export const COMPONENT_CRAFTS = [
  {
    outputItemName: "Wooden Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 1,
    defaultSeconds: 18,
    yieldPerUnit: 1,
    xpPerUnit: 5,
    requirements: [{ itemName: "Oak Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Hardened Leather",
    actionType: "TAILORING",
    requiredSkillLevel: 15,
    defaultSeconds: 45,
    yieldPerUnit: 1,
    xpPerUnit: 12,
    requirements: [
      { itemName: "Soft Hide", quantityPerUnit: 2 },
      { itemName: "Tempering Resin", quantityPerUnit: 1 },
    ],
  },
  {
    outputItemName: "Duskbound Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 80,
    defaultSeconds: 75,
    yieldPerUnit: 1,
    xpPerUnit: 34,
    requirements: [
      { itemName: "Elderwood Plank", quantityPerUnit: 1 },
      { itemName: "Dusk Oil", quantityPerUnit: 1 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
  },
] as const satisfies readonly ComponentCraftDefinition[];

export const COMPONENT_GATHERING_SOURCES = [
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
] as const satisfies readonly GatheringSourceDefinition[];

export const BASIC_PICKAXE_REQUIREMENTS = [
  { itemName: "Iron Ingot", quantityPerUnit: 1 },
  { itemName: "Wooden Handle", quantityPerUnit: 1 },
] as const;

export function componentItemCreateData(
  definition: ComponentItemDefinition,
): Prisma.ItemCreateInput {
  return {
    name: definition.name,
    description: definition.description,
    itemType: definition.itemType as ItemType,
    rarity: definition.rarity,
    price: definition.price,
    sprite: definition.sprite,
    equipTo: null,
    stackable: true,
    maxStackSize: 9999,
    requiredLevel: 1,
    flipNegativeStatsWithRarity: false,
    armor: 0,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
  };
}
