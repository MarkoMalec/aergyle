import type { ItemWithStats } from "~/types/stats";

/**
 * Client-safe inventory helpers.
 *
 * IMPORTANT: Do not import Prisma/db code from this module.
 */

/**
 * Check if an item can be equipped to a specific slot.
 * Handles special cases like rings.
 */
export function canEquipToSlot(item: ItemWithStats, slotType: string): boolean {
  if (!item.equipTo) return false;

  if (slotType === "ring1" || slotType === "ring2") {
    return item.equipTo === "ring";
  }

  return item.equipTo === slotType;
}
