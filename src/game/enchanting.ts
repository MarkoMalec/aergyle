// Enchanting rules shared by the server, the player UI and /admin/enchanting.
// Client-safe: no server imports. Design: docs/ENCHANTING_SYSTEM.md.
import { EnchantKind, ItemEquipTo } from "~/generated/prisma/enums";

export { EnchantKind };

/** 1-15 are +1..+15; 16-20 are the named tiers. */
export const MAX_PLUS_LEVEL = 15;
export const MAX_ENCHANT_LEVEL = 20;

export const ENCHANT_TIER_NAMES = [
  "Kindled",
  "Forged",
  "Hallowed",
  "Exalted",
  "Ascendant",
] as const;
const ROMAN = ["I", "II", "III", "IV", "V"] as const;

const ACCESSORY_SLOTS = new Set<ItemEquipTo>([
  ItemEquipTo.ring,
  ItemEquipTo.necklace,
  ItemEquipTo.amulet,
]);
const GEAR_SLOTS = new Set<ItemEquipTo>([
  ItemEquipTo.head,
  ItemEquipTo.chest,
  ItemEquipTo.pauldrons,
  ItemEquipTo.bracers,
  ItemEquipTo.gloves,
  ItemEquipTo.greaves,
  ItemEquipTo.boots,
  ItemEquipTo.belt,
  ItemEquipTo.weapon,
  ItemEquipTo.offhand,
]);

/** Which ladder an item climbs, or null when it can't be enchanted. */
export function enchantKindOf(item: {
  equipTo: ItemEquipTo | null;
  stackable: boolean;
}): EnchantKind | null {
  if (!item.equipTo || item.stackable) return null;
  if (ACCESSORY_SLOTS.has(item.equipTo)) return EnchantKind.ACCESSORY;
  if (GEAR_SLOTS.has(item.equipTo)) return EnchantKind.GEAR;
  return null;
}

/** The level a success leads to; null at the top. Accessories skip +1..+15. */
export function nextEnchantLevel(kind: EnchantKind, level: number) {
  if (level >= MAX_ENCHANT_LEVEL) return null;
  if (kind === EnchantKind.ACCESSORY && level < MAX_PLUS_LEVEL + 1) {
    return MAX_PLUS_LEVEL + 1;
  }
  return level + 1;
}

/** The levels a kind can reach, in order. */
export function enchantLevelsFor(kind: EnchantKind) {
  const first = kind === EnchantKind.ACCESSORY ? MAX_PLUS_LEVEL + 1 : 1;
  return Array.from(
    { length: MAX_ENCHANT_LEVEL - first + 1 },
    (_, i) => first + i,
  );
}

/** "+7", "Kindled (I)", or "" for an unenchanted item. */
export function enchantLabel(level: number) {
  if (level <= 0) return "";
  if (level <= MAX_PLUS_LEVEL) return `+${level}`;
  const tier = level - MAX_PLUS_LEVEL - 1;
  return `${ENCHANT_TIER_NAMES[tier]} (${ROMAN[tier]})`;
}

/** Compact badge for item art: "+7", "I" … "V", or "". */
export function enchantBadge(level: number) {
  if (level <= 0) return "";
  if (level <= MAX_PLUS_LEVEL) return `+${level}`;
  return ROMAN[level - MAX_PLUS_LEVEL - 1] ?? "";
}

/** "+7 Iron Greataxe", "Kindled (I) Silver Ring", or just the name. */
export function enchantedItemName(name: string, level: number) {
  const label = enchantLabel(level);
  return label ? `${label} ${name}` : name;
}

export type EnchantLevelSettings = {
  successChance: number;
  goldCost: number;
  statBonusPercent: number;
  dropOnFail: boolean;
};

export type EnchantGlobalSettings = {
  pityPerFailure: number;
  pityCap: number;
  levelCostDivisor: number;
};

export const DEFAULT_ENCHANT_GLOBALS: EnchantGlobalSettings = {
  pityPerFailure: 0.0025,
  pityCap: 0.025,
  levelCostDivisor: 50,
};

const GEAR_CHANCES = [
  1, 1, 0.95, 0.9, 0.85, 0.75, 0.65, 0.55, 0.47, 0.4, 0.34, 0.28, 0.23, 0.19,
  0.15, 0.12, 0.09, 0.07, 0.05, 0.03,
];
const ACCESSORY_CHANCES = [0.25, 0.18, 0.12, 0.08, 0.05];

/** Two significant digits, so default costs read as round numbers. */
function roundCost(value: number) {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / step) * step;
}

/** Used until /admin/enchanting saves a row for the level. */
export function defaultEnchantLevel(
  kind: EnchantKind,
  level: number,
): EnchantLevelSettings {
  const named = level > MAX_PLUS_LEVEL;
  const tier = level - MAX_PLUS_LEVEL; // 1-5 for named tiers
  const goldCost = roundCost(400 * 1.35 ** (level - 1));
  if (kind === EnchantKind.ACCESSORY) {
    return {
      successChance: ACCESSORY_CHANCES[tier - 1] ?? 0,
      goldCost,
      statBonusPercent: 10 * tier,
      dropOnFail: false,
    };
  }
  return {
    successChance: GEAR_CHANCES[level - 1] ?? 0,
    goldCost,
    statBonusPercent: named ? 22.5 + 6 * tier : 1.5 * level,
    // Failing from Kindled up costs a level; Kindled itself can't drop.
    dropOnFail: level > MAX_PLUS_LEVEL + 1,
  };
}

/** Gold for one attempt: the level cost scaled by the item's level. */
export function enchantGoldCost(
  baseCost: number,
  requiredLevel: number | null | undefined,
  levelCostDivisor: number,
) {
  const factor =
    1 + Math.max(0, requiredLevel ?? 1) / Math.max(1, levelCostDivisor);
  return Math.round(Math.max(0, baseCost) * factor);
}

/** Success chance after pity: a small, capped bonus per earlier failure. */
export function enchantChance(
  baseChance: number,
  failures: number,
  globals: Pick<EnchantGlobalSettings, "pityPerFailure" | "pityCap">,
) {
  const pity = Math.min(
    globals.pityCap,
    Math.max(0, failures) * globals.pityPerFailure,
  );
  return Math.min(1, Math.max(0, baseChance + pity));
}

/** The level a failed attempt leaves the item at (accessories break instead). */
export function levelAfterFailure(level: number, dropOnFail: boolean) {
  return dropOnFail ? Math.max(0, level - 1) : level;
}

/** Global stat bonus (percent) per ladder and level, as /admin/enchanting has it. */
export type EnchantBonusTable = Record<EnchantKind, Record<number, number>>;

/** The table from saved rows, with code defaults for levels never saved. */
export function enchantBonusTable(
  saved: ReadonlyArray<{
    kind: EnchantKind;
    level: number;
    statBonusPercent: number;
  }>,
): EnchantBonusTable {
  const table = {} as EnchantBonusTable;
  for (const kind of Object.values(EnchantKind)) {
    table[kind] = {};
    for (const level of enchantLevelsFor(kind)) {
      table[kind][level] =
        saved.find((r) => r.kind === kind && r.level === level)
          ?.statBonusPercent ??
        defaultEnchantLevel(kind, level).statBonusPercent;
    }
  }
  return table;
}
