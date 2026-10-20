import type {
  ItemRarity,
  ItemType,
  StatType,
} from "../../src/generated/prisma/enums";

export interface GatheringItemDefinition {
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  sprite: string;
  requiredSkillLevel: number;
  /** Raw fruit can be both an immediate provision and a future recipe input. */
  healingAmount?: number;
  foodEffectSeconds?: number;
  foodEffectStats?: readonly { statType: StatType; value: number }[];
}

export const GATHERING_BASE_ITEMS = [
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

/**
 * Fruit ingredients gathered in the wild. FOOD entries are deliberately raw,
 * lightweight provisions as well as valid Cooking requirements; VEGETABLE is
 * the existing ingredient type for fruit intended solely for recipes.
 */
export const GATHERING_FRUITS = [
  {
    name: "Apple",
    description:
      "A crisp orchard apple with sweet-tart flesh, good on the trail or sliced into a future dessert.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 7,
    sprite: "/assets/items/resources/fruits/apple-foraging-v1.png",
    requiredSkillLevel: 1,
    healingAmount: 8,
    foodEffectSeconds: 300,
    foodEffectStats: [{ statType: "HEALTH_REGEN", value: 1 }],
  },
  {
    name: "Pear",
    description:
      "A tender green-gold pear with cool, fragrant juice. Eat it fresh or save it for a recipe.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 7,
    sprite: "/assets/items/resources/fruits/pear-foraging-v1.png",
    requiredSkillLevel: 1,
    healingAmount: 8,
    foodEffectSeconds: 300,
    foodEffectStats: [{ statType: "MANA_REGEN", value: 1 }],
  },
  {
    name: "Strawberries",
    description:
      "Bright field strawberries, sweet enough for preserves, pastries, or a simple fruit salad.",
    itemType: "VEGETABLE",
    rarity: "COMMON",
    price: 6,
    sprite: "/assets/items/resources/fruits/strawberries-foraging-v1.png",
    requiredSkillLevel: 3,
  },
  {
    name: "Blueberries",
    description:
      "Dusky wild blueberries with a delicate bloom, a snack that sharpens a gatherer's eye.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 8,
    sprite: "/assets/items/resources/fruits/blueberries-foraging-v1.png",
    requiredSkillLevel: 5,
    healingAmount: 10,
    foodEffectSeconds: 420,
    foodEffectStats: [{ statType: "LUCK", value: 1 }],
  },
  {
    name: "Raspberries",
    description:
      "Soft red raspberries gathered from thorny canes, ideal for jam, sauce, and sweet fillings.",
    itemType: "VEGETABLE",
    rarity: "COMMON",
    price: 7,
    sprite: "/assets/items/resources/fruits/raspberries-foraging-v1.png",
    requiredSkillLevel: 10,
  },
  {
    name: "Grapes",
    description:
      "A ripe vine cluster of dark grapes. Their juice restores a little strength before the cook claims the rest.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 11,
    sprite: "/assets/items/resources/fruits/grapes-foraging-v1.png",
    requiredSkillLevel: 15,
    healingAmount: 12,
    foodEffectSeconds: 600,
    foodEffectStats: [
      { statType: "HEALTH_REGEN", value: 1 },
      { statType: "MANA_REGEN", value: 1 },
    ],
  },
  {
    name: "Figs",
    description:
      "Honeyed purple figs with a jewel-red interior, valued for rich sauces and baked dishes.",
    itemType: "VEGETABLE",
    rarity: "UNCOMMON",
    price: 10,
    sprite: "/assets/items/resources/fruits/figs-foraging-v1.png",
    requiredSkillLevel: 18,
  },
  {
    name: "Peaches",
    description:
      "Velvety sunset peaches with fragrant flesh. A fresh bite gives a brief forager's lift.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 13,
    sprite: "/assets/items/resources/fruits/peaches-foraging-v1.png",
    requiredSkillLevel: 22,
    healingAmount: 15,
    foodEffectSeconds: 600,
    foodEffectStats: [{ statType: "GATHERING_EFFICIENCY", value: 2 }],
  },
  {
    name: "Blood Oranges",
    description:
      "Deep-crimson citrus from sun-warmed ruin groves, bracing when eaten and vivid in sauces.",
    itemType: "FOOD",
    rarity: "RARE",
    price: 18,
    sprite: "/assets/items/resources/fruits/blood-oranges-foraging-v1.png",
    requiredSkillLevel: 42,
    healingAmount: 20,
    foodEffectSeconds: 900,
    foodEffectStats: [{ statType: "GATHERING_EFFICIENCY", value: 3 }],
  },
  {
    name: "Orange",
    description:
      "A bright, ordinary orange from the old Caldrath groves, refreshing on the trail and useful in sweet or savory recipes.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 13,
    sprite: "/assets/items/resources/fruits/orange-foraging-v1.png",
    requiredSkillLevel: 42,
    healingAmount: 16,
    foodEffectSeconds: 720,
    foodEffectStats: [{ statType: "MANA_REGEN", value: 1 }],
  },
  {
    name: "Pomegranates",
    description:
      "A heavy red pomegranate bursting with ruby arils for reductions, salads, and spiced rice.",
    itemType: "VEGETABLE",
    rarity: "RARE",
    price: 16,
    sprite: "/assets/items/resources/fruits/pomegranates-foraging-v1.png",
    requiredSkillLevel: 45,
  },
  {
    name: "Golden Dates",
    description:
      "Dense amber dates that make excellent trail fare or a deeply sweet cooking ingredient.",
    itemType: "FOOD",
    rarity: "RARE",
    price: 21,
    sprite: "/assets/items/resources/fruits/golden-dates-foraging-v1.png",
    requiredSkillLevel: 50,
    healingAmount: 25,
    foodEffectSeconds: 900,
    foodEffectStats: [{ statType: "HEALTH_REGEN", value: 2 }],
  },
  {
    name: "Frostberries",
    description:
      "Translucent blue berries gathered in cold air; their clean juice steadies a traveler's focus.",
    itemType: "FOOD",
    rarity: "RARE",
    price: 23,
    sprite: "/assets/items/resources/fruits/frostberries-foraging-v1.png",
    requiredSkillLevel: 48,
    healingAmount: 22,
    foodEffectSeconds: 900,
    foodEffectStats: [{ statType: "MANA_REGEN", value: 2 }],
  },
  {
    name: "Cloudberries",
    description:
      "Golden alpine berries with a sharp perfume, best kept intact for delicate preserves and desserts.",
    itemType: "VEGETABLE",
    rarity: "RARE",
    price: 17,
    sprite: "/assets/items/resources/fruits/cloudberries-foraging-v1.png",
    requiredSkillLevel: 36,
  },
  {
    name: "Moon Melon",
    description:
      "A rare pale mountain melon with cool, dense flesh prized for chilled dishes and festival sweets.",
    itemType: "VEGETABLE",
    rarity: "EXQUISITE",
    price: 55,
    sprite: "/assets/items/resources/fruits/moon-melon-foraging-v1.png",
    requiredSkillLevel: 68,
  },
  {
    name: "Starfruit",
    description:
      "Golden five-ridged fruit from old Caldrath groves, a spectacular ingredient for fine recipes.",
    itemType: "VEGETABLE",
    rarity: "EXQUISITE",
    price: 60,
    sprite: "/assets/items/resources/fruits/starfruit-foraging-v1.png",
    requiredSkillLevel: 75,
  },
] as const satisfies readonly GatheringItemDefinition[];

/** Ten additional culinary and alchemical plants distributed among the regions. */
export const GATHERING_HERBS = [
  {
    name: "Basil",
    description:
      "Glossy, sweet-scented leaves that brighten sauces, soups, and simple field meals.",
    itemType: "HERB",
    rarity: "COMMON",
    price: 4,
    sprite: "/assets/items/resources/herbs/basil-foraging-v1.png",
    requiredSkillLevel: 1,
  },
  {
    name: "Wild Chives",
    description:
      "Fine onion-scented blades with violet blossoms, gathered for broths and savory butter.",
    itemType: "HERB",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/resources/herbs/wild-chives-foraging-v1.png",
    requiredSkillLevel: 5,
  },
  {
    name: "Lemon Balm",
    description:
      "A bright citrus-scented leaf used in teas, syrups, and cooling preparations.",
    itemType: "HERB",
    rarity: "UNCOMMON",
    price: 7,
    sprite: "/assets/items/resources/herbs/lemon-balm-foraging-v1.png",
    requiredSkillLevel: 9,
  },
  {
    name: "Marjoram",
    description:
      "Soft, floral sprigs that lend gentle warmth to meat, mushroom, and vegetable dishes.",
    itemType: "HERB",
    rarity: "COMMON",
    price: 6,
    sprite: "/assets/items/resources/herbs/marjoram-foraging-v1.png",
    requiredSkillLevel: 12,
  },
  {
    name: "Tarragon",
    description:
      "Narrow aromatic leaves with a lively anise note, favored in refined sauces.",
    itemType: "HERB",
    rarity: "UNCOMMON",
    price: 9,
    sprite: "/assets/items/resources/herbs/tarragon-foraging-v1.png",
    requiredSkillLevel: 19,
  },
  {
    name: "Stinging Nettle",
    description:
      "Serrated leaves that must be handled carefully, but cook down into a nourishing green.",
    itemType: "HERB",
    rarity: "UNCOMMON",
    price: 10,
    sprite: "/assets/items/resources/herbs/stinging-nettle-foraging-v1.png",
    requiredSkillLevel: 25,
  },
  {
    name: "Wintergreen",
    description:
      "Waxy leaves and red berries with a cold, clean scent for teas, tonics, and mountain fare.",
    itemType: "HERB",
    rarity: "RARE",
    price: 14,
    sprite: "/assets/items/resources/herbs/wintergreen-foraging-v1.png",
    requiredSkillLevel: 36,
  },
  {
    name: "Icecap Moss",
    description:
      "Pale alpine moss carrying a mineral-fresh chill, scarce outside high frozen stone.",
    itemType: "HERB",
    rarity: "RARE",
    price: 20,
    sprite: "/assets/items/resources/herbs/icecap-moss-foraging-v1.png",
    requiredSkillLevel: 48,
  },
  {
    name: "Cinderleaf",
    description:
      "Charcoal-edged crimson leaves from the warmed cracks of Caldrath's old stonework.",
    itemType: "HERB",
    rarity: "RARE",
    price: 24,
    sprite: "/assets/items/resources/herbs/cinderleaf-foraging-v1.png",
    requiredSkillLevel: 55,
  },
  {
    name: "Ghost Orchid",
    description:
      "An elusive ivory orchid gathered only from hidden ruins, reserved for the finest infusions.",
    itemType: "HERB",
    rarity: "EXQUISITE",
    price: 60,
    sprite: "/assets/items/resources/herbs/ghost-orchid-foraging-v1.png",
    requiredSkillLevel: 70,
  },
] as const satisfies readonly GatheringItemDefinition[];

export const GATHERING_ITEMS = [
  ...GATHERING_BASE_ITEMS,
  ...GATHERING_FRUITS,
  ...GATHERING_HERBS,
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
      { itemName: "Apple", baseChance: 0.43, minQuantity: 1, maxQuantity: 3 },
      { itemName: "Pear", baseChance: 0.36, minQuantity: 1, maxQuantity: 3 },
      {
        itemName: "Strawberries",
        baseChance: 0.35,
        minQuantity: 2,
        maxQuantity: 4,
      },
      {
        itemName: "Blueberries",
        baseChance: 0.28,
        minQuantity: 2,
        maxQuantity: 4,
      },
      { itemName: "Basil", baseChance: 0.34, minQuantity: 1, maxQuantity: 3 },
      {
        itemName: "Wild Chives",
        baseChance: 0.29,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Lemon Balm",
        baseChance: 0.21,
        minQuantity: 1,
        maxQuantity: 2,
      },
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
      {
        itemName: "Raspberries",
        baseChance: 0.32,
        minQuantity: 2,
        maxQuantity: 4,
      },
      { itemName: "Grapes", baseChance: 0.27, minQuantity: 1, maxQuantity: 3 },
      { itemName: "Figs", baseChance: 0.24, minQuantity: 1, maxQuantity: 3 },
      {
        itemName: "Peaches",
        baseChance: 0.21,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Marjoram",
        baseChance: 0.25,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Tarragon",
        baseChance: 0.2,
        minQuantity: 1,
        maxQuantity: 2,
      },
      {
        itemName: "Stinging Nettle",
        baseChance: 0.23,
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
      {
        itemName: "Frostberries",
        baseChance: 0.24,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Cloudberries",
        baseChance: 0.2,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Moon Melon",
        baseChance: 0.09,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemName: "Wintergreen",
        baseChance: 0.2,
        minQuantity: 1,
        maxQuantity: 2,
      },
      {
        itemName: "Icecap Moss",
        baseChance: 0.14,
        minQuantity: 1,
        maxQuantity: 2,
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
      {
        itemName: "Blood Oranges",
        baseChance: 0.22,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Orange",
        baseChance: 0.27,
        minQuantity: 1,
        maxQuantity: 3,
      },
      {
        itemName: "Pomegranates",
        baseChance: 0.18,
        minQuantity: 1,
        maxQuantity: 2,
      },
      {
        itemName: "Golden Dates",
        baseChance: 0.14,
        minQuantity: 1,
        maxQuantity: 2,
      },
      {
        itemName: "Starfruit",
        baseChance: 0.09,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemName: "Cinderleaf",
        baseChance: 0.13,
        minQuantity: 1,
        maxQuantity: 2,
      },
      {
        itemName: "Ghost Orchid",
        baseChance: 0.06,
        minQuantity: 1,
        maxQuantity: 1,
      },
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
    healingAmount: definition.healingAmount ?? null,
    foodEffectSeconds: definition.foodEffectSeconds ?? null,
  } as const;
}
