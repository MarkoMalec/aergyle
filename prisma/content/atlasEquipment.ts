import type {
  ItemEquipTo,
  ItemRarity,
  ItemType,
  StatType,
} from "../../src/generated/prisma/enums";
import type { Prisma } from "../../src/generated/prisma/client";

export type AtlasSet = "trailwarden" | "duskwarden";

export interface AtlasItemDefinition {
  slug: string;
  set: AtlasSet | null;
  name: string;
  description: string;
  itemType: ItemType;
  equipTo: ItemEquipTo;
  twoHanded?: boolean;
  rarity: ItemRarity;
  requiredLevel: number;
  price: number;
  /** COMMON-equivalent values. Instance creation applies rarity exactly once. */
  stats: Partial<Record<StatType, number>>;
}

export const ATLAS_ARMOR_SLOTS = [
  "head",
  "chest",
  "pauldrons",
  "bracers",
  "gloves",
  "belt",
  "greaves",
  "boots",
] as const satisfies readonly ItemEquipTo[];

function armor(
  set: AtlasSet,
  suffix: string,
  name: string,
  itemType: ItemType,
  equipTo: ItemEquipTo,
  price: number,
  description: string,
  stats: AtlasItemDefinition["stats"],
): AtlasItemDefinition {
  const beginner = set === "trailwarden";
  return {
    slug: `${set}-${suffix}`,
    set,
    name: `${beginner ? "Trailwarden" : "Duskwarden"} ${name}`,
    description,
    itemType,
    equipTo,
    rarity: beginner ? "RARE" : "EPIC",
    requiredLevel: beginner ? 1 : 300,
    price,
    stats,
  };
}

/** Six weapons and two complete, eight-slot armor sets. No implicit set bonuses. */
export const ATLAS_EQUIPMENT: readonly AtlasItemDefinition[] = [
  {
    slug: "wayfarer-shortblade",
    set: null,
    name: "Wayfarer Shortblade",
    description:
      "A dependable iron blade carried by wardens on their first journey. Its broad edge forgives an uncertain hand.",
    itemType: "SWORD",
    equipTo: "weapon",
    rarity: "RARE",
    requiredLevel: 10,
    price: 110,
    stats: {
      PHYSICAL_DAMAGE_MIN: 15,
      PHYSICAL_DAMAGE_MAX: 24,
      ATTACK_SPEED: 0.95,
      ACCURACY: 4,
    },
  },
  {
    slug: "briarcleaver",
    set: null,
    name: "Briarcleaver",
    description:
      "A hooked fighting axe forged for the thorn roads. The heavy iron beak catches a guard and pulls it aside.",
    itemType: "AXE",
    equipTo: "weapon",
    rarity: "RARE",
    requiredLevel: 30,
    price: 650,
    stats: {
      PHYSICAL_DAMAGE_MIN: 41,
      PHYSICAL_DAMAGE_MAX: 76,
      ATTACK_SPEED: 0.8,
      CRITICAL_DAMAGE: 14,
    },
  },
  {
    slug: "reedwind-bow",
    set: null,
    name: "Reedwind Bow",
    description:
      "Recurved ash limbs bend like reeds in a river wind. A patient archer can place a shot through a narrow opening.",
    itemType: "BOW",
    equipTo: "weapon",
    rarity: "RARE",
    requiredLevel: 60,
    price: 1800,
    stats: {
      PHYSICAL_DAMAGE_MIN: 71,
      PHYSICAL_DAMAGE_MAX: 106,
      ATTACK_SPEED: 1,
      ACCURACY: 10,
      CRITICAL_CHANCE: 2.8,
    },
  },
  {
    slug: "cindermaul",
    set: null,
    name: "Cindermaul",
    description:
      "Copper-red insets mark this heavy flanged mace as the work of the Cinderwatch foundry. Built for a fighter who holds their ground.",
    itemType: "MACE",
    equipTo: "weapon",
    rarity: "EPIC",
    requiredLevel: 120,
    price: 4600,
    stats: {
      PHYSICAL_DAMAGE_MIN: 251,
      PHYSICAL_DAMAGE_MAX: 377,
      ATTACK_SPEED: 0.55,
      ARMOR: 29,
      HEALTH: 63,
    },
  },
  {
    slug: "ogre-cleaver",
    set: null,
    name: "Ogre Cleaver",
    description:
      "A butcher's blade wrenched from an ogre's hand. Its black iron slab has no finesse, only an edge heavy enough to break a guard.",
    itemType: "GREATAXE",
    equipTo: "weapon",
    twoHanded: true,
    rarity: "RARE",
    requiredLevel: 100,
    price: 3400,
    stats: {
      PHYSICAL_DAMAGE_MIN: 246,
      PHYSICAL_DAMAGE_MAX: 333,
      ATTACK_SPEED: 0.65,
      CRITICAL_DAMAGE: 26,
    },
  },
  {
    slug: "duskglass-staff",
    set: null,
    name: "Duskglass Staff",
    description:
      "A smoky duskglass crystal rests in a brass fork above dark ash. Its quiet focus rewards a practiced spellcaster.",
    itemType: "STAFF",
    equipTo: "weapon",
    rarity: "EPIC",
    requiredLevel: 260,
    price: 7800,
    stats: {
      MAGIC_DAMAGE_MIN: 451,
      MAGIC_DAMAGE_MAX: 676,
      ATTACK_SPEED: 0.85,
      CRITICAL_CHANCE: 8.6,
    },
  },

  armor(
    "trailwarden",
    "helm",
    "Helm",
    "HELMET",
    "head",
    70,
    "An iron brow and padded leather crown protect a new trailwarden without obscuring the road ahead.",
    { ARMOR: 5, HEALTH: 5 },
  ),
  armor(
    "trailwarden",
    "jerkin",
    "Jerkin",
    "CHESTPLATE",
    "chest",
    125,
    "Two fitted iron plates reinforce this moss-lined leather jerkin. The stitched chevron is the mark of the Trailwardens.",
    { ARMOR: 10, HEALTH: 9 },
  ),
  armor(
    "trailwarden",
    "pauldrons",
    "Pauldrons",
    "PAULDRONS",
    "pauldrons",
    65,
    "Paired iron shoulder caps over supple leather, made to turn a glancing blow on a first expedition.",
    { ARMOR: 4, HEALTH: 4 },
  ),
  armor(
    "trailwarden",
    "bracers",
    "Bracers",
    "BRACERS",
    "bracers",
    55,
    "Broad iron splints steady the forearms while well-worn straps leave the wrists free.",
    { ARMOR: 3, ACCURACY: 1 },
  ),
  armor(
    "trailwarden",
    "gloves",
    "Gloves",
    "GLOVES",
    "gloves",
    60,
    "Soft leather palms and a modest knuckle plate keep a beginner's grip sure in poor weather.",
    { ARMOR: 3, CRITICAL_CHANCE: 1.3 },
  ),
  armor(
    "trailwarden",
    "belt",
    "Belt",
    "BELT",
    "belt",
    50,
    "A wide, moss-lined leather belt with a plain iron buckle. Its familiar chevron is stitched to last.",
    { ARMOR: 3, HEALTH: 3 },
  ),
  armor(
    "trailwarden",
    "greaves",
    "Greaves",
    "GREAVES",
    "greaves",
    95,
    "Strapped iron shin guards backed with leather, bearing the small scuffs of a road well traveled.",
    { ARMOR: 7, HEALTH: 6 },
  ),
  armor(
    "trailwarden",
    "boots",
    "Boots",
    "BOOTS",
    "boots",
    75,
    "Stout leather boots with iron toes and moss-colored lining, ready for a long day on an unfamiliar trail.",
    { ARMOR: 4, HEALTH: 2, MOVEMENT_SPEED: 1.1 },
  ),

  armor(
    "duskwarden",
    "helm",
    "Helm",
    "HELMET",
    "head",
    3200,
    "A closed midnight-steel helm crowned by the Duskwardens' brass compass point. Its narrow visor holds the horizon in focus.",
    { ARMOR: 77, HEALTH: 105, MAGIC_RESIST: 5.8 },
  ),
  armor(
    "duskwarden",
    "cuirass",
    "Cuirass",
    "CHESTPLATE",
    "chest",
    5400,
    "Sculpted midnight steel shields the heart behind a raised brass-edged kite. Indigo padding softens the weight of a veteran's duty.",
    { ARMOR: 148, HEALTH: 203, MAGIC_RESIST: 11.1 },
  ),
  armor(
    "duskwarden",
    "pauldrons",
    "Pauldrons",
    "PAULDRONS",
    "pauldrons",
    2900,
    "Layered steel shoulder guards flare into restrained points. Their brass edges bear the heat marks of distant campaigns.",
    { ARMOR: 65, HEALTH: 89, FIRE_RESIST: 6.1 },
  ),
  armor(
    "duskwarden",
    "vambraces",
    "Vambraces",
    "BRACERS",
    "bracers",
    2300,
    "Kite-shaped steel plates protect a veteran's forearms while indigo lining keeps every measured movement precise.",
    { ARMOR: 47, MAGIC_RESIST: 3.6, ACCURACY: 19 },
  ),
  armor(
    "duskwarden",
    "gauntlets",
    "Gauntlets",
    "GLOVES",
    "gloves",
    2600,
    "Articulated midnight-steel fingers close beneath brass-edged knuckle plates, balancing protection with a practiced hand's speed.",
    { ARMOR: 47, CRITICAL_CHANCE: 3 },
  ),
  armor(
    "duskwarden",
    "girdle",
    "Girdle",
    "BELT",
    "belt",
    2200,
    "A substantial compass-point buckle anchors this indigo-backed steel girdle, made for those who endure the longest watch.",
    { ARMOR: 47, HEALTH: 65, HEALTH_REGEN: 1.85 },
  ),
  armor(
    "duskwarden",
    "greaves",
    "Greaves",
    "GREAVES",
    "greaves",
    4200,
    "Long keeled shin plates and angular knee guards turn aside the cold and hard edges of the northern passes.",
    { ARMOR: 107, HEALTH: 146, COLD_RESIST: 10 },
  ),
  armor(
    "duskwarden",
    "sabatons",
    "Sabatons",
    "BOOTS",
    "boots",
    2800,
    "Broad articulated steel boots lined with indigo cloth. A Duskwarden learns to cross broken ground with deliberate, quiet steps.",
    { ARMOR: 53, HEALTH: 65, MOVEMENT_SPEED: 2.2, EVASION_MELEE: 2.2 },
  ),
];

export function atlasSpritePath(item: AtlasItemDefinition): string {
  return `/assets/items/${item.set ? "armor" : "weapons"}/${item.slug}-atlas-v1.png`;
}

export function atlasItemCreateData(
  item: AtlasItemDefinition,
): Prisma.ItemCreateInput {
  return {
    name: item.name,
    description: item.description,
    price: item.price,
    sprite: atlasSpritePath(item),
    itemType: item.itemType,
    equipTo: item.equipTo,
    twoHanded: item.twoHanded ?? false,
    rarity: item.rarity,
    requiredLevel: item.requiredLevel,
    stackable: false,
    maxStackSize: 1,
    flipNegativeStatsWithRarity: false,
    minPhysicalDamage: item.stats.PHYSICAL_DAMAGE_MIN ?? 0,
    maxPhysicalDamage: item.stats.PHYSICAL_DAMAGE_MAX ?? 0,
    minMagicDamage: item.stats.MAGIC_DAMAGE_MIN ?? 0,
    maxMagicDamage: item.stats.MAGIC_DAMAGE_MAX ?? 0,
    armor: item.stats.ARMOR ?? 0,
    stats: {
      create: Object.entries(item.stats).map(([statType, value]) => ({
        statType: statType as StatType,
        value,
      })),
    },
  };
}
