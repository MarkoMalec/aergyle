import type { ItemRarity, ItemType } from "../../src/generated/prisma/enums";
import type { Prisma } from "../../src/generated/prisma/client";

export interface CarpentryPlankDefinition {
  slug: string;
  name: string;
  description: string;
  sourceLogName: string;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  sprite: string;
  requiredSkillLevel: number;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
}

export const CARPENTRY_PLANKS = [
  {
    slug: "oak-plank",
    name: "Oak Plank",
    description:
      "A sturdy golden oak board, rough-sawn and ready for dependable joinery.",
    sourceLogName: "Oak Log",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 3,
    sprite: "/assets/items/resources/planks/oak-plank-carpentry-v1.png",
    requiredSkillLevel: 1,
    defaultSeconds: 12,
    yieldPerUnit: 1,
    xpPerUnit: 3,
  },
  {
    slug: "birch-plank",
    name: "Birch Plank",
    description:
      "A smooth pale birch board whose fine, even grain takes careful shaping well.",
    sourceLogName: "Birch Log",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 3,
    sprite: "/assets/items/resources/planks/birch-plank-carpentry-v1.png",
    requiredSkillLevel: 1,
    defaultSeconds: 12,
    yieldPerUnit: 1,
    xpPerUnit: 3,
  },
  {
    slug: "pine-plank",
    name: "Pine Plank",
    description:
      "A light resin-striped pine board, easy for a new carpenter to shape.",
    sourceLogName: "Pine Log",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/resources/planks/pine-plank-carpentry-v1.png",
    requiredSkillLevel: 1,
    defaultSeconds: 12,
    yieldPerUnit: 1,
    xpPerUnit: 3,
  },
  {
    slug: "willow-plank",
    name: "Willow Plank",
    description:
      "A pale flexible willow board whose gentle grain bends before it breaks.",
    sourceLogName: "Willow Log",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 10,
    sprite: "/assets/items/resources/planks/willow-plank-carpentry-v1.png",
    requiredSkillLevel: 10,
    defaultSeconds: 20,
    yieldPerUnit: 1,
    xpPerUnit: 7,
  },
  {
    slug: "ash-plank",
    name: "Ash Plank",
    description:
      "A dense straight-grained ash board suited to handles and hard-wearing frames.",
    sourceLogName: "Ash Log",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 28,
    sprite: "/assets/items/resources/planks/ash-plank-carpentry-v1.png",
    requiredSkillLevel: 40,
    defaultSeconds: 32,
    yieldPerUnit: 1,
    xpPerUnit: 14,
  },
  {
    slug: "frostpine-plank",
    name: "Frostpine Plank",
    description:
      "A cold, dry frostpine board whose pale blue grain stays stable in mountain weather.",
    sourceLogName: "Frostpine Log",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 50,
    sprite: "/assets/items/resources/planks/frostpine-plank-carpentry-v1.png",
    requiredSkillLevel: 50,
    defaultSeconds: 40,
    yieldPerUnit: 1,
    xpPerUnit: 19,
  },
  {
    slug: "elderwood-plank",
    name: "Elderwood Plank",
    description:
      "A heavy elderwood board cut from ancient, close-ringed heartwood.",
    sourceLogName: "Elderwood Log",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 110,
    sprite: "/assets/items/resources/planks/elderwood-plank-carpentry-v1.png",
    requiredSkillLevel: 80,
    defaultSeconds: 56,
    yieldPerUnit: 1,
    xpPerUnit: 28,
  },
  {
    slug: "emberwood-plank",
    name: "Emberwood Plank",
    description:
      "A copper-red emberwood board with dark heat-seasoned grain, solid and cold to the touch.",
    sourceLogName: "Emberwood Log",
    itemType: "MATERIAL",
    rarity: "EPIC",
    price: 240,
    sprite: "/assets/items/resources/planks/emberwood-plank-carpentry-v1.png",
    requiredSkillLevel: 150,
    defaultSeconds: 78,
    yieldPerUnit: 1,
    xpPerUnit: 45,
  },
] as const satisfies readonly CarpentryPlankDefinition[];

export function carpentryRequirementsForPlank(plank: CarpentryPlankDefinition) {
  return [{ itemName: plank.sourceLogName, quantityPerUnit: 1 }] as const;
}

export function carpentryPlankItemCreateData(
  definition: CarpentryPlankDefinition,
): Prisma.ItemCreateInput {
  return {
    name: definition.name,
    description: definition.description,
    itemType: definition.itemType,
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
