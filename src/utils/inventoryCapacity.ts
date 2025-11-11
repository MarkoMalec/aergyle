import { prisma } from "~/lib/prisma";
import { StatType } from "@prisma/client";

/**
 * Calculate total inventory capacity for a user
 * Base capacity: 25 slots
 * Additional capacity: Sum of CARRYING_CAPACITY from ALL equipped items
 * (Mainly backpacks, but other items could have this stat too)
 */
export async function calculateInventoryCapacity(userId: string): Promise<number> {
  const BASE_CAPACITY = 25;

  // Get user's equipped items
  const equipment = await prisma.equipment.findUnique({
    where: { userId },
  });

  if (!equipment) {
    console.log(`[Capacity] No equipment found for user ${userId}, returning base: ${BASE_CAPACITY}`);
    return BASE_CAPACITY;
  }

  // Get all equipped UserItem IDs
  const equippedItemIds = [
    equipment.headItemId,
    equipment.chestItemId,
    equipment.beltItemId,
    equipment.legsItemId,
    equipment.bootsItemId,
    equipment.necklaceItemId,
    equipment.ring1ItemId,
    equipment.ring2ItemId,
    equipment.amuletItemId,
    equipment.shouldersItemId,
    equipment.armsItemId,
    equipment.glovesItemId,
    equipment.backpackItemId,
    equipment.weaponItemId,
  ].filter((id): id is number => id !== null);

  console.log(`[Capacity] User ${userId} has ${equippedItemIds.length} equipped items:`, {
    backpackItemId: equipment.backpackItemId,
    allEquippedIds: equippedItemIds,
  });

  if (equippedItemIds.length === 0) {
    console.log(`[Capacity] No items equipped, returning base: ${BASE_CAPACITY}`);
    return BASE_CAPACITY;
  }

  // Fetch equipped UserItems with CARRYING_CAPACITY stats
  const equippedItems = await prisma.userItem.findMany({
    where: {
      id: { in: equippedItemIds },
    },
    include: {
      stats: {
        where: {
          statType: StatType.CARRYING_CAPACITY,
        },
      },
    },
  });

  console.log(`[Capacity] Found ${equippedItems.length} equipped UserItems`);

  // Sum all CARRYING_CAPACITY bonuses from all equipped items
  let bonusCapacity = 0;
  for (const item of equippedItems) {
    for (const stat of item.stats) {
      if (stat.statType === StatType.CARRYING_CAPACITY) {
        console.log(`[Capacity] Item ${item.id} has CARRYING_CAPACITY: ${stat.value}`);
        bonusCapacity += stat.value;
      }
    }
  }

  const totalCapacity = BASE_CAPACITY + Math.floor(bonusCapacity);
  console.log(`[Capacity] Total capacity: ${totalCapacity} (base: ${BASE_CAPACITY} + bonus: ${Math.floor(bonusCapacity)})`);
  
  return totalCapacity;
}

/**
 * Update inventory maxSlots based on equipped items
 * Call this whenever equipment changes
 */
export async function updateInventoryCapacity(userId: string): Promise<number> {
  const newCapacity = await calculateInventoryCapacity(userId);

  console.log(`[UpdateCapacity] Updating inventory for user ${userId} to ${newCapacity} slots`);

  await prisma.inventory.update({
    where: { userId },
    data: { maxSlots: newCapacity },
  });

  console.log(`[UpdateCapacity] Database updated successfully`);

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

  const slots = (inventory?.slots as any[]) || [];
  const filledSlots = slots.filter((slot) => slot?.item?.id).length;

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
  requiredSlots: number = 1
): Promise<boolean> {
  const capacity = await getInventoryCapacity(userId);
  const availableSlots = capacity.max - capacity.current;
  return availableSlots >= requiredSlots;
}
