import { EquipmentSlotsWithItems } from "~/types/inventory";
import { ItemWithStats } from "~/types/stats";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import { EQUIPMENT_ALLOWED_SLOT_SET } from "~/utils/itemEquipTo";

/**
 * Validate equipment data
 */
export function validateEquipment(
  equipment: Record<string, number | null>,
): boolean {
  return Object.keys(equipment).every((key) =>
    EQUIPMENT_ALLOWED_SLOT_SET.has(key),
  );
}

/**
 * Populate equipment slots with item data
 */
export async function populateEquipmentSlots(
  equipmentIds: Record<string, number | null>,
): Promise<EquipmentSlotsWithItems> {
  const itemIds = Object.values(equipmentIds).filter(
    (id): id is number => id !== null,
  );

  console.log("populateEquipmentSlots - Item IDs to fetch:", itemIds);

  const items = await fetchUserItemsByIds(itemIds);

  console.log("populateEquipmentSlots - Fetched items:", items.map(i => ({ id: i.id, name: i.name })));

  const itemMap = new Map(items.map((item) => [item.id, item]));

  const result: Record<string, ItemWithStats | null> = {};
  for (const [slot, itemId] of Object.entries(equipmentIds)) {
    result[slot] = itemId ? itemMap.get(itemId) || null : null;
  }

  return result as EquipmentSlotsWithItems;
}
