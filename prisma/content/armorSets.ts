import type { Prisma } from "../../src/generated/prisma/client";
import type {
  ItemEquipTo,
  ItemRarity,
  ItemType,
  StatType,
  VocationalActionType,
} from "../../src/generated/prisma/enums";

type ArmorCraftAction =
  | "ALCHEMY"
  | "BLACKSMITHING"
  | "CARPENTRY"
  | "TAILORING"
  | "WEAPONSMITHING";

export interface ArmorSetItemDefinition {
  slug: string;
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  sprite: string;
  seedGrowSeconds?: number;
  seedYieldItemName?: string;
  seedYieldMin?: number;
  seedYieldMax?: number;
  seedHarvestSeconds?: number;
  seedXp?: number;
}

export interface ArmorSetCraftDefinition extends ArmorSetItemDefinition {
  actionType: ArmorCraftAction;
  requiredSkillLevel: number;
  defaultSeconds: number;
  xpPerUnit: number;
  requirements: readonly {
    itemName: string;
    quantityPerUnit: number;
  }[];
}

export interface ArmorSetGearDefinition extends ArmorSetCraftDefinition {
  equipTo: ItemEquipTo;
  requiredLevel: number;
  requiredBlueprintName: string;
  stats: Partial<Record<StatType, number>>;
}

export interface ArmorSetBlueprintDefinition extends ArmorSetItemDefinition {
  itemType: "BLUEPRINT";
  requiredForItemName: string;
}

export interface ArmorSetGardenSeedDefinition extends ArmorSetItemDefinition {
  itemType: "SEED";
  seedGrowSeconds: number;
  seedYieldItemName: string;
  seedYieldMin: number;
  seedYieldMax: number;
  seedHarvestSeconds: number;
  seedXp: number;
}

export const ARMOR_SET_EXISTING_DEPENDENCY_TYPES = {
  Mint: "HERB",
  Chamomile: "HERB",
  Rosemary: "HERB",
  Lavender: "HERB",
  "Cloth Scraps": "MATERIAL",
  "Spider Silk": "MATERIAL",
  "Animal Sinew": "MATERIAL",
  "Thick Fur": "HIDE",
  "Tempering Resin": "MATERIAL",
  "Hardened Leather": "HIDE",
  "Dusk Oil": "MATERIAL",
  "Oak Plank": "MATERIAL",
  "Emberwood Log": "LOG",
  "Iron Ingot": "INGOT",
  "Frostsilver Ingot": "INGOT",
  "Doomsteel Ingot": "INGOT",
  "Frostscale Char": "FISH",
} as const satisfies Readonly<Record<string, ItemType>>;

export const ARMOR_SET_GATHERING_MATERIALS = [
  {
    slug: "cinder-fiber",
    name: "Cinder Fiber",
    description:
      "Coarse volcanic plant fiber gathered from Mount Doom's ash-choked slopes; stubborn, light and heat-resistant when woven.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 32,
    sprite: "/assets/items/resources/textiles/cinder-fiber-armor-sets-v1.png",
    locationName: "Mount Doom",
    locationRequiredGatheringLevel: 85,
    requiredSkillLevel: 85,
    baseChance: 0.16,
    minQuantity: 1,
    maxQuantity: 2,
  },
] as const satisfies readonly (ArmorSetItemDefinition & {
  locationName: string;
  locationRequiredGatheringLevel: number;
  requiredSkillLevel: number;
  baseChance: number;
  minQuantity: number;
  maxQuantity: number;
})[];

export const ARMOR_SET_GARDEN_YIELD = {
  slug: "emberbloom",
  name: "Emberbloom",
  description:
    "A heat-loving red flower whose petals release a stable ember pigment when carefully steeped.",
  itemType: "HERB",
  rarity: "RARE",
  price: 30,
  sprite: "/assets/items/resources/herbs/emberbloom-armor-sets-v1.png",
} as const satisfies ArmorSetItemDefinition;

export const ARMOR_SET_GARDEN_SEED = {
  slug: "emberbloom-seeds",
  name: "Emberbloom Seeds",
  description:
    "Dark glossy seeds from a heat-loving Emberbloom, prepared for a tended garden tile.",
  itemType: "SEED",
  rarity: "RARE",
  price: 48,
  sprite: "/assets/items/resources/seeds/emberbloom-seeds-armor-sets-v1.png",
  seedGrowSeconds: 43_200,
  seedYieldItemName: "Emberbloom",
  seedYieldMin: 2,
  seedYieldMax: 4,
  seedHarvestSeconds: 8,
  seedXp: 55,
} as const satisfies ArmorSetGardenSeedDefinition;

export const ARMOR_SET_GARDEN_ITEMS = [
  ARMOR_SET_GARDEN_YIELD,
  ARMOR_SET_GARDEN_SEED,
] as const;

export const ARMOR_SET_COMPONENTS = [
  {
    slug: "verdant-dye",
    name: "Verdant Dye",
    description:
      "A resin-bound green dye that fixes deeply into cloth without stiffening its weave.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 34,
    sprite:
      "/assets/items/resources/armor-components/verdant-dye-armor-sets-v1.png",
    actionType: "ALCHEMY",
    requiredSkillLevel: 10,
    defaultSeconds: 35,
    xpPerUnit: 10,
    requirements: [
      { itemName: "Mint", quantityPerUnit: 2 },
      { itemName: "Chamomile", quantityPerUnit: 1 },
      { itemName: "Tempering Resin", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "mossweave-bolt",
    name: "Mossweave Bolt",
    description:
      "Dense green cloth woven with silk and sinew; light enough for travel but hard to tear on brambles.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 84,
    sprite:
      "/assets/items/resources/armor-components/mossweave-bolt-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 18,
    defaultSeconds: 60,
    xpPerUnit: 20,
    requirements: [
      { itemName: "Cloth Scraps", quantityPerUnit: 5 },
      { itemName: "Spider Silk", quantityPerUnit: 2 },
      { itemName: "Animal Sinew", quantityPerUnit: 2 },
      { itemName: "Verdant Dye", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "ironbark-lamella",
    name: "Ironbark Lamella",
    description:
      "Resin-sealed oak plates faced with iron, curved and drilled for rugged layered armor.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 142,
    sprite:
      "/assets/items/resources/armor-components/ironbark-lamella-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 28,
    defaultSeconds: 70,
    xpPerUnit: 28,
    requirements: [
      { itemName: "Oak Plank", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
      { itemName: "Iron Ingot", quantityPerUnit: 1 },
      { itemName: "Tempering Resin", quantityPerUnit: 2 },
    ],
  },
  {
    slug: "winter-tannin",
    name: "Winter Tannin",
    description:
      "A cold-curing herbal liquor that keeps leather supple through freezing spray and mountain wind.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 96,
    sprite:
      "/assets/items/resources/armor-components/winter-tannin-armor-sets-v1.png",
    actionType: "ALCHEMY",
    requiredSkillLevel: 44,
    defaultSeconds: 50,
    xpPerUnit: 24,
    requirements: [
      { itemName: "Rosemary", quantityPerUnit: 2 },
      { itemName: "Lavender", quantityPerUnit: 2 },
      { itemName: "Tempering Resin", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "frostscale-leather",
    name: "Frostscale Leather",
    description:
      "Cold-water fish skin bonded to thick fur with Winter Tannin, producing flexible leather that sheds icy spray.",
    itemType: "HIDE",
    rarity: "RARE",
    price: 168,
    sprite:
      "/assets/items/resources/textiles/frostscale-leather-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 55,
    defaultSeconds: 80,
    xpPerUnit: 36,
    requirements: [
      { itemName: "Frostscale Char", quantityPerUnit: 2 },
      { itemName: "Thick Fur", quantityPerUnit: 1 },
      { itemName: "Winter Tannin", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "frostsilver-wire",
    name: "Frostsilver Wire",
    description:
      "Fine, high-tension Frostsilver wire drawn for armor seams, articulated fittings and precise combat work.",
    itemType: "MATERIAL",
    rarity: "EXQUISITE",
    price: 205,
    sprite:
      "/assets/items/resources/armor-components/frostsilver-wire-armor-sets-v1.png",
    actionType: "WEAPONSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 75,
    xpPerUnit: 42,
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 1 },
      { itemName: "Animal Sinew", quantityPerUnit: 2 },
      { itemName: "Dusk Oil", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "emberwood-charcoal",
    name: "Emberwood Charcoal",
    description:
      "Slow-burned Emberwood charcoal that holds a dry, concentrated heat for dyes and forge work.",
    itemType: "MATERIAL",
    rarity: "RARE",
    price: 88,
    sprite:
      "/assets/items/resources/armor-components/emberwood-charcoal-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 70,
    defaultSeconds: 60,
    xpPerUnit: 32,
    requirements: [{ itemName: "Emberwood Log", quantityPerUnit: 1 }],
  },
  {
    slug: "cinder-dye",
    name: "Cinder Dye",
    description:
      "A deep red-black pigment distilled from Emberbloom and charcoal, designed to survive forge heat and ash.",
    itemType: "MATERIAL",
    rarity: "EPIC",
    price: 176,
    sprite:
      "/assets/items/resources/armor-components/cinder-dye-armor-sets-v1.png",
    actionType: "ALCHEMY",
    requiredSkillLevel: 85,
    defaultSeconds: 70,
    xpPerUnit: 44,
    requirements: [
      { itemName: "Emberbloom", quantityPerUnit: 2 },
      { itemName: "Emberwood Charcoal", quantityPerUnit: 1 },
      { itemName: "Dusk Oil", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "doomsteel-links",
    name: "Doomsteel Links",
    description:
      "Dark forged links, oil-blackened and leather-bound so they can reinforce cloth without tearing it apart.",
    itemType: "MATERIAL",
    rarity: "EPIC",
    price: 310,
    sprite:
      "/assets/items/resources/armor-components/doomsteel-links-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 100,
    defaultSeconds: 90,
    xpPerUnit: 55,
    requirements: [
      { itemName: "Doomsteel Ingot", quantityPerUnit: 1 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
      { itemName: "Dusk Oil", quantityPerUnit: 2 },
    ],
  },
  {
    slug: "cindercloth-bolt",
    name: "Cindercloth Bolt",
    description:
      "A heavy bolt of Cinder Fiber cloth stitched around Doomsteel Links; supple enough to drape and stubborn against heat.",
    itemType: "MATERIAL",
    rarity: "EPIC",
    price: 460,
    sprite:
      "/assets/items/resources/textiles/cindercloth-bolt-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 105,
    xpPerUnit: 64,
    requirements: [
      { itemName: "Cinder Fiber", quantityPerUnit: 5 },
      { itemName: "Spider Silk", quantityPerUnit: 3 },
      { itemName: "Cinder Dye", quantityPerUnit: 1 },
      { itemName: "Doomsteel Links", quantityPerUnit: 1 },
    ],
  },
] as const satisfies readonly ArmorSetCraftDefinition[];

function blueprintNameForArmor(gearName: string) {
  return "Blueprint: " + gearName;
}

export const ARMOR_SET_GEAR = [
  {
    slug: "mossweave-hood",
    name: "Mossweave Hood",
    description:
      "A soft, rain-shedding hood with a sinew-bound brim for foragers who prefer quiet cover.",
    itemType: "HELMET",
    equipTo: "head",
    rarity: "UNCOMMON",
    requiredLevel: 18,
    price: 130,
    sprite: "/assets/items/armor/mossweave-hood-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 20,
    defaultSeconds: 80,
    xpPerUnit: 28,
    requiredBlueprintName: blueprintNameForArmor("Mossweave Hood"),
    requirements: [
      { itemName: "Mossweave Bolt", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 7, GATHERING_EFFICIENCY: 2, LUCK: 1 },
  },
  {
    slug: "mossweave-vest",
    name: "Mossweave Vest",
    description:
      "A layered travel vest sewn from Mossweave and leather, built to protect without hindering a long day on the trail.",
    itemType: "CHESTPLATE",
    equipTo: "chest",
    rarity: "UNCOMMON",
    requiredLevel: 18,
    price: 280,
    sprite: "/assets/items/armor/mossweave-vest-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 20,
    defaultSeconds: 130,
    xpPerUnit: 45,
    requiredBlueprintName: blueprintNameForArmor("Mossweave Vest"),
    requirements: [
      { itemName: "Mossweave Bolt", quantityPerUnit: 4 },
      { itemName: "Hardened Leather", quantityPerUnit: 3 },
    ],
    stats: { ARMOR: 14, GATHERING_EFFICIENCY: 3, HEALTH: 6 },
  },
  {
    slug: "mossweave-mantle",
    name: "Mossweave Mantle",
    description:
      "Silk-lined shoulder cloth that turns thorns and rain while keeping a hunter's movements quiet.",
    itemType: "PAULDRONS",
    equipTo: "pauldrons",
    rarity: "UNCOMMON",
    requiredLevel: 18,
    price: 190,
    sprite: "/assets/items/armor/mossweave-mantle-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 20,
    defaultSeconds: 100,
    xpPerUnit: 35,
    requiredBlueprintName: blueprintNameForArmor("Mossweave Mantle"),
    requirements: [
      { itemName: "Mossweave Bolt", quantityPerUnit: 3 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 9, GATHERING_EFFICIENCY: 2, HUNTING_EFFICIENCY: 2 },
  },
  {
    slug: "mossweave-bracers",
    name: "Mossweave Bracers",
    description:
      "Leather-capped wraps that keep sleeves clear of brambles and a gatherer's wrists protected.",
    itemType: "BRACERS",
    equipTo: "bracers",
    rarity: "UNCOMMON",
    requiredLevel: 18,
    price: 115,
    sprite: "/assets/items/armor/mossweave-bracers-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 20,
    defaultSeconds: 70,
    xpPerUnit: 24,
    requiredBlueprintName: blueprintNameForArmor("Mossweave Bracers"),
    requirements: [
      { itemName: "Mossweave Bolt", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 5, GATHERING_EFFICIENCY: 2 },
  },
  {
    slug: "mossweave-gloves",
    name: "Mossweave Gloves",
    description:
      "Fine silk-backed gloves that preserve a sure grip on bark, roots and delicate finds.",
    itemType: "GLOVES",
    equipTo: "gloves",
    rarity: "UNCOMMON",
    requiredLevel: 18,
    price: 110,
    sprite: "/assets/items/armor/mossweave-gloves-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 20,
    defaultSeconds: 70,
    xpPerUnit: 24,
    requiredBlueprintName: blueprintNameForArmor("Mossweave Gloves"),
    requirements: [
      { itemName: "Mossweave Bolt", quantityPerUnit: 2 },
      { itemName: "Animal Sinew", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 4, GATHERING_EFFICIENCY: 3 },
  },
  {
    slug: "mossweave-trousers",
    name: "Mossweave Trousers",
    description:
      "Flexible field trousers with reinforced knees and hidden pockets for a day of careful collecting.",
    itemType: "GREAVES",
    equipTo: "greaves",
    rarity: "UNCOMMON",
    requiredLevel: 18,
    price: 225,
    sprite: "/assets/items/armor/mossweave-trousers-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 20,
    defaultSeconds: 115,
    xpPerUnit: 40,
    requiredBlueprintName: blueprintNameForArmor("Mossweave Trousers"),
    requirements: [
      { itemName: "Mossweave Bolt", quantityPerUnit: 4 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 10, GATHERING_EFFICIENCY: 2, MOVEMENT_SPEED: 1 },
  },
  {
    slug: "mossweave-trailboots",
    name: "Mossweave Trailboots",
    description:
      "Quiet, leather-soled boots that cover ground quickly without sacrificing a sure footing.",
    itemType: "BOOTS",
    equipTo: "boots",
    rarity: "UNCOMMON",
    requiredLevel: 18,
    price: 155,
    sprite: "/assets/items/armor/mossweave-trailboots-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 20,
    defaultSeconds: 90,
    xpPerUnit: 30,
    requiredBlueprintName: blueprintNameForArmor("Mossweave Trailboots"),
    requirements: [
      { itemName: "Mossweave Bolt", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 3 },
    ],
    stats: { ARMOR: 6, GATHERING_EFFICIENCY: 1, MOVEMENT_SPEED: 3 },
  },
  {
    slug: "mossweave-utility-belt",
    name: "Mossweave Utility Belt",
    description:
      "A reinforced belt with small pouches, loops and a weatherproof Mossweave backing.",
    itemType: "BELT",
    equipTo: "belt",
    rarity: "UNCOMMON",
    requiredLevel: 18,
    price: 120,
    sprite: "/assets/items/armor/mossweave-utility-belt-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 20,
    defaultSeconds: 70,
    xpPerUnit: 24,
    requiredBlueprintName: blueprintNameForArmor("Mossweave Utility Belt"),
    requirements: [
      { itemName: "Mossweave Bolt", quantityPerUnit: 1 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
      { itemName: "Animal Sinew", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 4, CARRYING_CAPACITY: 5, LUCK: 1 },
  },
  {
    slug: "ironbark-helm",
    name: "Ironbark Helm",
    description:
      "A broad-browed helm of layered Ironbark plates, made to turn a hard branch or a harder blow.",
    itemType: "HELMET",
    equipTo: "head",
    rarity: "RARE",
    requiredLevel: 38,
    price: 335,
    sprite: "/assets/items/armor/ironbark-helm-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 38,
    defaultSeconds: 115,
    xpPerUnit: 48,
    requiredBlueprintName: blueprintNameForArmor("Ironbark Helm"),
    requirements: [
      { itemName: "Ironbark Lamella", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 10, HEALTH: 5, WOODCUTTING_EFFICIENCY: 1 },
  },
  {
    slug: "ironbark-cuirass",
    name: "Ironbark Cuirass",
    description:
      "A resin-dark cuirass whose overlapping oak lamellae flex with the wearer while iron rims carry the impact.",
    itemType: "CHESTPLATE",
    equipTo: "chest",
    rarity: "RARE",
    requiredLevel: 38,
    price: 690,
    sprite: "/assets/items/armor/ironbark-cuirass-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 38,
    defaultSeconds: 190,
    xpPerUnit: 78,
    requiredBlueprintName: blueprintNameForArmor("Ironbark Cuirass"),
    requirements: [
      { itemName: "Ironbark Lamella", quantityPerUnit: 5 },
      { itemName: "Hardened Leather", quantityPerUnit: 3 },
      { itemName: "Animal Sinew", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 25, HEALTH: 14, CARRYING_CAPACITY: 6 },
  },
  {
    slug: "ironbark-pauldrons",
    name: "Ironbark Pauldrons",
    description:
      "Broad oak-and-iron shoulders secured with leather so a load bearer can still move freely.",
    itemType: "PAULDRONS",
    equipTo: "pauldrons",
    rarity: "RARE",
    requiredLevel: 38,
    price: 490,
    sprite: "/assets/items/armor/ironbark-pauldrons-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 38,
    defaultSeconds: 145,
    xpPerUnit: 60,
    requiredBlueprintName: blueprintNameForArmor("Ironbark Pauldrons"),
    requirements: [
      { itemName: "Ironbark Lamella", quantityPerUnit: 3 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 16, HEALTH: 5, BLOCK_CHANCE: 1 },
  },
  {
    slug: "ironbark-bracers",
    name: "Ironbark Bracers",
    description:
      "Riveted bark guards that protect the forearms when hauling timber through dense undergrowth.",
    itemType: "BRACERS",
    equipTo: "bracers",
    rarity: "RARE",
    requiredLevel: 38,
    price: 275,
    sprite: "/assets/items/armor/ironbark-bracers-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 38,
    defaultSeconds: 95,
    xpPerUnit: 40,
    requiredBlueprintName: blueprintNameForArmor("Ironbark Bracers"),
    requirements: [
      { itemName: "Ironbark Lamella", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 8, WOODCUTTING_EFFICIENCY: 2 },
  },
  {
    slug: "ironbark-gauntlets",
    name: "Ironbark Gauntlets",
    description:
      "Hard-knuckled work gauntlets built around supple leather palms and ironbark guards.",
    itemType: "GLOVES",
    equipTo: "gloves",
    rarity: "RARE",
    requiredLevel: 38,
    price: 270,
    sprite: "/assets/items/armor/ironbark-gauntlets-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 38,
    defaultSeconds: 95,
    xpPerUnit: 40,
    requiredBlueprintName: blueprintNameForArmor("Ironbark Gauntlets"),
    requirements: [
      { itemName: "Ironbark Lamella", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 7, WOODCUTTING_EFFICIENCY: 2 },
  },
  {
    slug: "ironbark-greaves",
    name: "Ironbark Greaves",
    description:
      "Layered bark greaves that leave room to climb, kneel and brace a heavy load.",
    itemType: "GREAVES",
    equipTo: "greaves",
    rarity: "RARE",
    requiredLevel: 38,
    price: 585,
    sprite: "/assets/items/armor/ironbark-greaves-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 38,
    defaultSeconds: 165,
    xpPerUnit: 68,
    requiredBlueprintName: blueprintNameForArmor("Ironbark Greaves"),
    requirements: [
      { itemName: "Ironbark Lamella", quantityPerUnit: 4 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
      { itemName: "Animal Sinew", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 20, HEALTH: 8, CARRYING_CAPACITY: 4 },
  },
  {
    slug: "ironbark-sabatons",
    name: "Ironbark Sabatons",
    description:
      "Heavy-soled sapwood sabatons wrapped in iron to steady the wearer across roots and rubble.",
    itemType: "BOOTS",
    equipTo: "boots",
    rarity: "RARE",
    requiredLevel: 38,
    price: 370,
    sprite: "/assets/items/armor/ironbark-sabatons-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 38,
    defaultSeconds: 120,
    xpPerUnit: 50,
    requiredBlueprintName: blueprintNameForArmor("Ironbark Sabatons"),
    requirements: [
      { itemName: "Ironbark Lamella", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 12, HEALTH: 4, BLOCK_CHANCE: 1 },
  },
  {
    slug: "ironbark-girdle",
    name: "Ironbark Girdle",
    description:
      "A broad work girdle that spreads a carried load across laminated bark and resilient leather.",
    itemType: "BELT",
    equipTo: "belt",
    rarity: "RARE",
    requiredLevel: 38,
    price: 300,
    sprite: "/assets/items/armor/ironbark-girdle-armor-sets-v1.png",
    actionType: "CARPENTRY",
    requiredSkillLevel: 38,
    defaultSeconds: 100,
    xpPerUnit: 42,
    requiredBlueprintName: blueprintNameForArmor("Ironbark Girdle"),
    requirements: [
      { itemName: "Ironbark Lamella", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 8, CARRYING_CAPACITY: 10, WOODCUTTING_EFFICIENCY: 1 },
  },
  {
    slug: "frostsilver-helm",
    name: "Frostsilver Helm",
    description:
      "A fur-lined helm of pale Frostsilver that keeps the wind from the eyes and a cold edge from the brow.",
    itemType: "HELMET",
    equipTo: "head",
    rarity: "EXQUISITE",
    requiredLevel: 65,
    price: 690,
    sprite: "/assets/items/armor/frostsilver-helm-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 145,
    xpPerUnit: 78,
    requiredBlueprintName: blueprintNameForArmor("Frostsilver Helm"),
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 2 },
      { itemName: "Frostscale Leather", quantityPerUnit: 1 },
      { itemName: "Frostsilver Wire", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 15, MAGIC_RESIST: 3, COLD_RESIST: 5 },
  },
  {
    slug: "frostsilver-cuirass",
    name: "Frostsilver Cuirass",
    description:
      "A cold-water plate cuirass whose scaled-leather panels stay flexible below the high passes.",
    itemType: "CHESTPLATE",
    equipTo: "chest",
    rarity: "EXQUISITE",
    requiredLevel: 65,
    price: 1_420,
    sprite: "/assets/items/armor/frostsilver-cuirass-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 240,
    xpPerUnit: 126,
    requiredBlueprintName: blueprintNameForArmor("Frostsilver Cuirass"),
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 5 },
      { itemName: "Frostscale Leather", quantityPerUnit: 3 },
      { itemName: "Frostsilver Wire", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 36, MAGIC_RESIST: 6, COLD_RESIST: 8, HEALTH: 10 },
  },
  {
    slug: "frostsilver-pauldrons",
    name: "Frostsilver Pauldrons",
    description:
      "Articulated Frostsilver shoulders balanced over frostscale leather to protect a mobile vanguard.",
    itemType: "PAULDRONS",
    equipTo: "pauldrons",
    rarity: "EXQUISITE",
    requiredLevel: 65,
    price: 980,
    sprite: "/assets/items/armor/frostsilver-pauldrons-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 180,
    xpPerUnit: 94,
    requiredBlueprintName: blueprintNameForArmor("Frostsilver Pauldrons"),
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 3 },
      { itemName: "Frostscale Leather", quantityPerUnit: 2 },
      { itemName: "Frostsilver Wire", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 22, MAGIC_RESIST: 3, COLD_RESIST: 6 },
  },
  {
    slug: "frostsilver-bracers",
    name: "Frostsilver Bracers",
    description:
      "Fine articulated guards with fish-leather backing that stays supple in freezing rain.",
    itemType: "BRACERS",
    equipTo: "bracers",
    rarity: "EXQUISITE",
    requiredLevel: 65,
    price: 590,
    sprite: "/assets/items/armor/frostsilver-bracers-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 125,
    xpPerUnit: 66,
    requiredBlueprintName: blueprintNameForArmor("Frostsilver Bracers"),
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 2 },
      { itemName: "Frostscale Leather", quantityPerUnit: 1 },
      { itemName: "Frostsilver Wire", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 12, MAGIC_RESIST: 2, MINING_EFFICIENCY: 1 },
  },
  {
    slug: "frostsilver-gauntlets",
    name: "Frostsilver Gauntlets",
    description:
      "Tapered gauntlets that protect the hand without robbing it of a sure grip on tools or steel.",
    itemType: "GLOVES",
    equipTo: "gloves",
    rarity: "EXQUISITE",
    requiredLevel: 65,
    price: 570,
    sprite: "/assets/items/armor/frostsilver-gauntlets-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 125,
    xpPerUnit: 66,
    requiredBlueprintName: blueprintNameForArmor("Frostsilver Gauntlets"),
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 2 },
      { itemName: "Frostscale Leather", quantityPerUnit: 1 },
      { itemName: "Frostsilver Wire", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 10, MAGIC_RESIST: 2, MINING_EFFICIENCY: 2 },
  },
  {
    slug: "frostsilver-greaves",
    name: "Frostsilver Greaves",
    description:
      "Layered leg guards wired on a flexible frame, designed for steep ice and sudden close fighting.",
    itemType: "GREAVES",
    equipTo: "greaves",
    rarity: "EXQUISITE",
    requiredLevel: 65,
    price: 1_190,
    sprite: "/assets/items/armor/frostsilver-greaves-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 205,
    xpPerUnit: 108,
    requiredBlueprintName: blueprintNameForArmor("Frostsilver Greaves"),
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 4 },
      { itemName: "Frostscale Leather", quantityPerUnit: 3 },
      { itemName: "Frostsilver Wire", quantityPerUnit: 2 },
    ],
    stats: {
      ARMOR: 29,
      MAGIC_RESIST: 4,
      COLD_RESIST: 7,
      FISHING_EFFICIENCY: 1,
    },
  },
  {
    slug: "frostsilver-sabatons",
    name: "Frostsilver Sabatons",
    description:
      "Fur-trimmed sabatons whose treated leather lining stays dry across snow, surf and frozen stone.",
    itemType: "BOOTS",
    equipTo: "boots",
    rarity: "EXQUISITE",
    requiredLevel: 65,
    price: 775,
    sprite: "/assets/items/armor/frostsilver-sabatons-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 150,
    xpPerUnit: 80,
    requiredBlueprintName: blueprintNameForArmor("Frostsilver Sabatons"),
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 2 },
      { itemName: "Frostscale Leather", quantityPerUnit: 2 },
      { itemName: "Frostsilver Wire", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 16, MAGIC_RESIST: 2, COLD_RESIST: 5, MOVEMENT_SPEED: 1 },
  },
  {
    slug: "frostsilver-girdle",
    name: "Frostsilver Girdle",
    description:
      "A flexible plated girdle that locks the Tidewarden's layered armor together at the waist.",
    itemType: "BELT",
    equipTo: "belt",
    rarity: "EXQUISITE",
    requiredLevel: 65,
    price: 615,
    sprite: "/assets/items/armor/frostsilver-girdle-armor-sets-v1.png",
    actionType: "BLACKSMITHING",
    requiredSkillLevel: 65,
    defaultSeconds: 130,
    xpPerUnit: 68,
    requiredBlueprintName: blueprintNameForArmor("Frostsilver Girdle"),
    requirements: [
      { itemName: "Frostsilver Ingot", quantityPerUnit: 2 },
      { itemName: "Frostscale Leather", quantityPerUnit: 1 },
      { itemName: "Frostsilver Wire", quantityPerUnit: 1 },
    ],
    stats: {
      ARMOR: 10,
      MAGIC_RESIST: 2,
      COLD_RESIST: 4,
      FISHING_EFFICIENCY: 2,
    },
  },
  {
    slug: "cinderweave-cowl",
    name: "Cinderweave Cowl",
    description:
      "A soot-dark cowl stitched around discreet Doomsteel Links, built for the heat haze at Mount Doom.",
    itemType: "HELMET",
    equipTo: "head",
    rarity: "EPIC",
    requiredLevel: 105,
    price: 1_320,
    sprite: "/assets/items/armor/cinderweave-cowl-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 160,
    xpPerUnit: 105,
    requiredBlueprintName: blueprintNameForArmor("Cinderweave Cowl"),
    requirements: [
      { itemName: "Cindercloth Bolt", quantityPerUnit: 2 },
      { itemName: "Doomsteel Links", quantityPerUnit: 1 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
    stats: { ARMOR: 20, MAGIC_RESIST: 4, FIRE_RESIST: 6 },
  },
  {
    slug: "cinderweave-coat",
    name: "Cinderweave Coat",
    description:
      "A long layered coat woven around Doomsteel Links, light enough to move in and resolute against a blast of furnace heat.",
    itemType: "CHESTPLATE",
    equipTo: "chest",
    rarity: "EPIC",
    requiredLevel: 105,
    price: 2_680,
    sprite: "/assets/items/armor/cinderweave-coat-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 280,
    xpPerUnit: 182,
    requiredBlueprintName: blueprintNameForArmor("Cinderweave Coat"),
    requirements: [
      { itemName: "Cindercloth Bolt", quantityPerUnit: 5 },
      { itemName: "Doomsteel Links", quantityPerUnit: 3 },
      { itemName: "Hardened Leather", quantityPerUnit: 3 },
    ],
    stats: { ARMOR: 48, MAGIC_RESIST: 8, FIRE_RESIST: 12, HEALTH: 16 },
  },
  {
    slug: "cinderweave-mantle",
    name: "Cinderweave Mantle",
    description:
      "A hanging embermail mantle that shields the shoulder line while its weighted cloth keeps clear of the hands.",
    itemType: "PAULDRONS",
    equipTo: "pauldrons",
    rarity: "EPIC",
    requiredLevel: 105,
    price: 1_920,
    sprite: "/assets/items/armor/cinderweave-mantle-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 210,
    xpPerUnit: 136,
    requiredBlueprintName: blueprintNameForArmor("Cinderweave Mantle"),
    requirements: [
      { itemName: "Cindercloth Bolt", quantityPerUnit: 3 },
      { itemName: "Doomsteel Links", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: {
      ARMOR: 28,
      MAGIC_RESIST: 4,
      FIRE_RESIST: 7,
      HUNTING_EFFICIENCY: 1,
    },
  },
  {
    slug: "cinderweave-wraps",
    name: "Cinderweave Wraps",
    description:
      "Tight forearm wraps with a linked inner seam, protective without adding a smith's bulk.",
    itemType: "BRACERS",
    equipTo: "bracers",
    rarity: "EPIC",
    requiredLevel: 105,
    price: 1_080,
    sprite: "/assets/items/armor/cinderweave-wraps-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 135,
    xpPerUnit: 88,
    requiredBlueprintName: blueprintNameForArmor("Cinderweave Wraps"),
    requirements: [
      { itemName: "Cindercloth Bolt", quantityPerUnit: 2 },
      { itemName: "Doomsteel Links", quantityPerUnit: 1 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
    stats: {
      ARMOR: 14,
      MAGIC_RESIST: 2,
      FIRE_RESIST: 4,
      HUNTING_EFFICIENCY: 1,
    },
  },
  {
    slug: "cinderweave-gloves",
    name: "Cinderweave Gloves",
    description:
      "Heatproof gloves with a fine linked back, made for handling hot tools or a drawn blade with equal confidence.",
    itemType: "GLOVES",
    equipTo: "gloves",
    rarity: "EPIC",
    requiredLevel: 105,
    price: 1_050,
    sprite: "/assets/items/armor/cinderweave-gloves-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 135,
    xpPerUnit: 88,
    requiredBlueprintName: blueprintNameForArmor("Cinderweave Gloves"),
    requirements: [
      { itemName: "Cindercloth Bolt", quantityPerUnit: 2 },
      { itemName: "Doomsteel Links", quantityPerUnit: 1 },
      { itemName: "Hardened Leather", quantityPerUnit: 1 },
    ],
    stats: {
      ARMOR: 12,
      MAGIC_RESIST: 2,
      FIRE_RESIST: 4,
      HUNTING_EFFICIENCY: 2,
    },
  },
  {
    slug: "cinderweave-leggings",
    name: "Cinderweave Leggings",
    description:
      "Layered fireproof leggings whose linked knee panels do not bind when climbing through black volcanic rock.",
    itemType: "GREAVES",
    equipTo: "greaves",
    rarity: "EPIC",
    requiredLevel: 105,
    price: 2_360,
    sprite: "/assets/items/armor/cinderweave-leggings-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 245,
    xpPerUnit: 160,
    requiredBlueprintName: blueprintNameForArmor("Cinderweave Leggings"),
    requirements: [
      { itemName: "Cindercloth Bolt", quantityPerUnit: 4 },
      { itemName: "Doomsteel Links", quantityPerUnit: 3 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 38, MAGIC_RESIST: 5, FIRE_RESIST: 9, MOVEMENT_SPEED: 1 },
  },
  {
    slug: "cinderweave-ashboots",
    name: "Cinderweave Ashboots",
    description:
      "High ash-worn boots with cindercloth wraps and hard linked soles for hot, loose ground.",
    itemType: "BOOTS",
    equipTo: "boots",
    rarity: "EPIC",
    requiredLevel: 105,
    price: 1_470,
    sprite: "/assets/items/armor/cinderweave-ashboots-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 170,
    xpPerUnit: 110,
    requiredBlueprintName: blueprintNameForArmor("Cinderweave Ashboots"),
    requirements: [
      { itemName: "Cindercloth Bolt", quantityPerUnit: 2 },
      { itemName: "Doomsteel Links", quantityPerUnit: 2 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 20, MAGIC_RESIST: 2, FIRE_RESIST: 5, MOVEMENT_SPEED: 2 },
  },
  {
    slug: "cinderweave-sash",
    name: "Cinderweave Sash",
    description:
      "A broad ashproof sash that anchors tools and a linked skirt without pulling at a long coat.",
    itemType: "BELT",
    equipTo: "belt",
    rarity: "EPIC",
    requiredLevel: 105,
    price: 1_170,
    sprite: "/assets/items/armor/cinderweave-sash-armor-sets-v1.png",
    actionType: "TAILORING",
    requiredSkillLevel: 105,
    defaultSeconds: 145,
    xpPerUnit: 94,
    requiredBlueprintName: blueprintNameForArmor("Cinderweave Sash"),
    requirements: [
      { itemName: "Cindercloth Bolt", quantityPerUnit: 2 },
      { itemName: "Doomsteel Links", quantityPerUnit: 1 },
      { itemName: "Hardened Leather", quantityPerUnit: 2 },
    ],
    stats: { ARMOR: 14, MAGIC_RESIST: 2, FIRE_RESIST: 4, CARRYING_CAPACITY: 8 },
  },
] as const satisfies readonly ArmorSetGearDefinition[];

export const ARMOR_SET_BLUEPRINTS = ARMOR_SET_GEAR.map(
  (gear): ArmorSetBlueprintDefinition => ({
    slug: gear.slug + "-blueprint",
    name: blueprintNameForArmor(gear.name),
    description:
      "A physical " +
      gear.name +
      " pattern. It is consumed alongside the materials during each craft.",
    itemType: "BLUEPRINT",
    rarity: gear.rarity,
    price: Math.round(gear.price * 0.65),
    sprite:
      "/assets/items/resources/blueprints/" +
      gear.slug +
      "-blueprint-armor-sets-v1.png",
    requiredForItemName: gear.name,
  }),
);

export const ARMOR_SET_ITEMS = [
  ...ARMOR_SET_GATHERING_MATERIALS,
  ...ARMOR_SET_GARDEN_ITEMS,
  ...ARMOR_SET_COMPONENTS,
  ...ARMOR_SET_BLUEPRINTS,
  ...ARMOR_SET_GEAR,
] as const;

export function armorSetRequirementsForCraft(
  craft: ArmorSetCraftDefinition | ArmorSetGearDefinition,
) {
  return [
    ...("requiredBlueprintName" in craft
      ? [{ itemName: craft.requiredBlueprintName, quantityPerUnit: 1 }]
      : []),
    ...craft.requirements,
  ];
}

export function armorSetItemCreateData(
  definition:
    | ArmorSetItemDefinition
    | ArmorSetCraftDefinition
    | ArmorSetGearDefinition,
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
    maxStackSize: gear ? 1 : 9_999,
    requiredLevel: gear?.requiredLevel ?? 1,
    flipNegativeStatsWithRarity: false,
    armor: gear?.stats.ARMOR ?? 0,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    seedGrowSeconds: definition.seedGrowSeconds ?? null,
    seedYieldMin: definition.seedYieldMin ?? null,
    seedYieldMax: definition.seedYieldMax ?? null,
    seedHarvestSeconds: definition.seedHarvestSeconds ?? null,
    seedXp: definition.seedXp ?? null,
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

export const ARMOR_SET_SKILLS = [
  {
    skill_name: "Alchemy",
    description:
      "Distill herbs, oils and reagents into dyes, tannins and protective compounds.",
    category: "CRAFTING" as const,
  },
  {
    skill_name: "Blacksmithing",
    description:
      "Forge ingots, armor and durable metal components from mined and prepared materials.",
    category: "CRAFTING" as const,
  },
  {
    skill_name: "Carpentry",
    description:
      "Shape timber, planks and fittings into resilient woodwork and layered field gear.",
    category: "CRAFTING" as const,
  },
  {
    skill_name: "Tailoring",
    description:
      "Turn cloth, hides and rare fibers into practical apparel, prepared leather and reinforced armor.",
    category: "CRAFTING" as const,
  },
  {
    skill_name: "Weaponsmithing",
    description:
      "Work high-tension metal components and weapons for demanding combat applications.",
    category: "CRAFTING" as const,
  },
] as const;
