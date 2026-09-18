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
    requiredLevel: beginner ? 1 : 50,
    price,
    stats,
  };
}

/** Five weapons and two complete, eight-slot armor sets. No implicit set bonuses. */
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
    requiredLevel: 1,
    price: 110,
    stats: {
      PHYSICAL_DAMAGE_MIN: 5,
      PHYSICAL_DAMAGE_MAX: 9,
      ATTACK_SPEED: 0.95,
      ACCURACY: 2,
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
    requiredLevel: 10,
    price: 650,
    stats: {
      PHYSICAL_DAMAGE_MIN: 18,
      PHYSICAL_DAMAGE_MAX: 29,
      ATTACK_SPEED: 0.8,
      CRITICAL_DAMAGE: 8,
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
    requiredLevel: 20,
    price: 1800,
    stats: {
      PHYSICAL_DAMAGE_MIN: 30,
      PHYSICAL_DAMAGE_MAX: 46,
      ATTACK_SPEED: 1,
      ACCURACY: 12,
      CRITICAL_CHANCE: 5,
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
    requiredLevel: 35,
    price: 4600,
    stats: {
      PHYSICAL_DAMAGE_MIN: 52,
      PHYSICAL_DAMAGE_MAX: 78,
      ATTACK_SPEED: 0.55,
      ARMOR: 12,
      HEALTH: 40,
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
    requiredLevel: 50,
    price: 7800,
    stats: {
      MAGIC_DAMAGE_MIN: 72,
      MAGIC_DAMAGE_MAX: 108,
      ATTACK_SPEED: 0.85,
      MANA: 80,
      MANA_REGEN: 2,
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
    { ARMOR: 6, HEALTH: 12 },
  ),
  armor(
    "trailwarden",
    "jerkin",
    "Jerkin",
    "CHESTPLATE",
    "chest",
    125,
    "Two fitted iron plates reinforce this moss-lined leather jerkin. The stitched chevron is the mark of the Trailwardens.",
    { ARMOR: 12, HEALTH: 24 },
  ),
  armor(
    "trailwarden",
    "pauldrons",
    "Pauldrons",
    "PAULDRONS",
    "pauldrons",
    65,
    "Paired iron shoulder caps over supple leather, made to turn a glancing blow on a first expedition.",
    { ARMOR: 5, HEALTH: 10 },
  ),
  armor(
    "trailwarden",
    "bracers",
    "Bracers",
    "BRACERS",
    "bracers",
    55,
    "Broad iron splints steady the forearms while well-worn straps leave the wrists free.",
    { ARMOR: 3, ACCURACY: 2 },
  ),
  armor(
    "trailwarden",
    "gloves",
    "Gloves",
    "GLOVES",
    "gloves",
    60,
    "Soft leather palms and a modest knuckle plate keep a beginner's grip sure in poor weather.",
    { ARMOR: 3, ATTACK_SPEED: 0.04, CRITICAL_CHANCE: 1 },
  ),
  armor(
    "trailwarden",
    "belt",
    "Belt",
    "BELT",
    "belt",
    50,
    "A wide, moss-lined leather belt with a plain iron buckle. Its familiar chevron is stitched to last.",
    { ARMOR: 3, HEALTH: 16 },
  ),
  armor(
    "trailwarden",
    "greaves",
    "Greaves",
    "GREAVES",
    "greaves",
    95,
    "Strapped iron shin guards backed with leather, bearing the small scuffs of a road well traveled.",
    { ARMOR: 8, HEALTH: 16 },
  ),
  armor(
    "trailwarden",
    "boots",
    "Boots",
    "BOOTS",
    "boots",
    75,
    "Stout leather boots with iron toes and moss-colored lining, ready for a long day on an unfamiliar trail.",
    { ARMOR: 4, HEALTH: 8, MOVEMENT_SPEED: 2 },
  ),

  armor(
    "duskwarden",
    "helm",
    "Helm",
    "HELMET",
    "head",
    3200,
    "A closed midnight-steel helm crowned by the Duskwardens' brass compass point. Its narrow visor holds the horizon in focus.",
    { ARMOR: 44, HEALTH: 90, MAGIC_RESIST: 10 },
  ),
  armor(
    "duskwarden",
    "cuirass",
    "Cuirass",
    "CHESTPLATE",
    "chest",
    5400,
    "Sculpted midnight steel shields the heart behind a raised brass-edged kite. Indigo padding softens the weight of a veteran's duty.",
    { ARMOR: 86, HEALTH: 180, MAGIC_RESIST: 18 },
  ),
  armor(
    "duskwarden",
    "pauldrons",
    "Pauldrons",
    "PAULDRONS",
    "pauldrons",
    2900,
    "Layered steel shoulder guards flare into restrained points. Their brass edges bear the heat marks of distant campaigns.",
    { ARMOR: 38, HEALTH: 70, FIRE_RESIST: 8 },
  ),
  armor(
    "duskwarden",
    "vambraces",
    "Vambraces",
    "BRACERS",
    "bracers",
    2300,
    "Kite-shaped steel plates protect a veteran's forearms while indigo lining keeps every measured movement precise.",
    { ARMOR: 28, MAGIC_RESIST: 8, ACCURACY: 8 },
  ),
  armor(
    "duskwarden",
    "gauntlets",
    "Gauntlets",
    "GLOVES",
    "gloves",
    2600,
    "Articulated midnight-steel fingers close beneath brass-edged knuckle plates, balancing protection with a practiced hand's speed.",
    { ARMOR: 26, ATTACK_SPEED: 0.12, CRITICAL_CHANCE: 4 },
  ),
  armor(
    "duskwarden",
    "girdle",
    "Girdle",
    "BELT",
    "belt",
    2200,
    "A substantial compass-point buckle anchors this indigo-backed steel girdle, made for those who endure the longest watch.",
    { ARMOR: 24, HEALTH: 100, HEALTH_REGEN: 1.8 },
  ),
  armor(
    "duskwarden",
    "greaves",
    "Greaves",
    "GREAVES",
    "greaves",
    4200,
    "Long keeled shin plates and angular knee guards turn aside the cold and hard edges of the northern passes.",
    { ARMOR: 62, HEALTH: 120, COLD_RESIST: 8 },
  ),
  armor(
    "duskwarden",
    "sabatons",
    "Sabatons",
    "BOOTS",
    "boots",
    2800,
    "Broad articulated steel boots lined with indigo cloth. A Duskwarden learns to cross broken ground with deliberate, quiet steps.",
    { ARMOR: 32, HEALTH: 60, MOVEMENT_SPEED: 6, EVASION_MELEE: 4 },
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
