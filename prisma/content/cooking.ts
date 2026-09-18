import type {
  ItemRarity,
  ItemType,
  StatType,
} from "../../src/generated/prisma/enums";

export const COOKING_RECIPE_SPRITE =
  "/assets/items/consumables/recipes/cooking-parchment-v1.png";

export interface CookingItemDefinition {
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  sprite: string;
  foodEffectSeconds?: number;
  foodEffectStats?: readonly { statType: StatType; value: number }[];
  seedGrowSeconds?: number;
  seedYieldItemName?: string;
  seedYieldMin?: number;
  seedYieldMax?: number;
  seedHarvestSeconds?: number;
  seedXp?: number;
}

export interface CookingSeedDefinition extends CookingItemDefinition {
  itemType: "SEED";
  seedGrowSeconds: number;
  seedYieldItemName: string;
  seedYieldMin: number;
  seedYieldMax: number;
  seedHarvestSeconds: number;
  seedXp: number;
}

export interface CookingDishDefinition extends CookingItemDefinition {
  slug: string;
  requiredSkillLevel: number;
  defaultSeconds: number;
  xpPerUnit: number;
  requiredRecipeName: string | null;
  foodEffectSeconds: number;
  foodEffectStats: readonly { statType: StatType; value: number }[];
  requirements: readonly {
    itemName: string;
    quantityPerUnit: number;
  }[];
}

export const COOKING_INGREDIENTS = [
  {
    name: "Potato",
    description:
      "A firm, earthy tuber that holds together well in stews and roasting pans.",
    itemType: "VEGETABLE",
    rarity: "COMMON",
    price: 3,
    sprite: "/assets/items/resources/vegetables/potato-cooking-v1.png",
  },
  {
    name: "Onion",
    description:
      "A sharp garden onion that turns sweet and fragrant over a steady flame.",
    itemType: "VEGETABLE",
    rarity: "COMMON",
    price: 3,
    sprite: "/assets/items/resources/vegetables/onion-cooking-v1.png",
  },
  {
    name: "Garlic",
    description:
      "A pungent bulb whose cloves turn mellow and savory in a hot pan.",
    itemType: "VEGETABLE",
    rarity: "COMMON",
    price: 4,
    sprite: "/assets/items/resources/vegetables/garlic-cooking-v2.png",
  },
  {
    name: "Bell Pepper",
    description:
      "A crisp red pepper with sweet flesh that softens beautifully over a flame.",
    itemType: "VEGETABLE",
    rarity: "COMMON",
    price: 4,
    sprite: "/assets/items/resources/vegetables/bell-pepper-cooking-v2.png",
  },
  {
    name: "Chili Pepper",
    description:
      "A slender scarlet pepper prized for the fierce heat it brings to a dish.",
    itemType: "VEGETABLE",
    rarity: "UNCOMMON",
    price: 6,
    sprite: "/assets/items/resources/vegetables/chili-pepper-cooking-v2.png",
  },
  {
    name: "Asparagus",
    description:
      "Tender green spears with an earthy flavor and a delicately crisp bite.",
    itemType: "VEGETABLE",
    rarity: "UNCOMMON",
    price: 7,
    sprite: "/assets/items/resources/vegetables/asparagus-cooking-v2.png",
  },
  {
    name: "Wild Boar Meat",
    description:
      "Rich, dark meat cut from a wild boar and ready for a careful cook.",
    itemType: "MEAT",
    rarity: "UNCOMMON",
    price: 18,
    sprite: "/assets/items/resources/meat/wild-boar-meat-cooking-v1.png",
  },
] as const satisfies readonly CookingItemDefinition[];

export const COOKING_SEEDS = [
  {
    name: "Potato seeds",
    description:
      "Sprouting seed potatoes ready to be planted in an open garden tile.",
    itemType: "SEED",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/resources/seeds/potato-seeds-cooking-v2.png",
    seedGrowSeconds: 14_400,
    seedYieldItemName: "Potato",
    seedYieldMin: 2,
    seedYieldMax: 4,
    seedHarvestSeconds: 5,
    seedXp: 12,
  },
  {
    name: "Onion seeds",
    description:
      "Tiny black onion seeds packed for sowing in an open garden tile.",
    itemType: "SEED",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/resources/seeds/onion-seeds-cooking-v2.png",
    seedGrowSeconds: 18_000,
    seedYieldItemName: "Onion",
    seedYieldMin: 2,
    seedYieldMax: 4,
    seedHarvestSeconds: 5,
    seedXp: 15,
  },
  {
    name: "Garlic seeds",
    description:
      "Selected garlic cloves already beginning to sprout, ready for planting.",
    itemType: "SEED",
    rarity: "COMMON",
    price: 6,
    sprite: "/assets/items/resources/seeds/garlic-seeds-cooking-v2.png",
    seedGrowSeconds: 19_800,
    seedYieldItemName: "Garlic",
    seedYieldMin: 2,
    seedYieldMax: 4,
    seedHarvestSeconds: 5,
    seedXp: 17,
  },
  {
    name: "Bell Pepper seeds",
    description:
      "Pale seeds gathered from a sweet red bell pepper and kept dry for sowing.",
    itemType: "SEED",
    rarity: "COMMON",
    price: 7,
    sprite: "/assets/items/resources/seeds/bell-pepper-seeds-cooking-v2.png",
    seedGrowSeconds: 21_600,
    seedYieldItemName: "Bell Pepper",
    seedYieldMin: 1,
    seedYieldMax: 3,
    seedHarvestSeconds: 5,
    seedXp: 19,
  },
  {
    name: "Chili Pepper seeds",
    description:
      "Fiery pepper seeds saved from a dried pod and ready for careful planting.",
    itemType: "SEED",
    rarity: "UNCOMMON",
    price: 9,
    sprite: "/assets/items/resources/seeds/chili-pepper-seeds-cooking-v2.png",
    seedGrowSeconds: 25_200,
    seedYieldItemName: "Chili Pepper",
    seedYieldMin: 1,
    seedYieldMax: 3,
    seedHarvestSeconds: 5,
    seedXp: 24,
  },
  {
    name: "Asparagus seeds",
    description:
      "Dark asparagus seeds sorted from ripe berries for a patient gardener.",
    itemType: "SEED",
    rarity: "UNCOMMON",
    price: 10,
    sprite: "/assets/items/resources/seeds/asparagus-seeds-cooking-v2.png",
    seedGrowSeconds: 28_800,
    seedYieldItemName: "Asparagus",
    seedYieldMin: 1,
    seedYieldMax: 3,
    seedHarvestSeconds: 5,
    seedXp: 28,
  },
] as const satisfies readonly CookingSeedDefinition[];

export const COOKING_RECIPES = [
  {
    name: "Recipe: River Trout Stew",
    description:
      "Consume this weathered recipe to permanently learn River Trout Stew.",
    itemType: "RECIPE",
    rarity: "UNCOMMON",
    price: 75,
    sprite: COOKING_RECIPE_SPRITE,
  },
  {
    name: "Recipe: Hunter's Skillet",
    description:
      "Consume this weathered recipe to permanently learn Hunter's Skillet.",
    itemType: "RECIPE",
    rarity: "UNCOMMON",
    price: 110,
    sprite: COOKING_RECIPE_SPRITE,
  },
  {
    name: "Recipe: Frostscale Chowder",
    description:
      "Consume this weathered recipe to permanently learn Frostscale Chowder.",
    itemType: "RECIPE",
    rarity: "RARE",
    price: 240,
    sprite: COOKING_RECIPE_SPRITE,
  },
  {
    name: "Recipe: Caldrath Eel Broth",
    description:
      "Consume this weathered recipe to permanently learn Caldrath Eel Broth.",
    itemType: "RECIPE",
    rarity: "RARE",
    price: 420,
    sprite: COOKING_RECIPE_SPRITE,
  },
  {
    name: "Recipe: Blackfin Feast",
    description:
      "Consume this weathered recipe to permanently learn the Blackfin Feast.",
    itemType: "RECIPE",
    rarity: "EPIC",
    price: 900,
    sprite: COOKING_RECIPE_SPRITE,
  },
] as const satisfies readonly CookingItemDefinition[];

export const COOKING_DISHES = [
  {
    slug: "pan-fried-perch",
    name: "Pan-fried Perch",
    description:
      "An early river catch fried crisp with mellow garlic in a seasoned iron pan.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 14,
    sprite: "/assets/items/consumables/food/pan-fried-perch-cooking-v2.png",
    requiredSkillLevel: 1,
    defaultSeconds: 12,
    xpPerUnit: 3,
    requiredRecipeName: null,
    foodEffectSeconds: 900,
    foodEffectStats: [{ statType: "HEALTH_REGEN", value: 2 }],
    requirements: [
      { itemName: "Perch", quantityPerUnit: 1 },
      { itemName: "Garlic", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "charred-silver-minnow",
    name: "Charred Silver Minnow",
    description:
      "A crisp little fish served with sweet roasted carrot; simple, hot and filling.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 14,
    sprite:
      "/assets/items/consumables/food/charred-silver-minnow-cooking-v1.png",
    requiredSkillLevel: 1,
    defaultSeconds: 12,
    xpPerUnit: 3,
    requiredRecipeName: null,
    foodEffectSeconds: 900,
    foodEffectStats: [{ statType: "HEALTH_REGEN", value: 2 }],
    requirements: [
      { itemName: "Silver Minnow", quantityPerUnit: 1 },
      { itemName: "Carrot", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "river-trout-stew",
    name: "River Trout Stew",
    description:
      "Tender river trout simmered with tomato and potato into a dependable hearth stew.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 30,
    sprite: "/assets/items/consumables/food/river-trout-stew-cooking-v1.png",
    requiredSkillLevel: 10,
    defaultSeconds: 20,
    xpPerUnit: 7,
    requiredRecipeName: "Recipe: River Trout Stew",
    foodEffectSeconds: 1800,
    foodEffectStats: [
      { statType: "HEALTH", value: 25 },
      { statType: "HEALTH_REGEN", value: 2 },
    ],
    requirements: [
      { itemName: "River Trout", quantityPerUnit: 1 },
      { itemName: "Tomato", quantityPerUnit: 2 },
      { itemName: "Potato", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "hunters-skillet",
    name: "Hunter's Skillet",
    description:
      "Seared wild boar with browned roots and onion, cooked hard in a black iron pan.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 65,
    sprite: "/assets/items/consumables/food/hunters-skillet-cooking-v1.png",
    requiredSkillLevel: 30,
    defaultSeconds: 28,
    xpPerUnit: 12,
    requiredRecipeName: "Recipe: Hunter's Skillet",
    foodEffectSeconds: 1800,
    foodEffectStats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 4 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 6 },
    ],
    requirements: [
      { itemName: "Wild Boar Meat", quantityPerUnit: 2 },
      { itemName: "Carrot", quantityPerUnit: 2 },
      { itemName: "Onion", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "frostscale-chowder",
    name: "Frostscale Chowder",
    description:
      "A thick mountain chowder of frostscale char, soft potato and mellow onion.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 80,
    sprite: "/assets/items/consumables/food/frostscale-chowder-cooking-v1.png",
    requiredSkillLevel: 50,
    defaultSeconds: 38,
    xpPerUnit: 19,
    requiredRecipeName: "Recipe: Frostscale Chowder",
    foodEffectSeconds: 2700,
    foodEffectStats: [
      { statType: "HEALTH", value: 30 },
      { statType: "COLD_RESIST", value: 10 },
    ],
    requirements: [
      { itemName: "Frostscale Char", quantityPerUnit: 1 },
      { itemName: "Potato", quantityPerUnit: 2 },
      { itemName: "Onion", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "caldrath-eel-broth",
    name: "Caldrath Eel Broth",
    description:
      "Dark eel broth brightened with tomato and onion, reconstructed from a ruined-city recipe.",
    itemType: "FOOD",
    rarity: "RARE",
    price: 145,
    sprite: "/assets/items/consumables/food/caldrath-eel-broth-cooking-v1.png",
    requiredSkillLevel: 80,
    defaultSeconds: 54,
    xpPerUnit: 30,
    requiredRecipeName: "Recipe: Caldrath Eel Broth",
    foodEffectSeconds: 2700,
    foodEffectStats: [
      { statType: "MAGIC_RESIST", value: 5 },
      { statType: "LUCK", value: 5 },
    ],
    requirements: [
      { itemName: "Caldrath Eel", quantityPerUnit: 1 },
      { itemName: "Tomato", quantityPerUnit: 2 },
      { itemName: "Onion", quantityPerUnit: 2 },
    ],
  },
  {
    slug: "blackfin-feast",
    name: "Blackfin Feast",
    description:
      "A lavish platter of blackfin tuna, roast boar and golden vegetables fit for a captain's table.",
    itemType: "FOOD",
    rarity: "EPIC",
    price: 390,
    sprite: "/assets/items/consumables/food/blackfin-feast-cooking-v1.png",
    requiredSkillLevel: 200,
    defaultSeconds: 88,
    xpPerUnit: 58,
    requiredRecipeName: "Recipe: Blackfin Feast",
    foodEffectSeconds: 3600,
    foodEffectStats: [
      { statType: "HEALTH", value: 75 },
      { statType: "PHYSICAL_DAMAGE_MIN", value: 5 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 8 },
      { statType: "LUCK", value: 5 },
    ],
    requirements: [
      { itemName: "Blackfin Tuna", quantityPerUnit: 1 },
      { itemName: "Wild Boar Meat", quantityPerUnit: 1 },
      { itemName: "Potato", quantityPerUnit: 2 },
      { itemName: "Tomato", quantityPerUnit: 2 },
    ],
  },
] as const satisfies readonly CookingDishDefinition[];

export const COOKING_EXISTING_INGREDIENT_TYPES = {
  Perch: "FISH",
  "Silver Minnow": "FISH",
  "River Trout": "FISH",
  "Frostscale Char": "FISH",
  "Caldrath Eel": "FISH",
  "Blackfin Tuna": "FISH",
  Tomato: "VEGETABLE",
  Carrot: "VEGETABLE",
} as const satisfies Readonly<Record<string, ItemType>>;

export const COOKING_ITEMS = [
  ...COOKING_INGREDIENTS,
  ...COOKING_SEEDS,
  ...COOKING_RECIPES,
  ...COOKING_DISHES,
] as const;

export function cookingItemCreateData(definition: CookingItemDefinition) {
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
    foodEffectSeconds: definition.foodEffectSeconds ?? null,
    seedGrowSeconds: definition.seedGrowSeconds ?? null,
    seedYieldMin: definition.seedYieldMin ?? null,
    seedYieldMax: definition.seedYieldMax ?? null,
    seedHarvestSeconds: definition.seedHarvestSeconds ?? null,
    seedXp: definition.seedXp ?? null,
  } as const;
}
