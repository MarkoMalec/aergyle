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
    slug: "birch-handle",
    name: "Birch Handle",
    description:
      "A smooth pale birch handle with a fine, even grain for light tools, weapons and precise mechanisms.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 7,
    sprite: "/assets/items/resources/components/birch-handle-atlas-v1.png",
  },
  {
    slug: "pine-handle",
    name: "Pine Handle",
    description:
      "A light resin-striped pine handle, easy to shape and suited to everyday tools, weapons and crafted assemblies.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 10,
    sprite: "/assets/items/resources/components/pine-handle-atlas-v1.png",
  },
  {
    slug: "willow-handle",
    name: "Willow Handle",
    description:
      "A pale, gently flexible willow handle that absorbs strain in light tools, weapons and mechanisms.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 20,
    sprite: "/assets/items/resources/components/willow-handle-atlas-v1.png",
  },
  {
    slug: "ash-handle",
    name: "Ash Handle",
    description:
      "A dense straight-grained ash handle built for hard-wearing tools, weapons and load-bearing assemblies.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 55,
    sprite: "/assets/items/resources/components/ash-handle-atlas-v1.png",
  },
  {
    slug: "frostpine-handle",
    name: "Frostpine Handle",
    description:
      "A dry pale frostpine handle whose stable grain remains dependable in mountain weather and demanding work.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 95,
    sprite: "/assets/items/resources/components/frostpine-handle-atlas-v1.png",
  },
  {
    slug: "gloamwood-handle",
    name: "Gloamwood Handle",
    description:
      "A dark close-grained gloamwood handle suited to precise joinery, resilient fittings and exceptional crafted assemblies.",
    itemType: "MATERIAL",
    rarity: "EXQUISITE",
    price: 325,
    sprite: "/assets/items/resources/components/gloamwood-handle-atlas-v1.png",
  },
  {
    slug: "emberwood-handle",
    name: "Emberwood Handle",
    description:
      "A copper-red emberwood handle with heat-seasoned grain, made for high-grade tools, weapons and mechanisms.",
    itemType: "MATERIAL",
    rarity: "EPIC",
    price: 450,
    sprite: "/assets/items/resources/components/emberwood-handle-atlas-v1.png",
  },
  {
    slug: "ironbark-handle",
    name: "Ironbark Handle",
    description:
      "A heavy ironbark handle with stubborn dense grain for structural tools, weapons and hard-wearing stock.",
    itemType: "MATERIAL",
    rarity: "ELITE",
    price: 850,
    sprite: "/assets/items/resources/components/ironbark-handle-atlas-v1.png",
  },
  {
    slug: "saltcedar-handle",
    name: "Saltcedar Handle",
    description:
      "A close-grained seasoned saltcedar handle whose red heartwood withstands sea air, strain and long service.",
    itemType: "MATERIAL",
    rarity: "LEGENDARY",
    price: 1850,
    sprite: "/assets/items/resources/components/saltcedar-handle-atlas-v1.png",
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
  {
    slug: "cured-leather",
    name: "Cured Leather",
    description:
      "Supple hide cured with resin and oil, ready for straps, lining, cases and durable everyday gear.",
    itemType: "HIDE",
    rarity: "COMMON",
    price: 24,
    sprite: "/assets/items/resources/textiles/cured-leather-hide-v1.png",
  },
  {
    slug: "reinforced-boarhide",
    name: "Reinforced Boarhide",
    description:
      "Thick leather plates stitched and riveted for hard-wearing armor, packs and field gear.",
    itemType: "HIDE",
    rarity: "RARE",
    price: 110,
    sprite: "/assets/items/resources/textiles/reinforced-boarhide-v1.png",
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
    outputItemName: "Cured Leather",
    actionType: "TAILORING",
    requiredSkillLevel: 8,
    defaultSeconds: 30,
    yieldPerUnit: 1,
    xpPerUnit: 8,
    requirements: [
      { itemName: "Raw Hide", quantityPerUnit: 2 },
      { itemName: "Tempering Resin", quantityPerUnit: 1 },
    ],
  },
  {
    outputItemName: "Reinforced Boarhide",
    actionType: "TAILORING",
    requiredSkillLevel: 28,
    defaultSeconds: 65,
    yieldPerUnit: 1,
    xpPerUnit: 24,
    requirements: [
      { itemName: "Raw Boar Hide", quantityPerUnit: 2 },
      { itemName: "Cured Leather", quantityPerUnit: 1 },
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
  {
    outputItemName: "Birch Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 1,
    defaultSeconds: 18,
    yieldPerUnit: 1,
    xpPerUnit: 5,
    requirements: [{ itemName: "Birch Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Pine Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 1,
    defaultSeconds: 18,
    yieldPerUnit: 1,
    xpPerUnit: 5,
    requirements: [{ itemName: "Pine Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Willow Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 10,
    defaultSeconds: 24,
    yieldPerUnit: 1,
    xpPerUnit: 8,
    requirements: [{ itemName: "Willow Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Ash Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 40,
    defaultSeconds: 38,
    yieldPerUnit: 1,
    xpPerUnit: 16,
    requirements: [{ itemName: "Ash Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Frostpine Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 50,
    defaultSeconds: 46,
    yieldPerUnit: 1,
    xpPerUnit: 21,
    requirements: [{ itemName: "Frostpine Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Gloamwood Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 110,
    defaultSeconds: 76,
    yieldPerUnit: 1,
    xpPerUnit: 38,
    requirements: [{ itemName: "Gloamwood Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Emberwood Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 150,
    defaultSeconds: 86,
    yieldPerUnit: 1,
    xpPerUnit: 48,
    requirements: [{ itemName: "Emberwood Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Ironbark Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 175,
    defaultSeconds: 104,
    yieldPerUnit: 1,
    xpPerUnit: 60,
    requirements: [{ itemName: "Ironbark Plank", quantityPerUnit: 1 }],
  },
  {
    outputItemName: "Saltcedar Handle",
    actionType: "CARPENTRY",
    requiredSkillLevel: 210,
    defaultSeconds: 128,
    yieldPerUnit: 1,
    xpPerUnit: 82,
    requirements: [{ itemName: "Saltcedar Plank", quantityPerUnit: 1 }],
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
