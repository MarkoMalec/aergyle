import type { Prisma } from "../../src/generated/prisma/client";
import type {
  ItemEquipTo,
  ItemRarity,
  ItemStatRarityOverrideKind,
  ItemType,
  StatType,
} from "../../src/generated/prisma/enums";

export type WayfarerAccessoryFamily =
  | "rings"
  | "amulets"
  | "necklaces"
  | "backpacks";

export interface WayfarerAccessoryDefinition {
  slug: string;
  family: WayfarerAccessoryFamily;
  name: string;
  description: string;
  itemType: ItemType;
  equipTo: ItemEquipTo;
  rarity: ItemRarity;
  requiredLevel: number;
  price: number;
  /** COMMON-equivalent values. Instance creation applies rarity exactly once. */
  stats: Partial<Record<StatType, number>>;
  statRarityOverrides?: readonly {
    statType: StatType;
    rarity: ItemRarity;
    kind: ItemStatRarityOverrideKind;
    value: number;
  }[];
}

const ALL_RARITIES = [
  "WORTHLESS",
  "BROKEN",
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EXQUISITE",
  "EPIC",
  "ELITE",
  "UNIQUE",
  "LEGENDARY",
  "MYTHIC",
  "DIVINE",
] as const satisfies readonly ItemRarity[];

function fixedBackpackStats(carryingCapacity: number, movementSpeed: number) {
  return ALL_RARITIES.flatMap((rarity) => [
    {
      statType: "CARRYING_CAPACITY" as const,
      rarity,
      kind: "ABSOLUTE" as const,
      value: carryingCapacity,
    },
    ...(movementSpeed === 0
      ? []
      : [
          {
            statType: "MOVEMENT_SPEED" as const,
            rarity,
            kind: "ABSOLUTE" as const,
            value: movementSpeed,
          },
        ]),
  ]);
}

type BackpackDefinition = Omit<
  WayfarerAccessoryDefinition,
  "family" | "itemType" | "equipTo" | "stats" | "statRarityOverrides"
> & {
  /** Additional inventory slots while equipped. */
  slots: number;
  /** Load trade-off; zero keeps the entry out of the stat list. */
  movementSpeed: number;
};

function backpack({
  slots,
  movementSpeed,
  ...item
}: BackpackDefinition): WayfarerAccessoryDefinition {
  return {
    ...item,
    family: "backpacks",
    itemType: "BACKPACK",
    equipTo: "backpack",
    stats: {
      CARRYING_CAPACITY: slots,
      ...(movementSpeed === 0 ? {} : { MOVEMENT_SPEED: movementSpeed }),
    },
    // Capacity and load trade-offs are tier identities, never random rolls.
    statRarityOverrides: fixedBackpackStats(slots, movementSpeed),
  };
}

/** Grounded early-game accessories plus the full fifteen-tier backpack ladder. */
export const WAYFARER_ACCESSORIES: readonly WayfarerAccessoryDefinition[] = [
  {
    slug: "ironroot-band",
    family: "rings",
    name: "Ironroot Band",
    description:
      "Two strands of dark iron meet in a plain hammered knot. The broad band is more reassuring than elegant.",
    itemType: "RING",
    equipTo: "ring",
    rarity: "COMMON",
    requiredLevel: 1,
    price: 24,
    stats: { ARMOR: 3, HEALTH: 3 },
  },
  {
    slug: "tinkers-brass-signet",
    family: "rings",
    name: "Tinker's Brass Signet",
    description:
      "A worn brass signet stamped with a simple wheel, traded among traveling menders who value a steady hand.",
    itemType: "RING",
    equipTo: "ring",
    rarity: "UNCOMMON",
    requiredLevel: 10,
    price: 45,
    stats: { ACCURACY: 2, LUCK: 1 },
  },
  {
    slug: "pilgrims-bronze-ankh",
    family: "amulets",
    name: "Pilgrim's Bronze Ankh",
    description:
      "A hand-cast devotional token carried on a coarse cord. Its softened edges have passed through many worried fingers.",
    itemType: "AMULET",
    equipTo: "amulet",
    rarity: "COMMON",
    requiredLevel: 1,
    price: 30,
    stats: { PRAYER_POINTS: 2, MAGIC_RESIST: 2.3 },
  },
  {
    slug: "fordstone-talisman",
    family: "amulets",
    name: "Fordstone Talisman",
    description:
      "A river-smoothed stone whose pale natural seam resembles a safe crossing. Travelers rub it before entering cold water.",
    itemType: "AMULET",
    equipTo: "amulet",
    rarity: "UNCOMMON",
    requiredLevel: 60,
    price: 52,
    stats: { COLD_RESIST: 3.8, HEALTH: 23 },
  },
  {
    slug: "rowan-bead-necklace",
    family: "necklaces",
    name: "Rowan Bead Necklace",
    description:
      "Uneven rowan beads, a bone spacer, and a faded tassel strung by a patient hedge-worker. Simple, warm, and quietly focusing.",
    itemType: "NECKLACE",
    equipTo: "necklace",
    rarity: "UNCOMMON",
    requiredLevel: 10,
    price: 65,
    stats: { MAGIC_RESIST: 2.4, HEALTH_REGEN: 0.18 },
  },
  backpack({
    slug: "novices-satchel",
    name: "Novice's Satchel",
    description:
      "A small canvas satchel with one honest buckle and just enough room for the first steps beyond town.",
    rarity: "COMMON",
    requiredLevel: 1,
    price: 25,
    slots: 3,
    movementSpeed: 0,
  }),
  backpack({
    slug: "foragers-pouch",
    name: "Forager's Pouch",
    description:
      "A waxed field pouch with careful stitching and room for a day's finds, favored by new gatherers.",
    rarity: "COMMON",
    requiredLevel: 10,
    price: 60,
    slots: 5,
    movementSpeed: 0,
  }),
  backpack({
    slug: "trail-satchel",
    name: "Trail Satchel",
    description:
      "A weathered blue satchel with a blanket roll and a flask sleeve, made for the first roads away from home.",
    rarity: "UNCOMMON",
    requiredLevel: 20,
    price: 125,
    slots: 8,
    movementSpeed: -1,
  }),
  backpack({
    slug: "leatherway-pack",
    name: "Leatherway Pack",
    description:
      "Supple chestnut leather, stout rivets, and three useful pockets make this a trusted companion on a longer route.",
    rarity: "UNCOMMON",
    requiredLevel: 35,
    price: 230,
    slots: 11,
    movementSpeed: -1,
  }),
  backpack({
    slug: "scouts-knapsack",
    name: "Scout's Knapsack",
    description:
      "A compact green knapsack with reinforced corners and a rain cloak roll, light enough to keep pace with a scouting party.",
    rarity: "RARE",
    requiredLevel: 50,
    price: 420,
    slots: 15,
    movementSpeed: -2,
  }),
  backpack({
    slug: "rangers-fieldpack",
    name: "Ranger's Fieldpack",
    description:
      "A broad moss-green fieldpack, balanced with rope, bedroll, and deep compartments for weeks beyond the marked paths.",
    rarity: "RARE",
    requiredLevel: 70,
    price: 760,
    slots: 19,
    movementSpeed: -3,
  }),
  backpack({
    slug: "expedition-rucksack",
    name: "Expedition Rucksack",
    description:
      "Layered charcoal canvas and a reinforced base protect a well-ordered explorer's kit through rough country.",
    rarity: "EXQUISITE",
    requiredLevel: 95,
    price: 1_280,
    slots: 22,
    movementSpeed: -4,
  }),
  backpack({
    slug: "travelers-backpack",
    name: "Traveler's Backpack",
    description:
      "A capacious canvas pack with repaired seams, a wool bedroll, and enough straps to carry a long road's provisions. The extra weight slows its wearer.",
    rarity: "EXQUISITE",
    requiredLevel: 120,
    price: 1_900,
    slots: 25,
    movementSpeed: -5,
  }),
  backpack({
    slug: "wayfinders-pack",
    name: "Wayfinder's Pack",
    description:
      "An indigo weatherproof pack with a map tube and silver compass work, built for deliberate journeys into unfamiliar lands.",
    rarity: "EPIC",
    requiredLevel: 150,
    price: 2_700,
    slots: 29,
    movementSpeed: -5,
  }),
  backpack({
    slug: "caravan-pack",
    name: "Caravan Pack",
    description:
      "Oxblood leather panniers and a broad cargo harness turn a long merchant road into a manageable load.",
    rarity: "EPIC",
    requiredLevel: 185,
    price: 3_900,
    slots: 34,
    movementSpeed: -6,
  }),
  backpack({
    slug: "surveyors-rig",
    name: "Surveyor's Rig",
    description:
      "A storm-gray rig with measuring gear, scroll cases, and an unusually disciplined grid of compartments.",
    rarity: "ELITE",
    requiredLevel: 225,
    price: 5_600,
    slots: 40,
    movementSpeed: -6,
  }),
  backpack({
    slug: "trailblazers-loadpack",
    name: "Trailblazer's Loadpack",
    description:
      "Layered teal canvas, steel buckles, and sealed frontier pouches make this a serious loadout for uncut routes.",
    rarity: "ELITE",
    requiredLevel: 270,
    price: 8_000,
    slots: 47,
    movementSpeed: -7,
  }),
  backpack({
    slug: "wardens-supply-pack",
    name: "Warden's Supply Pack",
    description:
      "Deep green canvas, silver fittings, and a sheltered field lantern mark this masterwork for a wilderness warden.",
    rarity: "UNIQUE",
    requiredLevel: 320,
    price: 11_500,
    slots: 55,
    movementSpeed: -7,
  }),
  backpack({
    slug: "horizon-hauler",
    name: "Horizon Hauler",
    description:
      "Moon-silver clasps, a crystal vial, and layered storm canvas lend remarkable order to an immense traveling load.",
    rarity: "LEGENDARY",
    requiredLevel: 380,
    price: 16_500,
    slots: 64,
    movementSpeed: -8,
  }),
  backpack({
    slug: "atlas-bearers-pack",
    name: "Atlas Bearer's Pack",
    description:
      "A midnight masterwork of atlas medallions, violet canvas, and heirloom hardware for those who carry the farthest roads.",
    rarity: "MYTHIC",
    requiredLevel: 450,
    price: 24_000,
    slots: 74,
    movementSpeed: -8,
  }),
];

export function wayfarerAccessorySpritePath(
  item: WayfarerAccessoryDefinition,
): string {
  if (item.family === "backpacks") {
    return `/assets/items/backpacks/${item.slug}.png`;
  }
  return `/assets/items/accessories/${item.family}/${item.slug}.png`;
}

export function wayfarerAccessoryCreateData(
  item: WayfarerAccessoryDefinition,
): Prisma.ItemCreateInput {
  return {
    name: item.name,
    description: item.description,
    price: item.price,
    sprite: wayfarerAccessorySpritePath(item),
    itemType: item.itemType,
    equipTo: item.equipTo,
    rarity: item.rarity,
    requiredLevel: item.requiredLevel,
    stackable: false,
    maxStackSize: 1,
    flipNegativeStatsWithRarity: false,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    armor: item.stats.ARMOR ?? 0,
    stats: {
      create: Object.entries(item.stats).map(([statType, value]) => ({
        statType: statType as StatType,
        value,
      })),
    },
    statRarityOverrides: item.statRarityOverrides
      ? { create: [...item.statRarityOverrides] }
      : undefined,
  };
}
