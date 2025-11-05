import { prisma } from "~/lib/prisma";
import { Item } from "@prisma/client";
import { EquipmentSlotsWithItems, ValidEquipSlot } from "~/types/inventory";

/**
 * Fetch multiple items by IDs
 */
export async function fetchItemsByIds(itemIds: number[]): Promise<Item[]> {
  if (itemIds.length === 0) return [];

  return await prisma.item.findMany({
    where: {
      id: { in: itemIds },
    },
    select: {
      id: true,
      name: true,
      sprite: true,
      stat1: true,
      stat2: true,
      price: true,
      equipTo: true,
    },
  });
}

/**
 * Fetch a single item by ID
 */
export async function fetchItemById(itemId: number): Promise<Item | null> {
  return await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      sprite: true,
      stat1: true,
      stat2: true,
      price: true,
      equipTo: true,
    },
  });
}

/**
 * Check if an item can be equipped to a specific slot
 * Handles special cases like rings
 */
export function canEquipToSlot(item: Item, slotType: string): boolean {
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

  const items = await fetchItemsByIds(itemIds);

  const itemMap = new Map(items.map((item) => [item.id, item]));

  const result: Record<string, Item | null> = {};
  for (const [slot, itemId] of Object.entries(equipmentIds)) {
    result[slot] = itemId ? itemMap.get(itemId) || null : null;
  }

  return result as EquipmentSlotsWithItems;
}
