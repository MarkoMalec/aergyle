import { prisma } from "~/lib/prisma";
import type { EquipmentSlotsWithItems } from "~/types/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import {
  EQUIPMENT_SLOTS,
  getEquippedUserItemIds,
} from "~/utils/itemEquipTo";

/**
 * The character's equipment with each slot's item, creating the row on first
 * use.
 */
export async function loadEquipmentWithItems(
  userId: string,
): Promise<EquipmentSlotsWithItems> {
  const equipment = await prisma.equipment.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const items = await fetchUserItemsByIds(
    userId,
    getEquippedUserItemIds(equipment),
  );
  const itemsById = new Map(items.map((item) => [item.id, item]));

  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((definition) => {
      const userItemId = equipment[definition.dbField];
      return [
        definition.slot,
        userItemId ? itemsById.get(userItemId) ?? null : null,
      ];
    }),
  ) as EquipmentSlotsWithItems;
}
