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
  acquisition: "GATHERING" | "IMPORT";
}

/** A textile produced at the tailor's bench and used by higher-end clothing. */
export interface TailoringTextileDefinition {
  name: string;
  description: string;
  itemType: "MATERIAL";
  rarity: ItemRarity;
  price: number;
  sprite: string;
  requiredSkillLevel: number;
  defaultSeconds: number;
  xpPerUnit: number;
  requirements: readonly {
    itemName: string;
    quantityPerUnit: number;
  }[];
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
    acquisition: "GATHERING",
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
    acquisition: "GATHERING",
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
    acquisition: "GATHERING",
  },
  {
    name: "Raw Wool",
    description:
      "Springy sheep's fleece, washed but still waiting for a skilled hand to card and weave it.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 10,
    sprite: "/assets/items/resources/textiles/raw-wool-tailoring-v1.png",
    requiredGatheringLevel: 5,
    acquisition: "GATHERING",
  },
  {
    name: "Flax Fiber",
    description:
      "Long, dry fibers stripped from flax stalks, ready to be spun and woven into linen.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 7,
    sprite: "/assets/items/resources/textiles/flax-fiber-tailoring-v1.png",
    requiredGatheringLevel: 8,
    acquisition: "GATHERING",
  },
  {
    name: "Silk Bolt",
    description:
      "An imported bolt of lustrous silk, precious enough that a tailor measures every cut twice.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 95,
    sprite: "/assets/items/resources/textiles/silk-bolt-tailoring-v1.png",
    requiredGatheringLevel: 18,
    acquisition: "IMPORT",
  },
] as const satisfies readonly TailoringMaterialDefinition[];

export const TAILORING_TEXTILES = [
  {
    name: "Linen Cloth",
    description:
      "A clean, pale bolt of flax linen: breathable, durable and a versatile base for fine tailoring.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 18,
    sprite: "/assets/items/resources/textiles/linen-cloth-tailoring-v1.png",
    requiredSkillLevel: 3,
    defaultSeconds: 25,
    xpPerUnit: 7,
    requirements: [{ itemName: "Flax Fiber", quantityPerUnit: 3 }],
  },
  {
    name: "Wool Fabric",
    description:
      "A sturdy, insulating bolt woven from carded wool; ideal for practical outerwear.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 34,
    sprite: "/assets/items/resources/textiles/wool-fabric-tailoring-v1.png",
    requiredSkillLevel: 6,
    defaultSeconds: 35,
    xpPerUnit: 10,
    requirements: [
      { itemName: "Raw Wool", quantityPerUnit: 3 },
      { itemName: "Linen Cloth", quantityPerUnit: 1 },
    ],
  },
  {
    name: "Satin",
    description:
      "Silk woven with a glossy face and a smooth drape, reserved for ceremonial and noble work.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 160,
    sprite: "/assets/items/resources/textiles/satin-tailoring-v1.png",
    requiredSkillLevel: 16,
    defaultSeconds: 75,
    xpPerUnit: 24,
    requirements: [{ itemName: "Silk Bolt", quantityPerUnit: 2 }],
  },
  {
    name: "Brocade",
    description:
      "Heavy silk fabric with gold-threaded patterning, made for garments meant to be noticed.",
    itemType: "MATERIAL",
    rarity: "EPIC",
    price: 310,
    sprite: "/assets/items/resources/textiles/brocade-tailoring-v1.png",
    requiredSkillLevel: 24,
    defaultSeconds: 110,
    xpPerUnit: 38,
    requirements: [
      { itemName: "Satin", quantityPerUnit: 1 },
      { itemName: "Silk Bolt", quantityPerUnit: 1 },
    ],
  },
  {
    name: "Damask",
    description:
      "Reversible patterned cloth whose subtle woven motifs reward a closer look.",
    itemType: "MATERIAL",
    rarity: "EPIC",
    price: 290,
    sprite: "/assets/items/resources/textiles/damask-tailoring-v1.png",
    requiredSkillLevel: 27,
    defaultSeconds: 120,
    xpPerUnit: 42,
    requirements: [
      { itemName: "Satin", quantityPerUnit: 1 },
      { itemName: "Linen Cloth", quantityPerUnit: 2 },
    ],
  },
  {
    name: "Flemish Cloth",
    description:
      "A renowned, tightly woven trade cloth with a dense hand and exceptional longevity.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 145,
    sprite: "/assets/items/resources/textiles/flemish-cloth-tailoring-v1.png",
    requiredSkillLevel: 30,
    defaultSeconds: 135,
    xpPerUnit: 48,
    requirements: [
      { itemName: "Wool Fabric", quantityPerUnit: 2 },
      { itemName: "Linen Cloth", quantityPerUnit: 2 },
    ],
  },
] as const satisfies readonly TailoringTextileDefinition[];

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
    stats: { ARMOR: 1, GATHERING_EFFICIENCY: 1, LUCK: 1 },
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
    stats: { ARMOR: 2, GATHERING_EFFICIENCY: 1, MOVEMENT_SPEED: 1.1 },
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
    stats: { ARMOR: 4, GATHERING_EFFICIENCY: 2, LUCK: 1 },
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
      { itemName: "Wool Fabric", quantityPerUnit: 3 },
      { itemName: "Soft Hide", quantityPerUnit: 4 },
      { itemName: "Spider Silk", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 7, GATHERING_EFFICIENCY: 3, LUCK: 2 },
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
      { itemName: "Raw Wool", baseChance: 0.24, min: 1, max: 3 },
      { itemName: "Spider Silk", baseChance: 0.12, min: 1, max: 1 },
    ],
  },
  {
    locationName: "Frostcrown Peaks",
    resources: [
      { itemName: "Soft Hide", baseChance: 0.25, min: 1, max: 3 },
      { itemName: "Spider Silk", baseChance: 0.18, min: 1, max: 2 },
      { itemName: "Raw Wool", baseChance: 0.3, min: 1, max: 3 },
      { itemName: "Flax Fiber", baseChance: 0.16, min: 1, max: 2 },
    ],
  },
  {
    locationName: "Ruins of Caldrath",
    resources: [
      { itemName: "Cloth Scraps", baseChance: 0.24, min: 2, max: 4 },
      { itemName: "Spider Silk", baseChance: 0.25, min: 1, max: 2 },
      { itemName: "Flax Fiber", baseChance: 0.28, min: 1, max: 3 },
    ],
  },
] as const;

export const TAILORING_ITEMS = [
  ...TAILORING_MATERIALS,
  ...TAILORING_TEXTILES,
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
    | TailoringTextileDefinition
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
