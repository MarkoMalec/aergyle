import { prisma } from "~/lib/prisma";
import { Item } from "@prisma/client";
import { EquipmentSlotsWithItems, ValidEquipSlot } from "~/types/inventory";
import { ItemWithStats } from "~/types/stats";
import { fetchUserItemsByIds } from "~/utils/userItemInventory";

/**
 * Fetch multiple items by IDs in a single query
 * More efficient than individual queries
 */
export async function fetchItemsByIds(itemIds: number[]): Promise<ItemWithStats[]> {
  // Filter out undefined, null, and invalid values
  const validItemIds = itemIds.filter((id): id is number => 
    id !== undefined && id !== null && typeof id === 'number'
  );

  if (validItemIds.length === 0) return [];

  return await prisma.item.findMany({
    where: {
      id: { in: validItemIds },
    },
    include: {
      stats: true, // Include all detailed stats
    },
  });
}

/**
 * Fetch a single item by ID
 */
export async function fetchItemById(itemId: number): Promise<ItemWithStats | null> {
  return await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      stats: true,
    },
  });
}

/**
 * Check if an item can be equipped to a specific slot
 * Handles special cases like rings
 */
export function canEquipToSlot(item: ItemWithStats, slotType: string): boolean {
  if (!item.equipTo) return false;

  if (slotType === "ring1" || slotType === "ring2") {
    return item.equipTo === "ring";
  }

  return item.equipTo === slotType;
}

/**
 * Validate equipment data
 */
export function validateEquipment(
  equipment: Record<string, number | null>,
): boolean {
  const validSlots = [
    "head",
    "necklace",
    "chest",
    "shoulders",
    "arms",
    "gloves",
    "legs",
    "boots",
    "belt",
    "ring1",
    "ring2",
    "amulet",
    "backpack",
    "weapon",
  ];

  return Object.keys(equipment).every((key) => validSlots.includes(key));
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
