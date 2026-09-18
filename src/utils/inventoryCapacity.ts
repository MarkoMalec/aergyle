import { prisma } from "~/lib/prisma";
import { getCharacterStatSnapshot } from "~/server/stats";
import { normalizeInventorySlots } from "~/utils/inventorySlots";

/**
 * Calculate total inventory capacity for a user
 * Base capacity: 25 slots
 * Additional capacity: the character's canonical CARRYING_CAPACITY stat.
 */
export async function calculateInventoryCapacity(
  userId: string,
): Promise<number> {
  const BASE_CAPACITY = 25;
  const character = await getCharacterStatSnapshot(userId);
  return BASE_CAPACITY + Math.floor(character.finalStats.carryingCapacity);
}

/**
 * Update inventory maxSlots based on equipped items
 * Call this whenever equipment changes
 */
export async function updateInventoryCapacity(userId: string): Promise<number> {
  const newCapacity = await calculateInventoryCapacity(userId);

  await prisma.inventory.update({
    where: { userId },
    data: { maxSlots: newCapacity },
  });

  return newCapacity;
}

/**
 * Get current inventory capacity without updating database
 */
export async function getInventoryCapacity(userId: string): Promise<{
  current: number;
  max: number;
  base: number;
  bonus: number;
}> {
  const maxSlots = await calculateInventoryCapacity(userId);
  const BASE_CAPACITY = 25;
  const bonus = maxSlots - BASE_CAPACITY;

  // Count filled slots
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { slots: true },
  });

  const slots = normalizeInventorySlots(inventory?.slots, null);
  const filledSlots = slots.filter((slot) => slot.item?.id).length;

  return {
    current: filledSlots,
    max: maxSlots,
    base: BASE_CAPACITY,
    bonus: bonus,
  };
}

/**
 * Check if inventory has space for new items
 */
export async function hasInventorySpace(
  userId: string,
  requiredSlots: number = 1,
): Promise<boolean> {
  const capacity = await getInventoryCapacity(userId);
  const availableSlots = capacity.max - capacity.current;
  return availableSlots >= requiredSlots;
}
