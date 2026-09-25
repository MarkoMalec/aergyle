import type { ItemRarity, ItemType } from "../../src/generated/prisma/enums";

export interface GatheringItemDefinition {
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  sprite: string;
  requiredSkillLevel: number;
}

export const GATHERING_ITEMS = [
  {
    name: "Mushrooms",
    description:
      "A cluster of earthy woodland mushrooms, useful in hearty meals and restorative brews.",
    itemType: "VEGETABLE",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/resources/forage/mushrooms-gathering-v1.png",
    requiredSkillLevel: 1,
  },
  {
    name: "Blackberries",
    description:
      "Dark, sweet hedgerow berries gathered carefully before the birds find them.",
    itemType: "VEGETABLE",
    rarity: "COMMON",
    price: 4,
    sprite: "/assets/items/resources/forage/blackberries-gathering-v1.png",
    requiredSkillLevel: 1,
  },
  {
    name: "Cranberries",
    description:
      "Tart red berries from wet ground, prized for preserves and sharp sauces.",
    itemType: "VEGETABLE",
    rarity: "UNCOMMON",
    price: 7,
    sprite: "/assets/items/resources/forage/cranberries-gathering-v1.png",
    requiredSkillLevel: 12,
  },
  {
    name: "Chestnuts",
    description:
      "Glossy wild chestnuts that roast well and add substance to trail provisions.",
    itemType: "VEGETABLE",
    rarity: "UNCOMMON",
    price: 8,
    sprite: "/assets/items/resources/forage/chestnuts-gathering-v1.png",
    requiredSkillLevel: 15,
  },
  {
    name: "Wild Plums",
    description:
      "Small dusky plums with rich flesh, found on hardy trees far from tended roads.",
    itemType: "VEGETABLE",
    rarity: "RARE",
    price: 13,
    sprite: "/assets/items/resources/forage/wild-plums-gathering-v1.png",
    requiredSkillLevel: 30,
  },
  {
    name: "Wild Apples",
    description:
      "Weather-marked apples with a bright flavor, gathered from old untended orchards.",
    itemType: "VEGETABLE",
    rarity: "RARE",
    price: 15,
    sprite: "/assets/items/resources/forage/wild-apples-gathering-v1.png",
    requiredSkillLevel: 42,
  },
  {
    name: "Mint",
    description:
      "Fresh mint leaves with a cool scent, suited to tonics, teas, and bright sauces.",
    itemType: "HERB",
    rarity: "COMMON",
    price: 4,
    sprite: "/assets/items/resources/herbs/mint-gathering-v1.png",
    requiredSkillLevel: 1,
  },
  {
    name: "Chamomile",
    description:
      "Small golden-centered flowers traditionally steeped into a calming infusion.",
    itemType: "HERB",
    rarity: "UNCOMMON",
    price: 7,
    sprite: "/assets/items/resources/herbs/chamomile-gathering-v1.png",
    requiredSkillLevel: 3,
  },
  {
    name: "Thyme",
    description:
      "A fragrant culinary herb whose tiny leaves enrich soups, roasts, and remedies.",
    itemType: "HERB",
    rarity: "COMMON",
    price: 6,
    sprite: "/assets/items/resources/herbs/thyme-gathering-v1.png",
    requiredSkillLevel: 5,
  },
  {
    name: "Sage",
    description:
      "Soft silver-green leaves used in savory cooking and traditional preparations.",
    itemType: "HERB",
    rarity: "UNCOMMON",
    price: 9,
    sprite: "/assets/items/resources/herbs/sage-gathering-v1.png",
    requiredSkillLevel: 18,
  },
  {
    name: "Rosemary",
    description:
      "Resinous evergreen sprigs valued by cooks, alchemists, and traveling healers.",
    itemType: "HERB",
    rarity: "RARE",
    price: 12,
    sprite: "/assets/items/resources/herbs/rosemary-gathering-v1.png",
    requiredSkillLevel: 22,
  },
  {
    name: "Lavender",
    description:
      "Aromatic purple flower spikes kept for soothing draughts and careful alchemy.",
    itemType: "HERB",
    rarity: "RARE",
    price: 14,
    sprite: "/assets/items/resources/herbs/lavender-gathering-v1.png",
    requiredSkillLevel: 35,
  },
  {
    name: "Yarrow",
    description:
      "A feathery white-flowering field herb carried by healers for poultices, infusions and starter restoratives.",
    itemType: "HERB",
    rarity: "COMMON",
    price: 4,
    sprite: "/assets/items/resources/herbs/yarrow-alchemy-v1.png",
    requiredSkillLevel: 1,
  },
  {
    name: "Aloe",
    description:
      "A thick-leaved succulent whose clear gel cools burns and gives restorative brews their soothing body.",
    itemType: "HERB",
    rarity: "COMMON",
    price: 6,
    sprite: "/assets/items/resources/herbs/aloe-alchemy-v1.png",
    requiredSkillLevel: 5,
  },
  {
    name: "Ginseng",
    description:
      "A forked medicinal root valued by alchemists for deep, steady recovery preparations.",
    itemType: "HERB",
    rarity: "UNCOMMON",
    price: 12,
    sprite: "/assets/items/resources/herbs/ginseng-alchemy-v1.png",
    requiredSkillLevel: 18,
  },
  {
    name: "Echinacea",
    description:
      "Purple coneflower heads with a sharp, earthy tonic quality prized in stronger restorative draughts.",
    itemType: "HERB",
    rarity: "UNCOMMON",
    price: 16,
    sprite: "/assets/items/resources/herbs/echinacea-alchemy-v1.png",
    requiredSkillLevel: 28,
  },
  {
    name: "Amrans",
    description:
      "A rare silver-veined curative herb, gathered from high meadows and reserved for serious recovery work.",
    itemType: "HERB",
    rarity: "RARE",
    price: 40,
    sprite: "/assets/items/resources/herbs/amrans-alchemy-v1.png",
    requiredSkillLevel: 50,
  },
  {
    name: "Arkasu Bark",
    description:
      "Frost-pale alpine bark with clinging lichen, a scarce curative reagent that survives the harshest mountain wind.",
    itemType: "HERB",
    rarity: "EXQUISITE",
    price: 95,
    sprite: "/assets/items/resources/herbs/arkasu-bark-alchemy-v1.png",
    requiredSkillLevel: 80,
  },
] as const satisfies readonly GatheringItemDefinition[];

export const GATHERING_LOCATIONS = [
  {
    name: "Greenveil Plains",
    requiredGatheringLevel: 1,
    resources: [
      {
        itemName: "Mushrooms",
        baseChance: 0.52,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Blackberries",
        baseChance: 0.48,
        minQuantity: 2,
        maxQuantity: 4,
      },
      { itemName: "Mint", baseChance: 0.46, minQuantity: 1, maxQuantity: 3 },
      {
        itemName: "Chamomile",
        baseChance: 0.3,
        minQuantity: 1,
        maxQuantity: 2,
      },
      { itemName: "Thyme", baseChance: 0.38, minQuantity: 1, maxQuantity: 3 },
      { itemName: "Yarrow", baseChance: 0.42, minQuantity: 1, maxQuantity: 3 },
      { itemName: "Aloe", baseChance: 0.24, minQuantity: 1, maxQuantity: 2 },
    ],
  },
  {
    name: "Goblins Camp",
    requiredGatheringLevel: 12,
    resources: [
      {
        itemName: "Mushrooms",
        baseChance: 0.42,
        minQuantity: 2,
        maxQuantity: 4,
      },
      {
        itemName: "Cranberries",
        baseChance: 0.36,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Chestnuts",
        baseChance: 0.32,
        minQuantity: 1,
        maxQuantity: 3,
      },
      { itemName: "Sage", baseChance: 0.27, minQuantity: 1, maxQuantity: 2 },
      {
        itemName: "Rosemary",
        baseChance: 0.18,
        minQuantity: 1,
        maxQuantity: 2,
      },
      { itemName: "Ginseng", baseChance: 0.22, minQuantity: 1, maxQuantity: 2 },
      {
        itemName: "Echinacea",
        baseChance: 0.17,
        minQuantity: 1,
        maxQuantity: 2,
      },
    ],
  },
  {
    name: "Frostcrown Peaks",
    requiredGatheringLevel: 30,
    resources: [
      {
        itemName: "Cranberries",
        baseChance: 0.34,
        minQuantity: 2,
        maxQuantity: 4,
      },
      {
        itemName: "Wild Plums",
        baseChance: 0.22,
        minQuantity: 1,
        maxQuantity: 3,
      },
      { itemName: "Rosemary", baseChance: 0.2, minQuantity: 1, maxQuantity: 2 },
      {
        itemName: "Lavender",
        baseChance: 0.16,
        minQuantity: 1,
        maxQuantity: 2,
      },
      { itemName: "Amrans", baseChance: 0.12, minQuantity: 1, maxQuantity: 1 },
      {
        itemName: "Arkasu Bark",
        baseChance: 0.06,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
  },
  {
    name: "Ruins of Caldrath",
    requiredGatheringLevel: 42,
    resources: [
      {
        itemName: "Wild Apples",
        baseChance: 0.2,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Wild Plums",
        baseChance: 0.24,
        minQuantity: 1,
        maxQuantity: 3,
      },
      { itemName: "Sage", baseChance: 0.3, minQuantity: 1, maxQuantity: 3 },
      {
        itemName: "Rosemary",
        baseChance: 0.24,
        minQuantity: 1,
        maxQuantity: 2,
      },
      { itemName: "Lavender", baseChance: 0.2, minQuantity: 1, maxQuantity: 2 },
    ],
  },
] as const;

export const GATHERING_DURATIONS = [
  {
    label: "1 hour",
    durationSeconds: 3_600,
    requiredGatheringLevel: 0,
    rewardRolls: 3,
    quantityMultiplier: 1,
    xpReward: 18,
    sortOrder: 10,
  },
  {
    label: "2 hours",
    durationSeconds: 7_200,
    requiredGatheringLevel: 15,
    rewardRolls: 5,
    quantityMultiplier: 1.15,
    xpReward: 40,
    sortOrder: 20,
  },
  {
    label: "3 hours",
    durationSeconds: 10_800,
    requiredGatheringLevel: 50,
    rewardRolls: 7,
    quantityMultiplier: 1.35,
    xpReward: 66,
    sortOrder: 30,
  },
  {
    label: "4 hours",
    durationSeconds: 14_400,
    requiredGatheringLevel: 100,
    rewardRolls: 9,
    quantityMultiplier: 1.6,
    xpReward: 96,
    sortOrder: 40,
  },
] as const;

export function gatheringItemData(definition: GatheringItemDefinition) {
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
  } as const;
}
