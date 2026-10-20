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
    name: "Salt",
    description:
      "A tied ivory linen bag of coarse sea salt, a simple seasoning for a cook's everyday table.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 2,
    sprite: "/assets/items/resources/seasonings/salt-cooking-v1.png",
  },
  {
    name: "Pepper",
    description:
      "A dark burlap bag of fragrant black peppercorns, ready to be cracked into a savory dish.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 3,
    sprite: "/assets/items/resources/seasonings/pepper-cooking-v1.png",
  },
  {
    name: "Sugar",
    description:
      "A squat glass jar of amber raw sugar crystals for glazes, roasting and sweet dishes.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 3,
    sprite: "/assets/items/resources/seasonings/sugar-cooking-v1.png",
  },
  {
    name: "Sunflower Oil",
    description:
      "A green glass bottle of golden sunflower oil, pressed for frying and roasting.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/resources/seasonings/sunflower-oil-cooking-v1.png",
  },
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
    slug: "salted-perch-potato-hash",
    name: "Salted Perch & Potato Hash",
    description:
      "Crisp perch and browned potato tossed with thyme and a pinch of coarse sea salt.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 20,
    sprite:
      "/assets/items/consumables/food/salted-perch-potato-hash-cooking-v1.png",
    requiredSkillLevel: 4,
    defaultSeconds: 14,
    xpPerUnit: 4,
    requiredRecipeName: null,
    foodEffectSeconds: 900,
    foodEffectStats: [{ statType: "HEALTH_REGEN", value: 2 }],
    requirements: [
      { itemName: "Perch", quantityPerUnit: 1 },
      { itemName: "Potato", quantityPerUnit: 1 },
      { itemName: "Thyme", quantityPerUnit: 1 },
      { itemName: "Salt", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "peppery-mushroom-game-skewers",
    name: "Peppery Mushroom Game Skewers",
    description:
      "Char-grilled game and mushrooms with sweet bell pepper and a generous peppery crust.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 26,
    sprite:
      "/assets/items/consumables/food/peppery-mushroom-game-skewers-cooking-v1.png",
    requiredSkillLevel: 8,
    defaultSeconds: 16,
    xpPerUnit: 5,
    requiredRecipeName: null,
    foodEffectSeconds: 900,
    foodEffectStats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 2 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 3 },
    ],
    requirements: [
      { itemName: "Game Meat", quantityPerUnit: 1 },
      { itemName: "Mushrooms", quantityPerUnit: 1 },
      { itemName: "Bell Pepper", quantityPerUnit: 1 },
      { itemName: "Pepper", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "sugar-roasted-apples-chestnuts",
    name: "Sugar-Roasted Apples & Chestnuts",
    description:
      "Apple wedges and chestnuts roasted with amber sugar, then finished with fresh mint.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 18,
    sprite:
      "/assets/items/consumables/food/sugar-roasted-apples-chestnuts-cooking-v1.png",
    requiredSkillLevel: 12,
    defaultSeconds: 16,
    xpPerUnit: 6,
    requiredRecipeName: null,
    foodEffectSeconds: 900,
    foodEffectStats: [{ statType: "MANA_REGEN", value: 2 }],
    requirements: [
      { itemName: "Apple", quantityPerUnit: 1 },
      { itemName: "Chestnuts", quantityPerUnit: 1 },
      { itemName: "Sugar", quantityPerUnit: 1 },
      { itemName: "Mint", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "crisp-sunflower-minnows",
    name: "Crisp Sunflower Minnows",
    description:
      "Tiny river minnows fried crisp in sunflower oil with pepper and lemon balm.",
    itemType: "FOOD",
    rarity: "COMMON",
    price: 22,
    sprite:
      "/assets/items/consumables/food/crisp-sunflower-minnows-cooking-v1.png",
    requiredSkillLevel: 16,
    defaultSeconds: 18,
    xpPerUnit: 7,
    requiredRecipeName: null,
    foodEffectSeconds: 1200,
    foodEffectStats: [{ statType: "ATTACK_SPEED", value: 2 }],
    requirements: [
      { itemName: "Silver Minnow", quantityPerUnit: 2 },
      { itemName: "Pepper", quantityPerUnit: 1 },
      { itemName: "Lemon Balm", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
      { itemName: "Salt", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "herbed-boar-pepper-potatoes",
    name: "Herbed Boar & Pepper Potatoes",
    description:
      "Seared boar with roast potato, sweet bell pepper and thyme from a hot iron pan.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 54,
    sprite:
      "/assets/items/consumables/food/herbed-boar-pepper-potatoes-cooking-v1.png",
    requiredSkillLevel: 24,
    defaultSeconds: 25,
    xpPerUnit: 10,
    requiredRecipeName: null,
    foodEffectSeconds: 1800,
    foodEffectStats: [
      { statType: "PHYSICAL_DAMAGE_MIN", value: 3 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 4 },
    ],
    requirements: [
      { itemName: "Wild Boar Meat", quantityPerUnit: 1 },
      { itemName: "Potato", quantityPerUnit: 2 },
      { itemName: "Bell Pepper", quantityPerUnit: 1 },
      { itemName: "Thyme", quantityPerUnit: 1 },
      { itemName: "Salt", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
    ],
  },
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
  {
    slug: "basil-pike-tomato-relish",
    name: "Basil Pike with Tomato Relish",
    description:
      "Bog pike seared with pepper and sunflower oil, finished with a bright basil tomato relish.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 72,
    sprite:
      "/assets/items/consumables/food/basil-pike-tomato-relish-cooking-v1.png",
    requiredSkillLevel: 38,
    defaultSeconds: 32,
    xpPerUnit: 15,
    requiredRecipeName: null,
    foodEffectSeconds: 1800,
    foodEffectStats: [
      { statType: "ACCURACY", value: 4 },
      { statType: "HEALTH_REGEN", value: 2 },
    ],
    requirements: [
      { itemName: "Bog Pike", quantityPerUnit: 1 },
      { itemName: "Tomato", quantityPerUnit: 2 },
      { itemName: "Basil", quantityPerUnit: 1 },
      { itemName: "Pepper", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "cranberry-glazed-game-roast",
    name: "Cranberry-Glazed Game Roast",
    description:
      "Game meat roasted with onion, rosemary and a sharp-sweet cranberry glaze.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 88,
    sprite:
      "/assets/items/consumables/food/cranberry-glazed-game-roast-cooking-v1.png",
    requiredSkillLevel: 48,
    defaultSeconds: 37,
    xpPerUnit: 18,
    requiredRecipeName: null,
    foodEffectSeconds: 2400,
    foodEffectStats: [
      { statType: "HEALTH", value: 26 },
      { statType: "EVASION_MELEE", value: 3 },
    ],
    requirements: [
      { itemName: "Game Meat", quantityPerUnit: 2 },
      { itemName: "Cranberries", quantityPerUnit: 1 },
      { itemName: "Onion", quantityPerUnit: 1 },
      { itemName: "Rosemary", quantityPerUnit: 1 },
      { itemName: "Sugar", quantityPerUnit: 1 },
      { itemName: "Salt", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "frostberry-char-asparagus",
    name: "Frostberry Char with Asparagus",
    description:
      "Cold-water char served with crisp asparagus and a tart frostberry pan sauce.",
    itemType: "FOOD",
    rarity: "UNCOMMON",
    price: 100,
    sprite:
      "/assets/items/consumables/food/frostberry-char-asparagus-cooking-v1.png",
    requiredSkillLevel: 60,
    defaultSeconds: 43,
    xpPerUnit: 22,
    requiredRecipeName: null,
    foodEffectSeconds: 2400,
    foodEffectStats: [
      { statType: "COLD_RESIST", value: 12 },
      { statType: "MANA_REGEN", value: 2 },
    ],
    requirements: [
      { itemName: "Frostscale Char", quantityPerUnit: 1 },
      { itemName: "Frostberries", quantityPerUnit: 1 },
      { itemName: "Asparagus", quantityPerUnit: 1 },
      { itemName: "Pepper", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
      { itemName: "Salt", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "citrus-eel-chili-braise",
    name: "Citrus Eel & Chili Braise",
    description:
      "Dark Caldrath eel braised with orange, chili and onion in a savory, fragrant glaze.",
    itemType: "FOOD",
    rarity: "RARE",
    price: 150,
    sprite:
      "/assets/items/consumables/food/citrus-eel-chili-braise-cooking-v1.png",
    requiredSkillLevel: 86,
    defaultSeconds: 58,
    xpPerUnit: 32,
    requiredRecipeName: null,
    foodEffectSeconds: 2700,
    foodEffectStats: [
      { statType: "MAGIC_DAMAGE_MIN", value: 4 },
      { statType: "MAGIC_DAMAGE_MAX", value: 6 },
      { statType: "MAGIC_RESIST", value: 5 },
    ],
    requirements: [
      { itemName: "Caldrath Eel", quantityPerUnit: 1 },
      { itemName: "Orange", quantityPerUnit: 1 },
      { itemName: "Chili Pepper", quantityPerUnit: 1 },
      { itemName: "Onion", quantityPerUnit: 1 },
      { itemName: "Salt", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "pomegranate-boar-skewers",
    name: "Pomegranate Boar Skewers",
    description:
      "Charred boar and sweet pepper skewers brightened with pomegranate and rosemary.",
    itemType: "FOOD",
    rarity: "RARE",
    price: 180,
    sprite:
      "/assets/items/consumables/food/pomegranate-boar-skewers-cooking-v1.png",
    requiredSkillLevel: 102,
    defaultSeconds: 64,
    xpPerUnit: 38,
    requiredRecipeName: null,
    foodEffectSeconds: 2700,
    foodEffectStats: [
      { statType: "CRITICAL_CHANCE", value: 3 },
      { statType: "PHYSICAL_DAMAGE_MIN", value: 2 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 3 },
    ],
    requirements: [
      { itemName: "Wild Boar Meat", quantityPerUnit: 2 },
      { itemName: "Pomegranates", quantityPerUnit: 1 },
      { itemName: "Bell Pepper", quantityPerUnit: 1 },
      { itemName: "Rosemary", quantityPerUnit: 1 },
      { itemName: "Pepper", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "sage-roasted-game-wild-plums",
    name: "Sage-Roasted Game with Wild Plums",
    description:
      "Roasted game with sweet wild plums, potato and sage from a slow, careful fire.",
    itemType: "FOOD",
    rarity: "RARE",
    price: 210,
    sprite:
      "/assets/items/consumables/food/sage-roasted-game-wild-plums-cooking-v1.png",
    requiredSkillLevel: 122,
    defaultSeconds: 70,
    xpPerUnit: 44,
    requiredRecipeName: null,
    foodEffectSeconds: 2700,
    foodEffectStats: [
      { statType: "FIRE_RESIST", value: 12 },
      { statType: "HEALTH", value: 45 },
    ],
    requirements: [
      { itemName: "Game Meat", quantityPerUnit: 2 },
      { itemName: "Wild Plums", quantityPerUnit: 1 },
      { itemName: "Potato", quantityPerUnit: 1 },
      { itemName: "Sage", quantityPerUnit: 1 },
      { itemName: "Sugar", quantityPerUnit: 1 },
      { itemName: "Pepper", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "blackfin-tuna-starfruit-salsa",
    name: "Blackfin Tuna with Starfruit Salsa",
    description:
      "Seared blackfin tuna with sharp starfruit salsa, chili and fresh wild chives.",
    itemType: "FOOD",
    rarity: "EPIC",
    price: 340,
    sprite:
      "/assets/items/consumables/food/blackfin-tuna-starfruit-salsa-cooking-v1.png",
    requiredSkillLevel: 152,
    defaultSeconds: 80,
    xpPerUnit: 52,
    requiredRecipeName: null,
    foodEffectSeconds: 3000,
    foodEffectStats: [
      { statType: "LUCK", value: 4 },
      { statType: "ACCURACY", value: 8 },
    ],
    requirements: [
      { itemName: "Blackfin Tuna", quantityPerUnit: 1 },
      { itemName: "Starfruit", quantityPerUnit: 1 },
      { itemName: "Wild Chives", quantityPerUnit: 1 },
      { itemName: "Chili Pepper", quantityPerUnit: 1 },
      { itemName: "Salt", quantityPerUnit: 1 },
      { itemName: "Sunflower Oil", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "golden-date-boar-roast",
    name: "Golden-Date Boar Roast",
    description:
      "A festival roast of wild boar lacquered with golden dates, onion and thyme.",
    itemType: "FOOD",
    rarity: "EPIC",
    price: 320,
    sprite:
      "/assets/items/consumables/food/golden-date-boar-roast-cooking-v1.png",
    requiredSkillLevel: 176,
    defaultSeconds: 84,
    xpPerUnit: 56,
    requiredRecipeName: null,
    foodEffectSeconds: 3600,
    foodEffectStats: [
      { statType: "HEALTH", value: 60 },
      { statType: "PHYSICAL_DAMAGE_MIN", value: 4 },
      { statType: "PHYSICAL_DAMAGE_MAX", value: 5 },
    ],
    requirements: [
      { itemName: "Wild Boar Meat", quantityPerUnit: 2 },
      { itemName: "Golden Dates", quantityPerUnit: 1 },
      { itemName: "Onion", quantityPerUnit: 1 },
      { itemName: "Thyme", quantityPerUnit: 1 },
      { itemName: "Sugar", quantityPerUnit: 1 },
      { itemName: "Salt", quantityPerUnit: 1 },
      { itemName: "Pepper", quantityPerUnit: 1 },
    ],
  },
] as const satisfies readonly CookingDishDefinition[];

export const COOKING_EXISTING_INGREDIENT_TYPES = {
  Perch: "FISH",
  "Silver Minnow": "FISH",
  "River Trout": "FISH",
  "Bog Pike": "FISH",
  "Frostscale Char": "FISH",
  "Caldrath Eel": "FISH",
  "Blackfin Tuna": "FISH",
  Tomato: "VEGETABLE",
  Carrot: "VEGETABLE",
  "Game Meat": "MEAT",
  Mushrooms: "VEGETABLE",
  Apple: "FOOD",
  Chestnuts: "VEGETABLE",
  Mint: "HERB",
  "Lemon Balm": "HERB",
  Thyme: "HERB",
  Basil: "HERB",
  Cranberries: "VEGETABLE",
  Rosemary: "HERB",
  Frostberries: "FOOD",
  Orange: "FOOD",
  Pomegranates: "VEGETABLE",
  Sage: "HERB",
  "Wild Plums": "VEGETABLE",
  Starfruit: "VEGETABLE",
  "Wild Chives": "HERB",
  "Golden Dates": "FOOD",
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
