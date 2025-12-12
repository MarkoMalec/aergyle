import { Item } from "@prisma/client";
import { ItemWithStats } from "./stats";

export type InventorySlot = {
  slotIndex: number;
  itemId: number | null;
};

// Inventory slot with populated item data (for display)
export type InventorySlotWithItem = {
  slotIndex: number;
  item: ItemWithStats | null;
};

export type EquipmentSlotType =
  | "head"
  | "necklace"
  | "chest"
  | "pauldrons"
  | "bracers"
  | "gloves"
  | "greaves"
  | "boots"
  | "belt"
  | "ring1"
  | "ring2"
  | "amulet"
  | "backpack"
  | "weapon";

// Equipment structure storing item IDs
export type EquipmentSlots = Record<EquipmentSlotType, number | null>;

// Equipment with populated item data (for display)
export type EquipmentSlotsWithItems = Record<EquipmentSlotType, ItemWithStats | null>;

// Equipment slot index mapping for DnD
export const EQUIPMENT_INDEX_MAP: Record<number, EquipmentSlotType> = {
  100: "head",
  101: "necklace",
  102: "pauldrons",
  103: "chest",
  104: "bracers",
  105: "gloves",
  106: "greaves",
  107: "boots",
  108: "belt",
  109: "ring1",
  110: "ring2",
  111: "amulet",
  112: "backpack",
  113: "weapon",
};

// Reverse mapping for getting index from slot type
export const EQUIPMENT_SLOT_TO_INDEX: Record<EquipmentSlotType, number> = {
  head: 100,
  necklace: 101,
  pauldrons: 102,
  chest: 103,
  bracers: 104,
  gloves: 105,
  greaves: 106,
  boots: 107,
  belt: 108,
  ring1: 109,
  ring2: 110,
  amulet: 111,
  backpack: 112,
  weapon: 113,
};

// Valid equipment slot types that items can be equipped to
export type ValidEquipSlot =
  | "head"
  | "necklace"
  | "chest"
  | "pauldrons"
  | "bracers"
  | "gloves"
  | "greaves"
  | "boots"
  | "belt"
  | "ring"
  | "amulet"
  | "backpack"
  | "weapon";
