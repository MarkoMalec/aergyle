import type { ItemEquipTo } from "~/generated/prisma/enums";
import { ItemWithStats } from "./stats";
import {
  EQUIPMENT_SLOTS,
  type EquipmentSlotKey,
} from "~/utils/itemEquipTo";

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
  EquipmentSlotKey;

// Equipment structure storing item IDs
export type EquipmentSlots = Record<EquipmentSlotType, number | null>;

// Equipment with populated item data (for display)
export type EquipmentSlotsWithItems = Record<EquipmentSlotType, ItemWithStats | null>;

// Equipment slot index mapping for DnD
export const EQUIPMENT_INDEX_MAP: Record<number, EquipmentSlotType> = {
  ...(Object.fromEntries(
    EQUIPMENT_SLOTS.map((s) => [s.index, s.slot] as const),
  ) as unknown as Record<number, EquipmentSlotType>),
};

// Reverse mapping for getting index from slot type
export const EQUIPMENT_SLOT_TO_INDEX: Record<EquipmentSlotType, number> = {
  ...(Object.fromEntries(
    EQUIPMENT_SLOTS.map((s) => [s.slot, s.index] as const),
  ) as unknown as Record<EquipmentSlotType, number>),
};

// Valid equipment slot types that items can be equipped to
export type ValidEquipSlot =
  ItemEquipTo;
