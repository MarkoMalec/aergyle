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
export function canEquipToSlot(
  item: Pick<ItemWithStats, "equipTo">,
  slotType: string,
): boolean {
  if (!item.equipTo) return false;

  if (slotType === "ring1" || slotType === "ring2") {
    return item.equipTo === "ring";
  }

  return item.equipTo === slotType;
}

export function meetsItemLevelRequirement(
  item: Pick<ItemWithStats, "requiredLevel">,
  level: number,
): boolean {
  return (
    Number.isFinite(level) && level >= Math.max(1, item.requiredLevel ?? 1)
  );
}

type EquipmentCandidate = Pick<
  ItemWithStats,
  "id" | "name" | "equipTo" | "requiredLevel"
>;

/** Call with the authenticated player's available instances, never template IDs. */
export function getEquipmentValidationError(
  selection: Record<string, number | null>,
  availableItems: readonly EquipmentCandidate[],
  level: number,
): string | null {
  const byId = new Map(availableItems.map((item) => [item.id, item]));
  const used = new Set<number>();
  for (const [slot, id] of Object.entries(selection)) {
    if (id === null) continue;
    if (!Number.isSafeInteger(id) || id <= 0) return "Invalid equipment item.";
    const item = byId.get(id);
    if (!item)
      return "An equipment item is no longer available in your inventory.";
    if (used.has(id)) return "An item cannot occupy two equipment slots.";
    if (!canEquipToSlot(item, slot))
      return `${item.name} cannot be equipped in the ${slot} slot.`;
    if (!meetsItemLevelRequirement(item, level)) {
      return `Requires level ${item.requiredLevel ?? 1} to equip ${item.name}.`;
    }
    used.add(id);
  }
  return null;
}
