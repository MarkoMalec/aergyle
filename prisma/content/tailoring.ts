import type {
  ItemEquipTo,
  ItemRarity,
  ItemType,
  StatType,
} from "../../src/generated/prisma/enums";
import type { Prisma } from "../../src/generated/prisma/client";

export interface TailoringMaterialDefinition {
  name: string;
  description: string;
  itemType: "MATERIAL" | "HIDE";
  rarity: ItemRarity;
  price: number;
  sprite: string;
  requiredGatheringLevel: number;
}

export interface TailoringBlueprintDefinition {
  name: string;
  description: string;
  itemType: "BLUEPRINT";
  rarity: ItemRarity;
  price: number;
  sprite: string;
  requiredForItemName: string;
}

export interface TailoringGearDefinition {
  slug: string;
  name: string;
  description: string;
  itemType: ItemType;
  equipTo: ItemEquipTo;
  rarity: ItemRarity;
  requiredLevel: number;
  price: number;
  sprite: string;
  requiredSkillLevel: number;
  defaultSeconds: number;
  xpPerUnit: number;
  requiredBlueprintName: string;
  requirements: readonly {
    itemName: string;
    quantityPerUnit: number;
  }[];
  stats: Partial<Record<StatType, number>>;
}

export const TAILORING_MATERIALS = [
  {
    name: "Cloth Scraps",
    description:
      "Salvaged pieces of sturdy woven cloth, sorted and bundled for a tailor's table.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/resources/textiles/cloth-scraps-tailoring-v1.png",
    requiredGatheringLevel: 1,
  },
  {
    name: "Soft Hide",
    description:
      "A supple prepared hide suited to flexible reinforcement, straps and hard-wearing soles.",
    itemType: "HIDE",
    rarity: "COMMON",
    price: 8,
    sprite: "/assets/items/resources/textiles/soft-hide-tailoring-v1.png",
    requiredGatheringLevel: 3,
  },
  {
    name: "Spider Silk",
    description:
      "Fine pearlescent fibers prized for seams that remain light, resilient and nearly silent.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 22,
    sprite: "/assets/items/resources/textiles/spider-silk-tailoring-v1.png",
    requiredGatheringLevel: 12,
  },
] as const satisfies readonly TailoringMaterialDefinition[];

export const TAILORING_BLUEPRINTS = [
  {
    name: "Blueprint: Fieldweave Gloves",
    description:
      "A physical cutting pattern required alongside the materials for each pair of Fieldweave Gloves.",
    itemType: "BLUEPRINT",
    rarity: "COMMON",
    price: 55,
    sprite:
      "/assets/items/resources/blueprints/fieldweave-gloves-blueprint-tailoring-v1.png",
    requiredForItemName: "Fieldweave Gloves",
  },
  {
    name: "Blueprint: Fieldweave Trailboots",
    description:
      "A physical cutting pattern required alongside the materials for each pair of Fieldweave Trailboots.",
    itemType: "BLUEPRINT",
    rarity: "UNCOMMON",
    price: 90,
    sprite:
      "/assets/items/resources/blueprints/fieldweave-trailboots-blueprint-tailoring-v1.png",
    requiredForItemName: "Fieldweave Trailboots",
  },
  {
    name: "Blueprint: Fieldweave Leggings",
    description:
      "A physical cutting pattern required alongside the materials for each pair of Fieldweave Leggings.",
    itemType: "BLUEPRINT",
    rarity: "UNCOMMON",
    price: 145,
    sprite:
      "/assets/items/resources/blueprints/fieldweave-leggings-blueprint-tailoring-v1.png",
    requiredForItemName: "Fieldweave Leggings",
  },
  {
    name: "Blueprint: Fieldweave Tunic",
    description:
      "A physical cutting pattern required alongside the materials for each Fieldweave Tunic.",
    itemType: "BLUEPRINT",
    rarity: "RARE",
    price: 240,
    sprite:
      "/assets/items/resources/blueprints/fieldweave-tunic-blueprint-tailoring-v1.png",
    requiredForItemName: "Fieldweave Tunic",
  },
] as const satisfies readonly TailoringBlueprintDefinition[];

export const TAILORING_GEAR = [
  {
    slug: "fieldweave-gloves",
    name: "Fieldweave Gloves",
    description:
      "Supple working gloves with silk-stitched palms that keep a gatherer's touch sure and precise.",
    itemType: "GLOVES",
    equipTo: "gloves",
    rarity: "COMMON",
    requiredLevel: 1,
    price: 85,
    sprite: "/assets/items/armor/fieldweave-gloves-tailoring-v1.png",
    requiredSkillLevel: 1,
    defaultSeconds: 30,
    xpPerUnit: 8,
    requiredBlueprintName: "Blueprint: Fieldweave Gloves",
    requirements: [
      { itemName: "Cloth Scraps", quantityPerUnit: 3 },
      { itemName: "Soft Hide", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 1, GATHERING_EFFICIENCY: 2, LUCK: 1 },
  },
  {
    slug: "fieldweave-trailboots",
    name: "Fieldweave Trailboots",
    description:
      "Quiet, hard-wearing trail boots made for ranging farther without losing a careful footing.",
    itemType: "BOOTS",
    equipTo: "boots",
    rarity: "COMMON",
    requiredLevel: 3,
    price: 130,
    sprite: "/assets/items/armor/fieldweave-trailboots-tailoring-v1.png",
    requiredSkillLevel: 4,
    defaultSeconds: 45,
    xpPerUnit: 12,
    requiredBlueprintName: "Blueprint: Fieldweave Trailboots",
    requirements: [
      { itemName: "Cloth Scraps", quantityPerUnit: 2 },
      { itemName: "Soft Hide", quantityPerUnit: 4 },
    ],
    stats: { ARMOR: 2, GATHERING_EFFICIENCY: 3, MOVEMENT_SPEED: 2 },
  },
  {
    slug: "fieldweave-leggings",
    name: "Fieldweave Leggings",
    description:
      "Flexible woodland trousers whose reinforced knees and deep pockets reward patient fieldwork.",
    itemType: "GREAVES",
    equipTo: "greaves",
    rarity: "UNCOMMON",
    requiredLevel: 7,
    price: 220,
    sprite: "/assets/items/armor/fieldweave-leggings-tailoring-v1.png",
    requiredSkillLevel: 10,
    defaultSeconds: 75,
    xpPerUnit: 20,
    requiredBlueprintName: "Blueprint: Fieldweave Leggings",
    requirements: [
      { itemName: "Cloth Scraps", quantityPerUnit: 6 },
      { itemName: "Soft Hide", quantityPerUnit: 3 },
    ],
    stats: { ARMOR: 3, GATHERING_EFFICIENCY: 4, LUCK: 1 },
  },
  {
    slug: "fieldweave-tunic",
    name: "Fieldweave Tunic",
    description:
      "A light, pocketed tunic sewn with spider silk for gatherers who work beyond the familiar paths.",
    itemType: "CHESTPLATE",
    equipTo: "chest",
    rarity: "RARE",
    requiredLevel: 12,
    price: 390,
    sprite: "/assets/items/armor/fieldweave-tunic-tailoring-v1.png",
    requiredSkillLevel: 15,
    defaultSeconds: 120,
    xpPerUnit: 32,
    requiredBlueprintName: "Blueprint: Fieldweave Tunic",
    requirements: [
      { itemName: "Cloth Scraps", quantityPerUnit: 8 },
      { itemName: "Soft Hide", quantityPerUnit: 4 },
      { itemName: "Spider Silk", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 4, GATHERING_EFFICIENCY: 5, LUCK: 2 },
  },
] as const satisfies readonly TailoringGearDefinition[];

export const TAILORING_GATHERING_POOLS = [
  {
    locationName: "Greenveil Plains",
    resources: [
      { itemName: "Cloth Scraps", baseChance: 0.3, min: 1, max: 3 },
      { itemName: "Soft Hide", baseChance: 0.22, min: 1, max: 2 },
    ],
  },
  {
    locationName: "Goblins Camp",
    resources: [
      { itemName: "Cloth Scraps", baseChance: 0.28, min: 1, max: 3 },
      { itemName: "Soft Hide", baseChance: 0.3, min: 1, max: 3 },
      { itemName: "Spider Silk", baseChance: 0.12, min: 1, max: 1 },
    ],
  },
  {
    locationName: "Frostcrown Peaks",
    resources: [
      { itemName: "Soft Hide", baseChance: 0.25, min: 1, max: 3 },
      { itemName: "Spider Silk", baseChance: 0.18, min: 1, max: 2 },
    ],
  },
  {
    locationName: "Ruins of Caldrath",
    resources: [
      { itemName: "Cloth Scraps", baseChance: 0.24, min: 2, max: 4 },
      { itemName: "Spider Silk", baseChance: 0.25, min: 1, max: 2 },
    ],
  },
] as const;

export const TAILORING_ITEMS = [
  ...TAILORING_MATERIALS,
  ...TAILORING_BLUEPRINTS,
  ...TAILORING_GEAR,
] as const;

export function tailoringRequirementsForGear(gear: TailoringGearDefinition) {
  return [
    { itemName: gear.requiredBlueprintName, quantityPerUnit: 1 },
    ...gear.requirements,
  ] as const;
}

export function tailoringItemCreateData(
  definition:
    | TailoringMaterialDefinition
    | TailoringBlueprintDefinition
    | TailoringGearDefinition,
): Prisma.ItemCreateInput {
  const gear = "stats" in definition ? definition : null;
  return {
    name: definition.name,
    description: definition.description,
    itemType: definition.itemType,
    rarity: definition.rarity,
    price: definition.price,
    sprite: definition.sprite,
    equipTo: gear?.equipTo ?? null,
    stackable: !gear,
    maxStackSize: gear ? 1 : 9999,
    requiredLevel: gear?.requiredLevel ?? 1,
    flipNegativeStatsWithRarity: false,
    armor: gear?.stats.ARMOR ?? 0,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    stats: gear
      ? {
          create: Object.entries(gear.stats).map(([statType, value]) => ({
            statType: statType as StatType,
            value,
          })),
        }
      : undefined,
  };
}
