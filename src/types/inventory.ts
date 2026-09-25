import type { ItemWithStats } from "./stats";
import type { EquipmentSlotKey } from "~/utils/itemEquipTo";

// Inventory slot with populated item data (for display)
export type InventorySlotWithItem = {
  slotIndex: number;
  item: ItemWithStats | null;
};

// Equipment with populated item data (for display)
export type EquipmentSlotsWithItems = Record<
  EquipmentSlotKey,
  ItemWithStats | null
>;
