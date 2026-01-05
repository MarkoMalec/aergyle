import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType, VocationalActionType } from "~/generated/prisma/enums";
import { normalizeInventorySlots, slotsToInputJson } from "~/utils/inventorySlots";

const VOCATIONAL_ACTION_STAT_MAP: Record<VocationalActionType, StatType | null> = {
  [VocationalActionType.WOODCUTTING]: StatType.WOODCUTTING_EFFICIENCY,
  [VocationalActionType.MINING]: StatType.MINING_EFFICIENCY,
  [VocationalActionType.FISHING]: StatType.FISHING_EFFICIENCY,
  [VocationalActionType.GATHERING]: null,
  [VocationalActionType.ALCHEMY]: null,
  [VocationalActionType.SMELTING]: null,
  [VocationalActionType.COOKING]: null,
  [VocationalActionType.FORGE]: null,
};

type ToolEfficiencyTemplate = {
  actionType: VocationalActionType;
  baseEfficiency: number;
};

function scaleStatBaseValue(
  baseValue: number,
  multiplier: number,
  flipNegativeStatsWithRarity: boolean,
  maxValueCap: number | null | undefined,
): number {
  let scaled: number;
  if (!flipNegativeStatsWithRarity) {
    scaled = baseValue * multiplier;
  } else if (baseValue >= 0) {
    scaled = baseValue * multiplier;
  } else {
    // Negative base values become less negative (and potentially positive) with higher multipliers.
    // Example base=-5, multiplier=2.3 => -5 + (1.3*5) = +1.5
    scaled = baseValue + (multiplier - 1) * Math.abs(baseValue);
  }

  if (typeof maxValueCap === "number" && Number.isFinite(maxValueCap)) {
    return Math.min(scaled, maxValueCap);
  }

  return scaled;
}

async function applyToolEfficienciesToUserItem(
  userItemId: number,
  toolEfficiencies: ToolEfficiencyTemplate[] | undefined,
  multiplier: number,
  overridesByStatType: Map<StatType, number> | null,
  maxCapsByStatType: Map<StatType, number> | null,
  flipNegativeStatsWithRarity: boolean,
): Promise<Array<{ statType: StatType; value: number }>> {
  if (!toolEfficiencies?.length) {
    return [];
  }

  const appliedStats: Array<{ statType: StatType; value: number }> = [];

  for (const efficiency of toolEfficiencies) {
    const statType = VOCATIONAL_ACTION_STAT_MAP[efficiency.actionType];
    if (!statType) {
      continue;
    }

    const overrideValue = overridesByStatType?.get(statType);
    const baseValue = typeof overrideValue === "number" && Number.isFinite(overrideValue)
      ? overrideValue
      : efficiency.baseEfficiency;

    const value = typeof overrideValue === "number" && Number.isFinite(overrideValue)
      ? scaleStatBaseValue(
          baseValue,
          1,
          flipNegativeStatsWithRarity,
          maxCapsByStatType?.get(statType) ?? null,
        )
      : scaleStatBaseValue(
          baseValue,
          multiplier,
          flipNegativeStatsWithRarity,
          maxCapsByStatType?.get(statType) ?? null,
        );

    await prisma.userItemStat.upsert({
      where: {
        userItemId_statType: {
          userItemId,
          statType,
        },
      },
      update: { value },
      create: {
        userItemId,
        statType,
        value,
      },
    });

    appliedStats.push({ statType, value });
  }

  return appliedStats;
}

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
      statRarityOverrides: true,
      toolEfficiencies: true,
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

  const flipNegativeStatsWithRarity = Boolean(itemTemplate.flipNegativeStatsWithRarity);

  const overridesByStatType = new Map<StatType, number>();
  for (const o of itemTemplate.statRarityOverrides) {
    if (o.rarity === rarity && Number.isFinite(o.value)) {
      overridesByStatType.set(o.statType, o.value);
    }
  }

  // Combine base stats (ItemStat) with progressive stats (ItemStatProgression) into base-values at COMMON.
  const statSums = new Map<StatType, number>();
  const maxCaps = new Map<StatType, number>();
  for (const stat of itemTemplate.stats) {
    statSums.set(stat.statType, stat.value);
    const cap = stat.maxValue;
    if (typeof cap === "number" && Number.isFinite(cap)) {
      maxCaps.set(stat.statType, cap);
    }
  }

  if (itemTemplate.statProgressions.length > 0) {
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
    const availableProgressions = itemTemplate.statProgressions.filter((p) =>
      rarityOrder.indexOf(p.unlocksAtRarity) <= currentRarityIndex,
    );

    for (const prog of availableProgressions) {
      const current = statSums.get(prog.statType) || 0;
      statSums.set(prog.statType, current + prog.baseValue);
    }
  }

  const baseStatsToCreate = Array.from(statSums.entries()).map(
    ([statType, baseValue]) => ({
      userItemId: userItem.id,
      statType,
      value: (() => {
        const override = overridesByStatType.get(statType);
        if (typeof override === "number" && Number.isFinite(override)) {
          // Override is an absolute value at this rarity.
          return scaleStatBaseValue(
            override,
            1,
            flipNegativeStatsWithRarity,
            maxCaps.get(statType) ?? null,
          );
        }
        return scaleStatBaseValue(
          baseValue,
          multiplier,
          flipNegativeStatsWithRarity,
          maxCaps.get(statType) ?? null,
        );
      })(),
    }),
  );

  if (baseStatsToCreate.length > 0) {
    await prisma.userItemStat.createMany({
      data: baseStatsToCreate,
    });
  }

  await applyToolEfficienciesToUserItem(
    userItem.id,
    itemTemplate.toolEfficiencies,
    multiplier,
    overridesByStatType,
    maxCaps,
    flipNegativeStatsWithRarity,
  );

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
          statRarityOverrides: true,
          toolEfficiencies: true,
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

  const flipNegativeStatsWithRarity = Boolean(userItem.itemTemplate.flipNegativeStatsWithRarity);

  const overridesByStatType = new Map<StatType, number>();
  for (const o of userItem.itemTemplate.statRarityOverrides) {
    if (o.rarity === nextRarity && Number.isFinite(o.value)) {
      overridesByStatType.set(o.statType, o.value);
    }
  }

  const maxCaps = new Map<StatType, number>();
  for (const stat of userItem.itemTemplate.stats) {
    const cap = stat.maxValue;
    if (typeof cap === "number" && Number.isFinite(cap)) {
      maxCaps.set(stat.statType, cap);
    }
  }

  const statSums = new Map<StatType, number>();
  for (const stat of userItem.itemTemplate.stats) {
    statSums.set(stat.statType, stat.value);
  }

  if (userItem.itemTemplate.statProgressions.length > 0) {
    const availableProgressions = userItem.itemTemplate.statProgressions.filter((p) =>
      rarityOrder.indexOf(p.unlocksAtRarity) <= nextRarityIndex,
    );

    for (const prog of availableProgressions) {
      const current = statSums.get(prog.statType) || 0;
      statSums.set(prog.statType, current + prog.baseValue);
    }
  }

  const statsToCreate = Array.from(statSums.entries()).map(
    ([statType, baseValue]) => ({
      userItemId,
      statType,
      value: (() => {
        const override = overridesByStatType.get(statType);
        if (typeof override === "number" && Number.isFinite(override)) {
          return scaleStatBaseValue(
            override,
            1,
            flipNegativeStatsWithRarity,
            maxCaps.get(statType) ?? null,
          );
        }
        return scaleStatBaseValue(
          baseValue,
          nextMultiplier,
          flipNegativeStatsWithRarity,
          maxCaps.get(statType) ?? null,
        );
      })(),
    }),
  );

  if (statsToCreate.length > 0) {
    await prisma.userItemStat.createMany({ data: statsToCreate });
    newStats.push(
      ...statsToCreate.map((s) => ({ statType: s.statType, value: s.value })),
    );
  }

  const toolEfficiencyStats = await applyToolEfficienciesToUserItem(
    userItemId,
    userItem.itemTemplate.toolEfficiencies,
    nextMultiplier,
    overridesByStatType,
    maxCaps,
    flipNegativeStatsWithRarity,
  );

  newStats.push(...toolEfficiencyStats);

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
 * Add item to player's inventory with stacking support
 * For stackable items: finds existing stacks and adds to them, creates new stacks if needed
 * For non-stackable items: creates separate UserItem for each instance
 */
export async function addUserItemToInventory(
  userId: string,
  itemId: number,
  rarity: ItemRarity = ItemRarity.COMMON,
  quantity: number = 1
): Promise<{ success: boolean; message: string; userItemIds: number[] }> {
  if (quantity <= 0) {
    return { success: false, message: "Invalid quantity", userItemIds: [] };
  }

  // Get item template to check if stackable
  const itemTemplate = await prisma.item.findUnique({
    where: { id: itemId },
  });

  if (!itemTemplate) {
    return { success: false, message: "Item template not found", userItemIds: [] };
  }

  // Get user's inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, message: "Inventory not found", userItemIds: [] };
  }

  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
  const affectedUserItemIds: number[] = [];
  let remainingQuantity = quantity;

  // Handle stackable items
  if (itemTemplate.stackable) {
    // Step 1: Find existing stacks with same itemId + rarity
    for (let i = 0; i < slots.length && remainingQuantity > 0; i++) {
      const slot = slots[i];
      if (slot && slot.item) {
        const userItem = await prisma.userItem.findUnique({
          where: { id: slot.item.id },
        });

        if (!userItem) continue;

        // Check if it's the same item, same rarity, and has space
        if (
          userItem.itemId === itemId &&
          userItem.rarity === rarity &&
          userItem.status === "IN_INVENTORY" &&
          userItem.quantity < itemTemplate.maxStackSize
        ) {
          const availableSpace = itemTemplate.maxStackSize - userItem.quantity;
          const amountToAdd = Math.min(availableSpace, remainingQuantity);

          // Update the existing stack
          await prisma.userItem.update({
            where: { id: userItem.id },
            data: { quantity: userItem.quantity + amountToAdd },
          });

          affectedUserItemIds.push(userItem.id);
          remainingQuantity -= amountToAdd;
        }
      }
    }

    // Step 2: Create new stacks for remaining quantity
    while (remainingQuantity > 0) {
      // Find empty slot
      let emptySlotIndex = -1;
      for (let i = 0; i < inventory.maxSlots; i++) {
        const slot = slots.find((s) => s.slotIndex === i);
        if (!slot || !slot.item) {
          emptySlotIndex = i;
          break;
        }
      }

      if (emptySlotIndex === -1) {
        return {
          success: false,
          message: `Inventory is full. Added ${quantity - remainingQuantity} items.`,
          userItemIds: affectedUserItemIds,
        };
      }

      const stackSize = Math.min(remainingQuantity, itemTemplate.maxStackSize);

      // Create new UserItem with quantity
      const newUserItem = await prisma.userItem.create({
        data: {
          userId,
          itemId,
          rarity,
          quantity: stackSize,
          status: "IN_INVENTORY",
          isTradeable: true,
        },
      });

      affectedUserItemIds.push(newUserItem.id);

      // Add to the empty slot
      const existingSlotIndex = slots.findIndex((s) => s.slotIndex === emptySlotIndex);
      if (existingSlotIndex >= 0) {
        slots[existingSlotIndex]!.item = { id: newUserItem.id };
      } else {
        slots.push({
          slotIndex: emptySlotIndex,
          item: { id: newUserItem.id },
        });
      }

      remainingQuantity -= stackSize;
    }

    // Update inventory
    await prisma.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(slots) },
    });

    return {
      success: true,
      message: `Added ${quantity} ${itemTemplate.name}(s) to inventory`,
      userItemIds: affectedUserItemIds,
    };
  } else {
    // Handle non-stackable items (equipment) - create separate UserItem for each
    for (let i = 0; i < quantity; i++) {
      // Find empty slot
      let emptySlotIndex = -1;
      for (let j = 0; j < inventory.maxSlots; j++) {
        const slot = slots.find((s) => s.slotIndex === j);
        if (!slot || !slot.item) {
          emptySlotIndex = j;
          break;
        }
      }

      if (emptySlotIndex === -1) {
        return {
          success: false,
          message: `Inventory is full. Added ${i} of ${quantity} items.`,
          userItemIds: affectedUserItemIds,
        };
      }

      // Create UserItem with stats using existing function
      const userItemId = await createUserItem(userId, itemId, rarity, "IN_INVENTORY");
      affectedUserItemIds.push(userItemId);

      // Add to the empty slot
      const existingSlotIndex = slots.findIndex((s) => s.slotIndex === emptySlotIndex);
      if (existingSlotIndex >= 0) {
        slots[existingSlotIndex]!.item = { id: userItemId };
      } else {
        slots.push({
          slotIndex: emptySlotIndex,
          item: { id: userItemId },
        });
      }
    }

    // Update inventory
    await prisma.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(slots) },
    });

    return {
      success: true,
      message: `Added ${quantity} ${itemTemplate.name}(s) to inventory`,
      userItemIds: affectedUserItemIds,
    };
  }
}

/**
 * Split a stack into two separate UserItems
 * Original stack keeps (quantity - splitQuantity), new stack gets splitQuantity
 */
export async function splitStack(
  userId: string,
  userItemId: number,
  splitQuantity: number
): Promise<{ success: boolean; message: string; newUserItemId?: number }> {
  if (splitQuantity <= 0) {
    return { success: false, message: "Invalid split quantity" };
  }

  // Get the UserItem to split
  const userItem = await prisma.userItem.findUnique({
    where: { id: userItemId },
    include: { itemTemplate: true },
  });

  if (!userItem) {
    return { success: false, message: "Item not found" };
  }

  if (userItem.userId !== userId) {
    return { success: false, message: "You don't own this item" };
  }

  if (!userItem.itemTemplate.stackable) {
    return { success: false, message: "This item cannot be stacked" };
  }

  if (userItem.quantity <= 1) {
    return { success: false, message: "Cannot split a stack of 1" };
  }

  if (splitQuantity >= userItem.quantity) {
    return { success: false, message: "Split quantity must be less than current quantity" };
  }

  // Get user's inventory
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory) {
    return { success: false, message: "Inventory not found" };
  }

  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);

  // Find an empty slot for the new stack
  let emptySlotIndex = -1;
  for (let i = 0; i < inventory.maxSlots; i++) {
    const slot = slots.find((s) => s.slotIndex === i);
    if (!slot || !slot.item) {
      emptySlotIndex = i;
      break;
    }
  }

  if (emptySlotIndex === -1) {
    return { success: false, message: "Inventory is full, cannot split stack" };
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Update original stack
    await tx.userItem.update({
      where: { id: userItemId },
      data: { quantity: userItem.quantity - splitQuantity },
    });

    // Create new stack
    const newItem = await tx.userItem.create({
      data: {
        userId,
        itemId: userItem.itemId,
        rarity: userItem.rarity,
        quantity: splitQuantity,
        status: "IN_INVENTORY",
        isTradeable: userItem.isTradeable,
      },
    });

    // Add new stack to empty slot
    const existingSlotIndex = slots.findIndex((s) => s.slotIndex === emptySlotIndex);
    if (existingSlotIndex >= 0) {
      slots[existingSlotIndex]!.item = { id: newItem.id };
    } else {
      slots.push({
        slotIndex: emptySlotIndex,
        item: { id: newItem.id },
      });
    }

    // Update inventory
    await tx.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(slots) },
    });

    return newItem;
  });

  return {
    success: true,
    message: `Split ${splitQuantity} from stack`,
    newUserItemId: result.id,
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
  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);

  // Find slot with this item
  const slotIndex = slots.findIndex((s) => s.item?.id === userItemId);

  if (slotIndex === -1) {
    return { success: false, message: "Item not in inventory" };
  }

  // Set item to null (empty slot)
  slots[slotIndex] = {
    slotIndex: slots[slotIndex]!.slotIndex,
    item: null,
  };

  // Update inventory
  await prisma.inventory.update({
    where: { userId },
    data: { slots: slotsToInputJson(slots) },
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
    const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
    const updatedSlots = slots.map((s) => {
      if (s.item?.id === userItemId) {
        return { slotIndex: s.slotIndex, item: null };
      }
      return s;
    });

    await prisma.inventory.update({
      where: { userId },
      data: { slots: slotsToInputJson(updatedSlots) },
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
  const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
  const userItemIds = slots
    .filter((s) => s.item?.id)
    .map((s) => s.item!.id);

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
  const slotsWithItems = slots.map((s) => ({
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
    equipment.greavesItemId,
    equipment.bootsItemId,
    equipment.necklaceItemId,
    equipment.ring1ItemId,
    equipment.ring2ItemId,
    equipment.amuletItemId,
    equipment.pauldronsItemId,
    equipment.bracersItemId,
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
    greaves: equipment.greavesItemId ? userItemMap.get(equipment.greavesItemId) : null,
    boots: equipment.bootsItemId ? userItemMap.get(equipment.bootsItemId) : null,
    necklace: equipment.necklaceItemId ? userItemMap.get(equipment.necklaceItemId) : null,
    ring1: equipment.ring1ItemId ? userItemMap.get(equipment.ring1ItemId) : null,
    ring2: equipment.ring2ItemId ? userItemMap.get(equipment.ring2ItemId) : null,
    amulet: equipment.amuletItemId ? userItemMap.get(equipment.amuletItemId) : null,
    pauldrons: equipment.pauldronsItemId ? userItemMap.get(equipment.pauldronsItemId) : null,
    bracers: equipment.bracersItemId ? userItemMap.get(equipment.bracersItemId) : null,
    gloves: equipment.glovesItemId ? userItemMap.get(equipment.glovesItemId) : null,
    backpack: equipment.backpackItemId ? userItemMap.get(equipment.backpackItemId) : null,
  };
}
