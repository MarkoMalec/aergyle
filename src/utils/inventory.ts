import { prisma } from "~/lib/prisma";
import type { EquipmentSlotsWithItems } from "~/types/inventory";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";
import {
  EQUIPMENT_SLOTS,
  getEquippedUserItemIds,
  type EquipmentItemReferences,
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
  return withEquippedItems(userId, equipment);
}

/** Another player's equipment, read without creating their row. */
export async function readEquipmentWithItems(
  userId: string,
): Promise<EquipmentSlotsWithItems> {
  const equipment = await prisma.equipment.findUnique({ where: { userId } });
  return withEquippedItems(userId, equipment);
}

async function withEquippedItems(
  userId: string,
  equipment: EquipmentItemReferences | null,
): Promise<EquipmentSlotsWithItems> {
  const items = await fetchUserItemsByIds(
    userId,
    getEquippedUserItemIds(equipment),
  );
  const itemsById = new Map(items.map((item) => [item.id, item]));

  return Object.fromEntries(
    EQUIPMENT_SLOTS.map((definition) => {
      const userItemId = equipment?.[definition.dbField];
      return [
        definition.slot,
        userItemId ? itemsById.get(userItemId) ?? null : null,
      ];
    }),
  ) as EquipmentSlotsWithItems;
}
