import { ItemEquipTo } from "~/generated/prisma/enums";

export const EQUIPMENT_SLOTS = [
  { slot: "head", dbField: "headItemId", index: 100, equipTo: "head" },
  {
    slot: "necklace",
    dbField: "necklaceItemId",
    index: 101,
    equipTo: "necklace",
  },
  {
    slot: "pauldrons",
    dbField: "pauldronsItemId",
    index: 102,
    equipTo: "pauldrons",
  },
  { slot: "chest", dbField: "chestItemId", index: 103, equipTo: "chest" },
  {
    slot: "bracers",
    dbField: "bracersItemId",
    index: 104,
    equipTo: "bracers",
  },
  {
    slot: "gloves",
    dbField: "glovesItemId",
    index: 105,
    equipTo: "gloves",
  },
  {
    slot: "greaves",
    dbField: "greavesItemId",
    index: 106,
    equipTo: "greaves",
  },
  { slot: "boots", dbField: "bootsItemId", index: 107, equipTo: "boots" },
  { slot: "belt", dbField: "beltItemId", index: 108, equipTo: "belt" },
  { slot: "ring1", dbField: "ring1ItemId", index: 109, equipTo: "ring" },
  { slot: "ring2", dbField: "ring2ItemId", index: 110, equipTo: "ring" },
  { slot: "amulet", dbField: "amuletItemId", index: 111, equipTo: "amulet" },
  {
    slot: "backpack",
    dbField: "backpackItemId",
    index: 112,
    equipTo: "backpack",
  },
  { slot: "weapon", dbField: "weaponItemId", index: 113, equipTo: "weapon" },
  {
    slot: "fellingAxe",
    dbField: "fellingAxeItemId",
    index: 114,
    equipTo: "fellingAxe",
  },
  {
    slot: "pickaxe",
    dbField: "pickaxeItemId",
    index: 115,
    equipTo: "pickaxe",
  },
] as const satisfies readonly {
  slot: string;
  dbField: string;
  index: number;
  equipTo: ItemEquipTo;
}[];

export type EquipmentSlotKey = (typeof EQUIPMENT_SLOTS)[number]["slot"];
export type EquipmentDbField = (typeof EQUIPMENT_SLOTS)[number]["dbField"];

export const EQUIPMENT_SLOT_KEYS = EQUIPMENT_SLOTS.map(
  (s) => s.slot,
) as EquipmentSlotKey[];

export const EQUIPMENT_ALLOWED_SLOT_SET = new Set<string>(EQUIPMENT_SLOT_KEYS);

const allowed = new Set<string>(Object.values(ItemEquipTo) as string[]);

const aliases: Record<string, ItemEquipTo> = {
  ring1: "ring",
  ring2: "ring",
  shoulders: "pauldrons",
  legs: "greaves",
  axe: "fellingAxe",
  fellingaxe: "fellingAxe",
};

export function normalizeItemEquipTo(
  value: string | null | undefined,
): ItemEquipTo | null {
  if (value == null) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase();
  const aliased = aliases[normalized] ?? normalized;

  return allowed.has(aliased) ? (aliased as ItemEquipTo) : null;
}

export function isItemEquipTo(
  value: string | null | undefined,
): value is ItemEquipTo {
  return normalizeItemEquipTo(value) != null;
}
