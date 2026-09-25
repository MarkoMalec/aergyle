import type { Prisma } from "../../src/generated/prisma/client";
import type { ItemRarity, ItemType } from "../../src/generated/prisma/enums";

export interface BaitItemDefinition {
  slug: string;
  name: string;
  description: string;
  itemType: ItemType;
  rarity: ItemRarity;
  requiredLevel: number;
  price: number;
}

/**
 * Fifteen bait-only fishing consumables, ordered from a first cast through
 * level-500 waters. Baits are stackable templates; catch-specific eligibility
 * remains configured by VocationalRequirement records.
 */
export const BAIT_ITEMS = [
  {
    slug: "dewslick-worm",
    name: "Dewslick Worm",
    description:
      "A plump rose-pink earthworm with an earthy scent that draws the first hungry fish of the day.",
    itemType: "BAIT",
    rarity: "COMMON",
    requiredLevel: 1,
    price: 4,
  },
  {
    slug: "reedhopper-nymph",
    name: "Reedhopper Nymph",
    description:
      "A stout olive marsh hopper whose dense little body stays tempting in slow water.",
    itemType: "BAIT",
    rarity: "COMMON",
    requiredLevel: 8,
    price: 7,
  },
  {
    slug: "brine-shrimp-cluster",
    name: "Brine Shrimp Cluster",
    description:
      "Three small coral-pink shrimp gathered into a compact, salty mouthful for coastal catches.",
    itemType: "BAIT",
    rarity: "UNCOMMON",
    requiredLevel: 16,
    price: 11,
  },
  {
    slug: "honeyed-caddis",
    name: "Honeyed Caddis",
    description:
      "A golden caddis larva with a rich, natural scent prized by patient river fish.",
    itemType: "BAIT",
    rarity: "UNCOMMON",
    requiredLevel: 28,
    price: 17,
  },
  {
    slug: "bogblood-leech",
    name: "Bogblood Leech",
    description:
      "A heavy plum-dark leech that coaxes large, cautious predators from deep marsh water.",
    itemType: "BAIT",
    rarity: "RARE",
    requiredLevel: 42,
    price: 26,
  },
  {
    slug: "frostcap-grub",
    name: "Frostcap Grub",
    description:
      "A pair of pale cold-water grubs with cool slate markings and a surprisingly fatty bite.",
    itemType: "BAIT",
    rarity: "RARE",
    requiredLevel: 58,
    price: 39,
  },
  {
    slug: "moonmidge-pupa",
    name: "Moonmidge Pupa",
    description:
      "Three silver-grey pupae with a soft pearly sheen, reserved for clear water after dusk.",
    itemType: "BAIT",
    rarity: "RARE",
    requiredLevel: 76,
    price: 57,
  },
  {
    slug: "ember-cricket",
    name: "Ember Cricket",
    description:
      "A dark mahogany cricket whose warm shell color stands out in volcanic and muddy shallows.",
    itemType: "BAIT",
    rarity: "EXQUISITE",
    requiredLevel: 98,
    price: 82,
  },
  {
    slug: "saltbone-squid-strip",
    name: "Saltbone Squid Strip",
    description:
      "Two clean curls of pale squid cut into a tough, high-scent bait for hard-fighting saltwater fish.",
    itemType: "BAIT",
    rarity: "EXQUISITE",
    requiredLevel: 122,
    price: 118,
  },
  {
    slug: "stormfin-fry",
    name: "Stormfin Fry",
    description:
      "A compact slate-blue baitfish with a dark flank bar, favored when rough water hides a subtle lure.",
    itemType: "BAIT",
    rarity: "EPIC",
    requiredLevel: 150,
    price: 168,
  },
  {
    slug: "nightscale-prawn",
    name: "Nightscale Prawn",
    description:
      "A thick deep-water prawn with a blue-black shell and a rich tail that draws nocturnal hunters.",
    itemType: "BAIT",
    rarity: "ELITE",
    requiredLevel: 185,
    price: 238,
  },
  {
    slug: "basilisk-beetle",
    name: "Basilisk Beetle",
    description:
      "A hardy jade-shelled beetle with a dense, crunchy carapace for stubborn river monsters.",
    itemType: "BAIT",
    rarity: "ELITE",
    requiredLevel: 225,
    price: 338,
  },
  {
    slug: "voidclam-flesh",
    name: "Voidclam Flesh",
    description:
      "A dense blue-black curl of clam flesh that keeps its scent even in the deepest channels.",
    itemType: "BAIT",
    rarity: "UNIQUE",
    requiredLevel: 270,
    price: 480,
  },
  {
    slug: "leviathan-lanternfish",
    name: "Leviathan Lanternfish",
    description:
      "A stout indigo baitfish with a pale lantern organ, coveted by the heaviest creatures below the shelf.",
    itemType: "BAIT",
    rarity: "LEGENDARY",
    requiredLevel: 325,
    price: 690,
  },
  {
    slug: "crown-tidewyrm",
    name: "Crown Tidewyrm",
    description:
      "A prestigious wine-purple tidewyrm with ivory plates and naturally gilded segment bands.",
    itemType: "BAIT",
    rarity: "MYTHIC",
    requiredLevel: 500,
    price: 1_000,
  },
] as const satisfies readonly BaitItemDefinition[];

export function baitSpritePath(item: BaitItemDefinition): string {
  return `/assets/items/consumables/bait/${item.slug}-baits-v1.png`;
}

export function baitItemCreateData(
  item: BaitItemDefinition,
): Prisma.ItemCreateInput {
  return {
    name: item.name,
    description: item.description,
    price: item.price,
    sprite: baitSpritePath(item),
    itemType: item.itemType,
    equipTo: null,
    stackable: true,
    maxStackSize: 9_999,
    rarity: item.rarity,
    requiredLevel: item.requiredLevel,
    flipNegativeStatsWithRarity: false,
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 0,
    maxMagicDamage: 0,
    armor: 0,
  };
}
