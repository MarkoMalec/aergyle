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

function fixedBackpackStats() {
  return ALL_RARITIES.flatMap((rarity) => [
    {
      statType: "CARRYING_CAPACITY" as const,
      rarity,
      kind: "ABSOLUTE" as const,
      value: 50,
    },
    {
      statType: "MOVEMENT_SPEED" as const,
      rarity,
      kind: "ABSOLUTE" as const,
      value: -5,
    },
  ]);
}

/** Six grounded early-game accessories with no set bonuses or implicit effects. */
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
    stats: { ARMOR: 1, HEALTH: 8 },
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
    requiredLevel: 3,
    price: 45,
    stats: { ACCURACY: 3, LUCK: 1 },
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
    requiredLevel: 2,
    price: 30,
    stats: { PRAYER_POINTS: 5, MAGIC_RESIST: 2 },
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
    requiredLevel: 4,
    price: 52,
    stats: { COLD_RESIST: 4, HEALTH: 6 },
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
    requiredLevel: 5,
    price: 65,
    stats: { MANA: 12, MANA_REGEN: 0.25 },
  },
  {
    slug: "travelers-backpack",
    family: "backpacks",
    name: "Traveler's Backpack",
    description:
      "A capacious canvas pack with repaired seams, a wool bedroll, and enough straps to carry a long road's provisions. The extra weight slows its wearer.",
    itemType: "BACKPACK",
    equipTo: "backpack",
    rarity: "COMMON",
    requiredLevel: 5,
    price: 180,
    stats: { CARRYING_CAPACITY: 50, MOVEMENT_SPEED: -5 },
    // These are the item's identity and remain exact if an instance changes rarity.
    statRarityOverrides: fixedBackpackStats(),
  },
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
