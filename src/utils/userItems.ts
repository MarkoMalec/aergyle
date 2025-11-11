import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType } from "@prisma/client";

/**
 * Create a UserItem instance from an Item template
 * Uses ItemStatProgression to determine which stats are available at this rarity
 */
export async function createUserItem(
  userId: string,
  itemId: number,
  rarity: ItemRarity = ItemRarity.COMMON,
  status: "IN_INVENTORY" | "EQUIPPED" = "IN_INVENTORY"
): Promise<number> {
  // Get item template with stat progressions
  const itemTemplate = await prisma.item.findUnique({
    where: { id: itemId },
    include: { 
      stats: true,
      statProgressions: true,
    },
  });

  if (!itemTemplate) {
    throw new Error(`Item template ${itemId} not found`);
  }

  // Create UserItem instance
  const userItem = await prisma.userItem.create({
    data: {
      userId,
      itemId,
      rarity,
      status,
      isTradeable: true,
    },
  });

  // Get rarity multiplier
  const rarityConfig = await prisma.rarityConfig.findUnique({
    where: { rarity },
  });

  const multiplier = rarityConfig?.statMultiplier ?? 1.0;

  // Combine base stats (ItemStat) with progressive stats (ItemStatProgression)
  
  // 1. Always add base stats from ItemStat (these are default stats every item has)
  for (const stat of itemTemplate.stats) {
    await prisma.userItemStat.create({
      data: {
        userItemId: userItem.id,
        statType: stat.statType,
        value: stat.value * multiplier,
      },
    });
  }

  // 2. Add progressive stats that unlock at this rarity level
  if (itemTemplate.statProgressions.length > 0) {
    // Get rarity order for comparison
    const rarityOrder = [
      ItemRarity.WORTHLESS,
      ItemRarity.BROKEN,
      ItemRarity.COMMON,
      ItemRarity.UNCOMMON,
      ItemRarity.RARE,
      ItemRarity.EXQUISITE,
      ItemRarity.EPIC,
      ItemRarity.ELITE,
      ItemRarity.UNIQUE,
      ItemRarity.LEGENDARY,
      ItemRarity.MYTHIC,
      ItemRarity.DIVINE,
    ];
    
    const currentRarityIndex = rarityOrder.indexOf(rarity);
    
    // Get all progressions that unlock at or before this rarity
    const availableProgressions = itemTemplate.statProgressions.filter(prog => {
      const unlockIndex = rarityOrder.indexOf(prog.unlocksAtRarity);
      return unlockIndex <= currentRarityIndex;
    });
    
    // Group progressions by statType to sum values
    const statSums = new Map<StatType, number>();
    for (const progression of availableProgressions) {
      const current = statSums.get(progression.statType) || 0;
      statSums.set(progression.statType, current + progression.baseValue);
    }
    
    // Create stats from progressions (or update if base stat already exists)
    for (const [statType, totalValue] of statSums) {
      // Check if this stat already exists from base stats
      const existingStat = await prisma.userItemStat.findFirst({
        where: {
          userItemId: userItem.id,
          statType: statType,
        },
      });
      
      if (existingStat) {
        // Add to existing base stat value
        await prisma.userItemStat.update({
          where: { id: existingStat.id },
          data: {
            value: existingStat.value + (totalValue * multiplier),
          },
        });
      } else {
        // Create new stat from progression
        await prisma.userItemStat.create({
          data: {
            userItemId: userItem.id,
            statType: statType,
            value: totalValue * multiplier,
          },
        });
      }
    }
  }

  return userItem.id;
}

/**
 * Get UserItem with all its data
 */
export async function getUserItem(userItemId: number) {
  return await prisma.userItem.findUnique({
    where: { id: userItemId },
    include: {
      itemTemplate: true,
      stats: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Get all UserItems for a user
 */
export async function getUserItems(userId: string) {
  return await prisma.userItem.findMany({
    where: { userId },
    include: {
      itemTemplate: true,
      stats: true,
    },
    orderBy: {
      acquiredAt: "desc",
    },
  });
}

/**
 * Upgrade UserItem rarity
 * Handles stat progressions - new stats may unlock at higher rarities
 */
export async function upgradeUserItemRarity(
  userItemId: number,
  userId: string
): Promise<{
  success: boolean;
  message: string;
  newRarity?: ItemRarity;
  newStats?: Array<{ statType: StatType; value: number }>;
}> {
  // Get current UserItem with template and progressions
  const userItem = await prisma.userItem.findUnique({
    where: { id: userItemId },
    include: { 
      stats: true,
      itemTemplate: {
        include: {
          stats: true, // Base stats from ItemStat
          statProgressions: true, // Progressive stats
        },
      },
    },
  });

  if (!userItem) {
    return { success: false, message: "Item not found" };
  }

  if (userItem.userId !== userId) {
    return { success: false, message: "You don't own this item" };
  }

  // Get current rarity config
  const currentConfig = await prisma.rarityConfig.findUnique({
    where: { rarity: userItem.rarity },
  });

  if (!currentConfig || !currentConfig.upgradeEnabled || !currentConfig.nextRarity) {
    return { success: false, message: "This item cannot be upgraded further" };
  }

  // Get next rarity config
  const nextConfig = await prisma.rarityConfig.findUnique({
    where: { rarity: currentConfig.nextRarity },
  });

  if (!nextConfig) {
    return { success: false, message: "Next rarity configuration not found" };
  }

  const currentMultiplier = currentConfig.statMultiplier;
  const nextMultiplier = nextConfig.statMultiplier;
  const nextRarity = nextConfig.rarity;

  const rarityOrder = [
    ItemRarity.WORTHLESS,
    ItemRarity.BROKEN,
    ItemRarity.COMMON,
    ItemRarity.UNCOMMON,
    ItemRarity.RARE,
    ItemRarity.EXQUISITE,
    ItemRarity.EPIC,
    ItemRarity.ELITE,
    ItemRarity.UNIQUE,
    ItemRarity.LEGENDARY,
    ItemRarity.MYTHIC,
    ItemRarity.DIVINE,
  ];
  
  const nextRarityIndex = rarityOrder.indexOf(nextRarity);

  // Delete all current stats (we'll rebuild them)
  await prisma.userItemStat.deleteMany({
    where: { userItemId },
  });

  const newStats: Array<{ statType: StatType; value: number }> = [];

  // 1. Add base stats from ItemStat (these scale with multiplier)
  for (const stat of userItem.itemTemplate.stats) {
    const value = stat.value * nextMultiplier;
    
    await prisma.userItemStat.create({
      data: {
        userItemId,
        statType: stat.statType,
        value,
      },
    });
    
    newStats.push({ statType: stat.statType, value });
  }

  // 2. Add progressive stats that unlock at this rarity level
  if (userItem.itemTemplate.statProgressions.length > 0) {
    // Get all progressions that unlock at or before next rarity
    const availableProgressions = userItem.itemTemplate.statProgressions.filter(prog => {
      const unlockIndex = rarityOrder.indexOf(prog.unlocksAtRarity);
      return unlockIndex <= nextRarityIndex;
    });
    
    // Group progressions by statType to sum values
    const statSums = new Map<StatType, number>();
    for (const progression of availableProgressions) {
      const current = statSums.get(progression.statType) || 0;
      statSums.set(progression.statType, current + progression.baseValue);
    }
    
    // Create or update stats from progressions
    for (const [statType, totalValue] of statSums) {
      const value = totalValue * nextMultiplier;
      
      // Check if this stat already exists from base stats
      const existingStatIndex = newStats.findIndex(s => s.statType === statType);
      
      if (existingStatIndex >= 0) {
        // Update existing base stat in DB and newStats array
        const existingStat = await prisma.userItemStat.findFirst({
          where: {
            userItemId,
            statType: statType,
          },
        });
        
        if (existingStat) {
          await prisma.userItemStat.update({
            where: { id: existingStat.id },
            data: {
              value: existingStat.value + value,
            },
          });
          newStats[existingStatIndex]!.value += value;
        }
      } else {
        // Create new stat from progression
        await prisma.userItemStat.create({
          data: {
            userItemId,
            statType: statType,
            value,
          },
        });
        
        newStats.push({ statType: statType, value });
      }
    }
  }

  // Update UserItem rarity
  await prisma.userItem.update({
    where: { id: userItemId },
    data: { rarity: nextRarity },
  });

  return {
    success: true,
    message: `Upgraded to ${nextConfig.displayName}`,
    newRarity: nextRarity,
    newStats,
  };
}

/**
 * Add UserItem to player's inventory
 */
export async function addUserItemToInventory(
  userId: string,
  userItemId: number
): Promise<{ success: boolean; message: string; slotIndex?: number }> {
  // Get user's inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, message: "Inventory not found" };
  }

  // Parse slots from JSON
  const slots = (inventory.slots as any[]) || [];

  // Find first empty slot
  let emptySlotIndex = -1;
  for (let i = 0; i < inventory.maxSlots; i++) {
    const slot = slots.find((s: any) => s.slotIndex === i);
    if (!slot || !slot.item) {
      emptySlotIndex = i;
      break;
    }
  }

  if (emptySlotIndex === -1) {
    return { success: false, message: "Inventory is full" };
  }

  // Check if slot exists in array
  const existingSlotIndex = slots.findIndex((s: any) => s.slotIndex === emptySlotIndex);

  if (existingSlotIndex >= 0) {
    // Update existing slot
    slots[existingSlotIndex] = {
      slotIndex: emptySlotIndex,
      item: { id: userItemId },
    };
  } else {
    // Add new slot
    slots.push({
      slotIndex: emptySlotIndex,
      item: { id: userItemId },
    });
  }

  // Update inventory with modified slots
  await prisma.inventory.update({
    where: { userId },
    data: { slots },
  });

  return {
    success: true,
    message: "Item added to inventory",
    slotIndex: emptySlotIndex,
  };
}

/**
 * Remove UserItem from inventory (but don't delete it)
 */
export async function removeUserItemFromInventory(
  userId: string,
  userItemId: number
): Promise<{ success: boolean; message: string }> {
  // Get user's inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, message: "Inventory not found" };
  }

  // Parse slots from JSON
  const slots = (inventory.slots as any[]) || [];

  // Find slot with this item
  const slotIndex = slots.findIndex((s: any) => s.item?.id === userItemId);

  if (slotIndex === -1) {
    return { success: false, message: "Item not in inventory" };
  }

  // Set item to null (empty slot)
  slots[slotIndex] = {
    slotIndex: slots[slotIndex].slotIndex,
    item: null,
  };

  // Update inventory
  await prisma.inventory.update({
    where: { userId },
    data: { slots },
  });

  return { success: true, message: "Item removed from inventory" };
}

/**
 * Delete UserItem permanently
 */
export async function deleteUserItem(userItemId: number, userId: string): Promise<boolean> {
  const userItem = await prisma.userItem.findUnique({
    where: { id: userItemId },
  });

  if (!userItem || userItem.userId !== userId) {
    return false;
  }

  // Remove from inventory slots (update JSON)
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (inventory) {
    const slots = (inventory.slots as any[]) || [];
    const updatedSlots = slots.map((s: any) => {
      if (s.item?.id === userItemId) {
        return { slotIndex: s.slotIndex, item: null };
      }
      return s;
    });

    await prisma.inventory.update({
      where: { userId },
      data: { slots: updatedSlots },
    });
  }

  // Delete UserItem (cascade will delete stats)
  await prisma.userItem.delete({
    where: { id: userItemId },
  });

  return true;
}

/**
 * Transfer UserItem to another player
 */
export async function transferUserItem(
  userItemId: number,
  fromUserId: string,
  toUserId: string
): Promise<{ success: boolean; message: string }> {
  const userItem = await prisma.userItem.findUnique({
    where: { id: userItemId },
  });

  if (!userItem) {
    return { success: false, message: "Item not found" };
  }

  if (userItem.userId !== fromUserId) {
    return { success: false, message: "You don't own this item" };
  }

  if (!userItem.isTradeable) {
    return { success: false, message: "This item cannot be traded" };
  }

  // Remove from sender's inventory
  await removeUserItemFromInventory(fromUserId, userItemId);

  // Transfer ownership
  await prisma.userItem.update({
    where: { id: userItemId },
    data: {
      userId: toUserId,
      status: "IN_INVENTORY", // Reset to inventory when transferring
    },
  });

  return { success: true, message: "Item transferred successfully" };
}

/**
 * Get player's inventory with UserItems
 */
export async function getPlayerInventory(userId: string) {
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return null;
  }

  // Parse slots and fetch UserItems
  const slots = (inventory.slots as any[]) || [];
  const userItemIds = slots
    .filter((s: any) => s.item?.id)
    .map((s: any) => s.item.id);

  const userItems = await prisma.userItem.findMany({
    where: {
      id: { in: userItemIds },
    },
    include: {
      stats: true,
      itemTemplate: true,
    },
  });

  // Map user items by ID for easy lookup
  const userItemMap = new Map(userItems.map(item => [item.id, item]));

  // Attach userItems to slots
  const slotsWithItems = slots.map((s: any) => ({
    slotIndex: s.slotIndex,
    userItem: s.item?.id ? userItemMap.get(s.item.id) || null : null,
  }));

  return {
    ...inventory,
    slotsWithItems,
  };
}

/**
 * Get player's equipped items
 */
export async function getPlayerEquipment(userId: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { userId },
  });

  if (!equipment) {
    return null;
  }

  // Get all equipped UserItems
  const equippedItemIds = [
    equipment.weaponItemId,
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
  ].filter((id): id is number => id !== null);

  const userItems = await prisma.userItem.findMany({
    where: {
      id: { in: equippedItemIds },
    },
    include: {
      itemTemplate: true,
      stats: true,
    },
  });

  const userItemMap = new Map(userItems.map((item) => [item.id, item]));

  return {
    weapon: equipment.weaponItemId ? userItemMap.get(equipment.weaponItemId) : null,
    head: equipment.headItemId ? userItemMap.get(equipment.headItemId) : null,
    chest: equipment.chestItemId ? userItemMap.get(equipment.chestItemId) : null,
    belt: equipment.beltItemId ? userItemMap.get(equipment.beltItemId) : null,
    legs: equipment.legsItemId ? userItemMap.get(equipment.legsItemId) : null,
    boots: equipment.bootsItemId ? userItemMap.get(equipment.bootsItemId) : null,
    necklace: equipment.necklaceItemId ? userItemMap.get(equipment.necklaceItemId) : null,
    ring1: equipment.ring1ItemId ? userItemMap.get(equipment.ring1ItemId) : null,
    ring2: equipment.ring2ItemId ? userItemMap.get(equipment.ring2ItemId) : null,
    amulet: equipment.amuletItemId ? userItemMap.get(equipment.amuletItemId) : null,
    shoulders: equipment.shouldersItemId ? userItemMap.get(equipment.shouldersItemId) : null,
    arms: equipment.armsItemId ? userItemMap.get(equipment.armsItemId) : null,
    gloves: equipment.glovesItemId ? userItemMap.get(equipment.glovesItemId) : null,
    backpack: equipment.backpackItemId ? userItemMap.get(equipment.backpackItemId) : null,
  };
}
