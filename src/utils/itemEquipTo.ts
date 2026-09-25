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
    slot: "offhand",
    dbField: "offhandItemId",
    index: 116,
    equipTo: "offhand",
  },
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
  {
    slot: "fishingRod",
    dbField: "fishingRodItemId",
    index: 117,
    equipTo: "fishingRod",
  },
  { slot: "hoe", dbField: "hoeItemId", index: 118, equipTo: "hoe" },
] as const satisfies readonly {
  slot: string;
  dbField: string;
  index: number;
  equipTo: ItemEquipTo;
}[];

export type EquipmentSlotKey = (typeof EQUIPMENT_SLOTS)[number]["slot"];
export type EquipmentDbField = (typeof EQUIPMENT_SLOTS)[number]["dbField"];

export type EquipmentItemReferences = Partial<
  Record<EquipmentDbField, number | null>
>;

/**
 * Resolve the unique UserItem instances referenced by the authoritative
 * Equipment row. UserItem.status is marketplace/inventory lifecycle state and
 * is not a second source of truth for which slots are equipped.
 */
export function getEquippedUserItemIds(
  equipment: EquipmentItemReferences | null | undefined,
): number[] {
  if (!equipment) return [];

  return [
    ...new Set(
      EQUIPMENT_SLOTS.map((definition) => equipment[definition.dbField]).filter(
        (value): value is number =>
          typeof value === "number" && Number.isSafeInteger(value) && value > 0,
      ),
    ),
  ];
}

export const EQUIPMENT_SLOT_KEYS = EQUIPMENT_SLOTS.map(
  (s) => s.slot,
) as EquipmentSlotKey[];

export const EQUIPMENT_ALLOWED_SLOT_SET = new Set<string>(EQUIPMENT_SLOT_KEYS);

// Drag-and-drop addresses equipment slots by index, past the inventory slots.
export const EQUIPMENT_INDEX_MAP = Object.fromEntries(
  EQUIPMENT_SLOTS.map((s) => [s.index, s.slot]),
) as Record<number, EquipmentSlotKey>;

export const EQUIPMENT_SLOT_TO_INDEX = Object.fromEntries(
  EQUIPMENT_SLOTS.map((s) => [s.slot, s.index]),
) as Record<EquipmentSlotKey, number>;

const allowed = new Set<string>(Object.values(ItemEquipTo) as string[]);

const aliases: Record<string, ItemEquipTo> = {
  ring1: "ring",
  ring2: "ring",
  shoulders: "pauldrons",
  legs: "greaves",
  axe: "fellingAxe",
  fellingaxe: "fellingAxe",
  shield: "offhand",
  fishingrod: "fishingRod",
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
