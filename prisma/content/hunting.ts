import type {
  CreatureAttackStyle,
  ItemRarity,
  ItemType,
} from "../../src/generated/prisma/enums";
import type { AtlasLocationName } from "../../src/game/world/atlasLocations";

export interface HuntingItemDefinition {
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  price: number;
  sprite: string;
}

export interface HuntingDropDefinition {
  itemName: string;
  baseChance: number;
  minQuantity: number;
  maxQuantity: number;
  requiredHuntingLevel: number;
}

export interface HuntingCreatureDefinition {
  name: string;
  description: string;
  asset: string;
  attackStyle: CreatureAttackStyle;
  attackChance: number;
  damageMin: number;
  damageMax: number;
  drops: readonly HuntingDropDefinition[];
}

export const HUNTING_ITEMS = [
  {
    name: "Game Meat",
    description:
      "Fresh cuts from wild game, suitable for roasting, stewing, or preserving for the road.",
    itemType: "MEAT",
    rarity: "COMMON",
    price: 7,
    sprite: "/assets/items/resources/hunting/game-meat-hunting-v1.png",
  },
  {
    name: "Raw Hide",
    description:
      "An untreated animal hide that can be cleaned, scraped, and worked into leather.",
    itemType: "HIDE",
    rarity: "COMMON",
    price: 8,
    sprite: "/assets/items/resources/hunting/raw-hide-hunting-v1.png",
  },
  {
    name: "Small Bones",
    description:
      "Clean animal bones used in handles, needles, charms, stock, and careful alchemy.",
    itemType: "MATERIAL",
    rarity: "COMMON",
    price: 5,
    sprite: "/assets/items/resources/hunting/small-bones-hunting-v1.png",
  },
  {
    name: "Sharp Fang",
    description:
      "A hard predator fang prized for ornaments, ritual tools, and reinforced fittings.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 14,
    sprite: "/assets/items/resources/hunting/sharp-fang-hunting-v1.png",
  },
  {
    name: "Stag Antler",
    description:
      "A branching antler with dense grain, useful for grips, toggles, and carved components.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 18,
    sprite: "/assets/items/resources/hunting/stag-antler-hunting-v1.png",
  },
  {
    name: "Curved Horn",
    description:
      "A durable hollow horn that can become a vessel, signal horn, or shaped crafting piece.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 16,
    sprite: "/assets/items/resources/hunting/curved-horn-hunting-v1.png",
  },
  {
    name: "Animal Sinew",
    description:
      "Tough cleaned tendon fibers valued for bowstrings, bindings, and resilient stitching.",
    itemType: "MATERIAL",
    rarity: "UNCOMMON",
    price: 12,
    sprite: "/assets/items/resources/hunting/animal-sinew-hunting-v1.png",
  },
  {
    name: "Thick Fur",
    description:
      "A dense weatherproof pelt from a cold-country predator, warm even in cutting wind.",
    itemType: "HIDE",
    rarity: "RARE",
    price: 28,
    sprite: "/assets/items/resources/hunting/thick-fur-hunting-v1.png",
  },
] as const satisfies readonly HuntingItemDefinition[];

export const HUNTING_CREATURES = [
  {
    name: "Meadow Hare",
    description:
      "A quick grassland hare that relies on sudden turns and a keen sense of danger.",
    asset: "/assets/creatures/animals/meadow-hare-hunting-v1.png",
    attackStyle: "MELEE",
    attackChance: 0.01,
    damageMin: 1,
    damageMax: 2,
    drops: [
      {
        itemName: "Game Meat",
        baseChance: 0.9,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 1,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.55,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 1,
      },
      {
        itemName: "Raw Hide",
        baseChance: 0.35,
        minQuantity: 1,
        maxQuantity: 1,
        requiredHuntingLevel: 4,
      },
    ],
  },
  {
    name: "Red Deer",
    description:
      "A watchful woodland deer whose speed makes a clean approach more valuable than pursuit.",
    asset: "/assets/creatures/animals/red-deer-hunting-v1.png",
    attackStyle: "MELEE",
    attackChance: 0.05,
    damageMin: 3,
    damageMax: 7,
    drops: [
      {
        itemName: "Game Meat",
        baseChance: 0.95,
        minQuantity: 2,
        maxQuantity: 4,
        requiredHuntingLevel: 1,
      },
      {
        itemName: "Raw Hide",
        baseChance: 0.78,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 3,
      },
      {
        itemName: "Animal Sinew",
        baseChance: 0.52,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 8,
      },
      {
        itemName: "Stag Antler",
        baseChance: 0.22,
        minQuantity: 1,
        maxQuantity: 1,
        requiredHuntingLevel: 12,
      },
    ],
  },
  {
    name: "Wild Boar",
    description:
      "A heavy, ill-tempered boar that can turn a careless chase into a dangerous charge.",
    asset: "/assets/creatures/animals/wild-boar-hunting-v1.png",
    attackStyle: "MELEE",
    attackChance: 0.18,
    damageMin: 6,
    damageMax: 12,
    drops: [
      {
        itemName: "Game Meat",
        baseChance: 0.94,
        minQuantity: 2,
        maxQuantity: 4,
        requiredHuntingLevel: 5,
      },
      {
        itemName: "Raw Hide",
        baseChance: 0.62,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 8,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.46,
        minQuantity: 1,
        maxQuantity: 3,
        requiredHuntingLevel: 5,
      },
      {
        itemName: "Sharp Fang",
        baseChance: 0.24,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 14,
      },
    ],
  },
  {
    name: "Grey Wolf",
    description:
      "A patient pack hunter that tests distance and footing before darting in to bite.",
    asset: "/assets/creatures/animals/grey-wolf-hunting-v1.png",
    attackStyle: "MELEE",
    attackChance: 0.24,
    damageMin: 7,
    damageMax: 14,
    drops: [
      {
        itemName: "Raw Hide",
        baseChance: 0.76,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 12,
      },
      {
        itemName: "Sharp Fang",
        baseChance: 0.62,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 15,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.4,
        minQuantity: 1,
        maxQuantity: 3,
        requiredHuntingLevel: 12,
      },
      {
        itemName: "Animal Sinew",
        baseChance: 0.36,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 18,
      },
    ],
  },
  {
    name: "Marsh Crocodile",
    description:
      "An armored river predator that waits almost motionless beside muddy channels.",
    asset: "/assets/creatures/animals/marsh-crocodile-hunting-v1.png",
    attackStyle: "MELEE",
    attackChance: 0.3,
    damageMin: 10,
    damageMax: 18,
    drops: [
      {
        itemName: "Game Meat",
        baseChance: 0.72,
        minQuantity: 2,
        maxQuantity: 4,
        requiredHuntingLevel: 22,
      },
      {
        itemName: "Raw Hide",
        baseChance: 0.86,
        minQuantity: 2,
        maxQuantity: 3,
        requiredHuntingLevel: 25,
      },
      {
        itemName: "Sharp Fang",
        baseChance: 0.5,
        minQuantity: 1,
        maxQuantity: 3,
        requiredHuntingLevel: 28,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.6,
        minQuantity: 2,
        maxQuantity: 4,
        requiredHuntingLevel: 22,
      },
    ],
  },
  {
    name: "Mountain Goat",
    description:
      "A sure-footed highland goat whose winding trails cross steep and brittle ground.",
    asset: "/assets/creatures/animals/mountain-goat-hunting-v1.png",
    attackStyle: "MELEE",
    attackChance: 0.1,
    damageMin: 5,
    damageMax: 10,
    drops: [
      {
        itemName: "Game Meat",
        baseChance: 0.9,
        minQuantity: 2,
        maxQuantity: 4,
        requiredHuntingLevel: 30,
      },
      {
        itemName: "Raw Hide",
        baseChance: 0.68,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 32,
      },
      {
        itemName: "Curved Horn",
        baseChance: 0.58,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 35,
      },
      {
        itemName: "Animal Sinew",
        baseChance: 0.44,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 34,
      },
    ],
  },
  {
    name: "Frostfang Lynx",
    description:
      "A pale alpine cat that strikes from snow-shadow and vanishes among broken rocks.",
    asset: "/assets/creatures/animals/frostfang-lynx-hunting-v1.png",
    attackStyle: "MELEE",
    attackChance: 0.32,
    damageMin: 12,
    damageMax: 21,
    drops: [
      {
        itemName: "Thick Fur",
        baseChance: 0.82,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 45,
      },
      {
        itemName: "Sharp Fang",
        baseChance: 0.66,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 48,
      },
      {
        itemName: "Animal Sinew",
        baseChance: 0.46,
        minQuantity: 1,
        maxQuantity: 2,
        requiredHuntingLevel: 50,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.38,
        minQuantity: 1,
        maxQuantity: 3,
        requiredHuntingLevel: 45,
      },
    ],
  },
  {
    name: "Ashback Bear",
    description:
      "A massive dark bear marked by a pale ridge of fur and a violently guarded range.",
    asset: "/assets/creatures/animals/ashback-bear-hunting-v1.png",
    attackStyle: "MELEE",
    attackChance: 0.38,
    damageMin: 16,
    damageMax: 28,
    drops: [
      {
        itemName: "Game Meat",
        baseChance: 0.86,
        minQuantity: 3,
        maxQuantity: 6,
        requiredHuntingLevel: 60,
      },
      {
        itemName: "Thick Fur",
        baseChance: 0.76,
        minQuantity: 2,
        maxQuantity: 3,
        requiredHuntingLevel: 62,
      },
      {
        itemName: "Sharp Fang",
        baseChance: 0.48,
        minQuantity: 1,
        maxQuantity: 3,
        requiredHuntingLevel: 66,
      },
      {
        itemName: "Small Bones",
        baseChance: 0.62,
        minQuantity: 2,
        maxQuantity: 5,
        requiredHuntingLevel: 60,
      },
    ],
  },
] as const satisfies readonly HuntingCreatureDefinition[];

type GroundDefinition = {
  locationName: AtlasLocationName;
  name: string;
  description: string;
  requiredHuntingLevel: number;
  accidentChance: number;
  accidentDamageMin: number;
  accidentDamageMax: number;
  sortOrder: number;
  creatures: readonly { name: string; encounterWeight: number }[];
};

export const HUNTING_GROUNDS = [
  {
    locationName: "Crownhold",
    name: "Crownwood Fringe",
    description:
      "Managed woodland beyond the outer wall, crossed by deer paths and kitchen-garden hedges.",
    requiredHuntingLevel: 1,
    accidentChance: 0.02,
    accidentDamageMin: 1,
    accidentDamageMax: 3,
    sortOrder: 10,
    creatures: [
      { name: "Meadow Hare", encounterWeight: 5 },
      { name: "Red Deer", encounterWeight: 2 },
    ],
  },
  {
    locationName: "Greenveil Plains",
    name: "Sunmeadow Fields",
    description:
      "Long grass, low hedges, and open sightlines favor patient tracking over a hurried chase.",
    requiredHuntingLevel: 1,
    accidentChance: 0.025,
    accidentDamageMin: 1,
    accidentDamageMax: 4,
    sortOrder: 10,
    creatures: [
      { name: "Meadow Hare", encounterWeight: 5 },
      { name: "Red Deer", encounterWeight: 3 },
      { name: "Wild Boar", encounterWeight: 1 },
    ],
  },
  {
    locationName: "Greenveil Plains",
    name: "Oldstone Burrows",
    description:
      "Collapsed stonework and tangled banks shelter small game, but loose footing rewards care.",
    requiredHuntingLevel: 5,
    accidentChance: 0.04,
    accidentDamageMin: 2,
    accidentDamageMax: 5,
    sortOrder: 20,
    creatures: [
      { name: "Meadow Hare", encounterWeight: 4 },
      { name: "Wild Boar", encounterWeight: 2 },
    ],
  },
  {
    locationName: "Citadel",
    name: "Riverward Copse",
    description:
      "A strip of coppiced woodland between old levees where animals come to drink at dusk.",
    requiredHuntingLevel: 8,
    accidentChance: 0.035,
    accidentDamageMin: 2,
    accidentDamageMax: 6,
    sortOrder: 10,
    creatures: [
      { name: "Red Deer", encounterWeight: 4 },
      { name: "Wild Boar", encounterWeight: 3 },
      { name: "Grey Wolf", encounterWeight: 1 },
    ],
  },
  {
    locationName: "Goblins Camp",
    name: "Ashwood Thicket",
    description:
      "Dense ash trunks and smoky undergrowth conceal strong game and territorial predators.",
    requiredHuntingLevel: 18,
    accidentChance: 0.055,
    accidentDamageMin: 3,
    accidentDamageMax: 8,
    sortOrder: 10,
    creatures: [
      { name: "Wild Boar", encounterWeight: 4 },
      { name: "Grey Wolf", encounterWeight: 3 },
      { name: "Ashback Bear", encounterWeight: 0.5 },
    ],
  },
  {
    locationName: "Goblins Camp",
    name: "Reedfen Tracks",
    description:
      "Raised paths cross black water and reed beds where prints disappear as quickly as they form.",
    requiredHuntingLevel: 24,
    accidentChance: 0.07,
    accidentDamageMin: 4,
    accidentDamageMax: 10,
    sortOrder: 20,
    creatures: [
      { name: "Wild Boar", encounterWeight: 3 },
      { name: "Marsh Crocodile", encounterWeight: 2 },
      { name: "Grey Wolf", encounterWeight: 1 },
    ],
  },
  {
    locationName: "Frostcrown Peaks",
    name: "Whitepine Slopes",
    description:
      "Wind-cut pine slopes hold narrow game trails above deep drifts and hidden stone.",
    requiredHuntingLevel: 35,
    accidentChance: 0.08,
    accidentDamageMin: 5,
    accidentDamageMax: 12,
    sortOrder: 10,
    creatures: [
      { name: "Mountain Goat", encounterWeight: 5 },
      { name: "Frostfang Lynx", encounterWeight: 2 },
    ],
  },
  {
    locationName: "Ruins of Caldrath",
    name: "Broken Gardens",
    description:
      "Overgrown terraces and roofless courts draw prey, predators, and hunters into close quarters.",
    requiredHuntingLevel: 52,
    accidentChance: 0.075,
    accidentDamageMin: 5,
    accidentDamageMax: 13,
    sortOrder: 10,
    creatures: [
      { name: "Red Deer", encounterWeight: 3 },
      { name: "Grey Wolf", encounterWeight: 3 },
      { name: "Ashback Bear", encounterWeight: 1 },
    ],
  },
  {
    locationName: "Mount Doom",
    name: "Cinderwood Shelf",
    description:
      "Charred woodland clings to volcanic ledges where heat haze and brittle ground hide every misstep.",
    requiredHuntingLevel: 70,
    accidentChance: 0.1,
    accidentDamageMin: 7,
    accidentDamageMax: 16,
    sortOrder: 10,
    creatures: [
      { name: "Mountain Goat", encounterWeight: 3 },
      { name: "Ashback Bear", encounterWeight: 2 },
    ],
  },
  {
    locationName: "Pirate Island",
    name: "Mangrove Channels",
    description:
      "Tidal roots and hidden pools make quiet progress possible, but retreat difficult.",
    requiredHuntingLevel: 80,
    accidentChance: 0.09,
    accidentDamageMin: 6,
    accidentDamageMax: 15,
    sortOrder: 10,
    creatures: [
      { name: "Marsh Crocodile", encounterWeight: 4 },
      { name: "Wild Boar", encounterWeight: 2 },
    ],
  },
] as const satisfies readonly GroundDefinition[];

export const HUNTING_DURATIONS = [
  {
    label: "1 hour",
    durationSeconds: 3_600,
    encounterRolls: 2,
    quantityMultiplier: 1,
    dangerMultiplier: 0.8,
    xpReward: 20,
    requiredHuntingLevel: 1,
    sortOrder: 10,
  },
  {
    label: "2 hours",
    durationSeconds: 7_200,
    encounterRolls: 4,
    quantityMultiplier: 1.12,
    dangerMultiplier: 1,
    xpReward: 46,
    requiredHuntingLevel: 15,
    sortOrder: 20,
  },
  {
    label: "3 hours",
    durationSeconds: 10_800,
    encounterRolls: 6,
    quantityMultiplier: 1.28,
    dangerMultiplier: 1.12,
    xpReward: 78,
    requiredHuntingLevel: 50,
    sortOrder: 30,
  },
  {
    label: "4 hours",
    durationSeconds: 14_400,
    encounterRolls: 8,
    quantityMultiplier: 1.48,
    dangerMultiplier: 1.25,
    xpReward: 116,
    requiredHuntingLevel: 100,
    sortOrder: 40,
  },
] as const;

export function huntingItemData(definition: HuntingItemDefinition) {
  return {
    name: definition.name,
    description: definition.description,
    itemType: definition.itemType,
    rarity: definition.rarity,
    price: definition.price,
    sprite: definition.sprite,
    equipTo: null,
    stackable: true,
    maxStackSize: 9_999,
    requiredLevel: 1,
  } as const;
}
