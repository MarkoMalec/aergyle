import type {
  ItemRarity,
  ItemType,
  VocationalActionType,
} from "../../src/generated/prisma/enums";
import { ATLAS_LOCATION_MARKERS } from "../../src/game/world/atlasLocations";
import type { AtlasLocationName } from "../../src/game/world/atlasLocations";

export interface VocationRequirementDefinition {
  itemName: string;
  quantityPerUnit: number;
}

export interface VocationResourceDefinition {
  slug: string;
  name: string;
  description: string;
  actionType: VocationalActionType;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  requiredSkillLevel: number;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  locations: readonly AtlasLocationName[];
  requirements: readonly VocationRequirementDefinition[];
}

export const VOCATION_EXPANSION_LOCATIONS = ATLAS_LOCATION_MARKERS.map(
  ({ name, requiredLevel }) => ({ name, requiredLevel }),
);

/**
 * Existing catalog ingredients used by the pack. The importer creates a missing
 * dependency from these definitions, but never replaces a conflicting template.
 */
export const VOCATION_DEPENDENCY_ITEMS = [
  {
    name: "Worm",
    description:
      "A simple earthworm kept cool and damp for freshwater and coastal fishing.",
    itemType: "BAIT",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/consumables/bait/basic-worm.png",
  },
  {
    name: "Coal",
    description:
      "A dense black fuel used to bring a blacksmithing furnace up to working heat.",
    itemType: "ORE",
    rarity: "COMMON",
    price: 1,
    sprite: "/assets/items/resources/ores/coal.png",
  },
  {
    name: "Iron ore",
    description:
      "Common iron-bearing stone, useful wherever a strong practical metal is needed.",
    itemType: "ORE",
    rarity: "COMMON",
    price: 2,
    sprite: "/assets/items/resources/ores/iron-ore.png",
  },
] as const satisfies readonly {
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  sprite: string;
}[];

/** Existing starter resources needed by recipes and exposed at the new Citadel. */
export const VOCATION_BASELINE_RESOURCES = [
  {
    name: "Coal",
    itemName: "Coal",
    actionType: "MINING",
    requiredSkillLevel: 1,
    defaultSeconds: 10,
    yieldPerUnit: 1,
    xpPerUnit: 2,
    rarity: "COMMON",
  },
  {
    name: "Iron ore",
    itemName: "Iron ore",
    actionType: "MINING",
    requiredSkillLevel: 5,
    defaultSeconds: 9,
    yieldPerUnit: 1,
    xpPerUnit: 2,
    rarity: "COMMON",
  },
] as const satisfies readonly {
  name: string;
  itemName: string;
  actionType: VocationalActionType;
  requiredSkillLevel: number;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  rarity: ItemRarity;
}[];

export const VOCATION_EXPANSION = [
  // Mining
  {
    slug: "copper-ore",
    name: "Copper Ore",
    description:
      "Weathered stone carrying broad seams of workmanlike red copper.",
    actionType: "MINING",
    itemType: "ORE",
    rarity: "COMMON",
    price: 3,
    requiredSkillLevel: 1,
    defaultSeconds: 11,
    yieldPerUnit: 1,
    xpPerUnit: 3,
    locations: ["Citadel"],
    requirements: [],
  },
  {
    slug: "tin-ore",
    name: "Tin Ore",
    description:
      "Dark stone studded with pale tin, prized for hardening soft copper.",
    actionType: "MINING",
    itemType: "ORE",
    rarity: "COMMON",
    price: 5,
    requiredSkillLevel: 10,
    defaultSeconds: 15,
    yieldPerUnit: 1,
    xpPerUnit: 5,
    locations: ["Citadel"],
    requirements: [],
  },
  {
    slug: "silver-ore",
    name: "Silver Ore",
    description:
      "Slate split by muted silver veins from beneath the goblin-held hills.",
    actionType: "MINING",
    itemType: "ORE",
    rarity: "UNCOMMON",
    price: 15,
    requiredSkillLevel: 40,
    defaultSeconds: 24,
    yieldPerUnit: 1,
    xpPerUnit: 10,
    locations: ["Goblins Camp"],
    requirements: [],
  },
  {
    slug: "frostsilver-ore",
    name: "Frostsilver Ore",
    description:
      "Cold blue-grey mountain stone holding dense, pale metallic deposits.",
    actionType: "MINING",
    itemType: "ORE",
    rarity: "UNCOMMON",
    price: 24,
    requiredSkillLevel: 50,
    defaultSeconds: 30,
    yieldPerUnit: 1,
    xpPerUnit: 13,
    locations: ["Frostcrown Peaks"],
    requirements: [],
  },
  {
    slug: "cobalt-ore",
    name: "Cobalt Ore",
    description:
      "Ancient Caldrath stone bearing unusually deep blue metal-rich faces.",
    actionType: "MINING",
    itemType: "ORE",
    rarity: "RARE",
    price: 48,
    requiredSkillLevel: 80,
    defaultSeconds: 42,
    yieldPerUnit: 1,
    xpPerUnit: 20,
    locations: ["Ruins of Caldrath"],
    requirements: [],
  },
  {
    slug: "obsidian-ore",
    name: "Obsidian Ore",
    description:
      "A brutal chunk of volcanic glass torn from the slopes of Mount Doom.",
    actionType: "MINING",
    itemType: "ORE",
    rarity: "EPIC",
    price: 105,
    requiredSkillLevel: 150,
    defaultSeconds: 64,
    yieldPerUnit: 1,
    xpPerUnit: 36,
    locations: ["Mount Doom"],
    requirements: [],
  },

  // Woodcutting
  {
    slug: "pine-log",
    name: "Pine Log",
    description:
      "Light straight timber with a resinous heart, easy for a new cutter to work.",
    actionType: "WOODCUTTING",
    itemType: "LOG",
    rarity: "COMMON",
    price: 2,
    requiredSkillLevel: 1,
    defaultSeconds: 10,
    yieldPerUnit: 1,
    xpPerUnit: 2,
    locations: ["Citadel"],
    requirements: [],
  },
  {
    slug: "willow-log",
    name: "Willow Log",
    description: "Pale flexible timber beneath smooth olive-grey bark.",
    actionType: "WOODCUTTING",
    itemType: "LOG",
    rarity: "COMMON",
    price: 4,
    requiredSkillLevel: 10,
    defaultSeconds: 14,
    yieldPerUnit: 1,
    xpPerUnit: 4,
    locations: ["Citadel"],
    requirements: [],
  },
  {
    slug: "ash-log",
    name: "Ash Log",
    description:
      "Dense straight-grained wood cut from the hard stands around the goblin camp.",
    actionType: "WOODCUTTING",
    itemType: "LOG",
    rarity: "UNCOMMON",
    price: 12,
    requiredSkillLevel: 40,
    defaultSeconds: 22,
    yieldPerUnit: 1,
    xpPerUnit: 9,
    locations: ["Goblins Camp"],
    requirements: [],
  },
  {
    slug: "frostpine-log",
    name: "Frostpine Log",
    description: "Cold, dry timber protected by rugged blue-charcoal bark.",
    actionType: "WOODCUTTING",
    itemType: "LOG",
    rarity: "UNCOMMON",
    price: 21,
    requiredSkillLevel: 50,
    defaultSeconds: 28,
    yieldPerUnit: 1,
    xpPerUnit: 12,
    locations: ["Frostcrown Peaks"],
    requirements: [],
  },
  {
    slug: "elderwood-log",
    name: "Elderwood Log",
    description:
      "Ancient heavy timber whose close rings survived the fall of Caldrath.",
    actionType: "WOODCUTTING",
    itemType: "LOG",
    rarity: "RARE",
    price: 45,
    requiredSkillLevel: 80,
    defaultSeconds: 40,
    yieldPerUnit: 1,
    xpPerUnit: 19,
    locations: ["Ruins of Caldrath"],
    requirements: [],
  },
  {
    slug: "emberwood-log",
    name: "Emberwood Log",
    description:
      "Dark volcanic bark protects a copper-red heartwood seasoned by fierce heat.",
    actionType: "WOODCUTTING",
    itemType: "LOG",
    rarity: "EPIC",
    price: 98,
    requiredSkillLevel: 150,
    defaultSeconds: 60,
    yieldPerUnit: 1,
    xpPerUnit: 34,
    locations: ["Mount Doom"],
    requirements: [],
  },

  // Fishing
  {
    slug: "silver-minnow",
    name: "Silver Minnow",
    description:
      "A small quick freshwater fish marked by a single charcoal stripe.",
    actionType: "FISHING",
    itemType: "FISH",
    rarity: "COMMON",
    price: 8,
    requiredSkillLevel: 1,
    defaultSeconds: 13,
    yieldPerUnit: 1,
    xpPerUnit: 4,
    locations: ["Citadel"],
    requirements: [{ itemName: "Worm", quantityPerUnit: 1 }],
  },
  {
    slug: "river-trout",
    name: "River Trout",
    description:
      "A sturdy river fish with a soft copper-rose band along its flank.",
    actionType: "FISHING",
    itemType: "FISH",
    rarity: "COMMON",
    price: 12,
    requiredSkillLevel: 10,
    defaultSeconds: 18,
    yieldPerUnit: 1,
    xpPerUnit: 6,
    locations: ["Citadel"],
    requirements: [{ itemName: "Worm", quantityPerUnit: 1 }],
  },
  {
    slug: "bog-pike",
    name: "Bog Pike",
    description:
      "A patient marsh predator with broad pale mottling and a powerful tail.",
    actionType: "FISHING",
    itemType: "FISH",
    rarity: "UNCOMMON",
    price: 28,
    requiredSkillLevel: 40,
    defaultSeconds: 28,
    yieldPerUnit: 1,
    xpPerUnit: 12,
    locations: ["Goblins Camp"],
    requirements: [{ itemName: "Worm", quantityPerUnit: 2 }],
  },
  {
    slug: "frostscale-char",
    name: "Frostscale Char",
    description:
      "A cold-water char with pale flank spots and restrained ember-orange fins.",
    actionType: "FISHING",
    itemType: "FISH",
    rarity: "UNCOMMON",
    price: 40,
    requiredSkillLevel: 50,
    defaultSeconds: 35,
    yieldPerUnit: 1,
    xpPerUnit: 16,
    locations: ["Frostcrown Peaks"],
    requirements: [{ itemName: "Worm", quantityPerUnit: 2 }],
  },
  {
    slug: "caldrath-eel",
    name: "Caldrath Eel",
    description:
      "A thick blue-black eel that coils through the flooded channels beneath Caldrath.",
    actionType: "FISHING",
    itemType: "FISH",
    rarity: "RARE",
    price: 85,
    requiredSkillLevel: 80,
    defaultSeconds: 50,
    yieldPerUnit: 1,
    xpPerUnit: 25,
    locations: ["Ruins of Caldrath"],
    requirements: [{ itemName: "Worm", quantityPerUnit: 3 }],
  },
  {
    slug: "blackfin-tuna",
    name: "Blackfin Tuna",
    description:
      "A powerful deep-water prize landed only off the dangerous pirate coast.",
    actionType: "FISHING",
    itemType: "FISH",
    rarity: "EPIC",
    price: 230,
    requiredSkillLevel: 200,
    defaultSeconds: 82,
    yieldPerUnit: 1,
    xpPerUnit: 50,
    locations: ["Pirate Island"],
    requirements: [{ itemName: "Worm", quantityPerUnit: 4 }],
  },

  // Blacksmithing
  {
    slug: "copper-ingot",
    name: "Copper Ingot",
    description:
      "A practical bar of refined copper with a little honest casting wear.",
    actionType: "BLACKSMITHING",
    itemType: "INGOT",
    rarity: "COMMON",
    price: 9,
    requiredSkillLevel: 1,
    defaultSeconds: 16,
    yieldPerUnit: 1,
    xpPerUnit: 5,
    locations: ["Citadel"],
    requirements: [
      { itemName: "Copper Ore", quantityPerUnit: 2 },
      { itemName: "Coal", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "bronze-ingot",
    name: "Bronze Ingot",
    description:
      "Copper strengthened with tin into a dependable ochre-brown alloy.",
    actionType: "BLACKSMITHING",
    itemType: "INGOT",
    rarity: "COMMON",
    price: 28,
    requiredSkillLevel: 10,
    defaultSeconds: 22,
    yieldPerUnit: 1,
    xpPerUnit: 8,
    locations: ["Citadel"],
    requirements: [
      { itemName: "Copper Ingot", quantityPerUnit: 1 },
      { itemName: "Tin Ore", quantityPerUnit: 2 },
      { itemName: "Coal", quantityPerUnit: 1 },
    ],
  },
  {
    slug: "steel-ingot",
    name: "Steel Ingot",
    description: "Iron worked with ample coal into a dense blue-grey bar.",
    actionType: "BLACKSMITHING",
    itemType: "INGOT",
    rarity: "UNCOMMON",
    price: 32,
    requiredSkillLevel: 40,
    defaultSeconds: 32,
    yieldPerUnit: 1,
    xpPerUnit: 14,
    locations: ["Goblins Camp"],
    requirements: [
      { itemName: "Iron ore", quantityPerUnit: 2 },
      { itemName: "Coal", quantityPerUnit: 3 },
    ],
  },
  {
    slug: "frostsilver-ingot",
    name: "Frostsilver Ingot",
    description:
      "Cold mountain metal tempered with silver into a pale resilient bar.",
    actionType: "BLACKSMITHING",
    itemType: "INGOT",
    rarity: "UNCOMMON",
    price: 82,
    requiredSkillLevel: 50,
    defaultSeconds: 40,
    yieldPerUnit: 1,
    xpPerUnit: 19,
    locations: ["Frostcrown Peaks"],
    requirements: [
      { itemName: "Frostsilver Ore", quantityPerUnit: 2 },
      { itemName: "Silver Ore", quantityPerUnit: 1 },
      { itemName: "Coal", quantityPerUnit: 3 },
    ],
  },
  {
    slug: "cobalt-ingot",
    name: "Cobalt Ingot",
    description:
      "A heavy Caldrath bar whose deep blue surface bears the marks of the hammer.",
    actionType: "BLACKSMITHING",
    itemType: "INGOT",
    rarity: "RARE",
    price: 180,
    requiredSkillLevel: 80,
    defaultSeconds: 56,
    yieldPerUnit: 1,
    xpPerUnit: 28,
    locations: ["Ruins of Caldrath"],
    requirements: [
      { itemName: "Cobalt Ore", quantityPerUnit: 3 },
      { itemName: "Coal", quantityPerUnit: 4 },
    ],
  },
  {
    slug: "doomsteel-ingot",
    name: "Doomsteel Ingot",
    description:
      "Obsidian and cobalt fused into a near-black alloy in Mount Doom's furnace heat.",
    actionType: "BLACKSMITHING",
    itemType: "INGOT",
    rarity: "EPIC",
    price: 430,
    requiredSkillLevel: 150,
    defaultSeconds: 78,
    yieldPerUnit: 1,
    xpPerUnit: 45,
    locations: ["Mount Doom"],
    requirements: [
      { itemName: "Obsidian Ore", quantityPerUnit: 2 },
      { itemName: "Cobalt Ingot", quantityPerUnit: 1 },
      { itemName: "Coal", quantityPerUnit: 5 },
    ],
  },
] as const satisfies readonly VocationResourceDefinition[];

export function vocationSpritePath(definition: VocationResourceDefinition) {
  const folder =
    definition.itemType === "ORE"
      ? "ores"
      : definition.itemType === "LOG"
        ? "logs"
        : definition.itemType === "FISH"
          ? "fish"
          : "ingots";
  return `/assets/items/resources/${folder}/${definition.slug}-atlas-v1.png`;
}

export function vocationItemCreateData(definition: VocationResourceDefinition) {
  return {
    name: definition.name,
    description: definition.description,
    price: definition.price,
    sprite: vocationSpritePath(definition),
    itemType: definition.itemType,
    equipTo: null,
    stackable: true,
    maxStackSize: 9999,
    rarity: definition.rarity,
    requiredLevel: 1,
  };
}
