import { ItemRarity } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { createUserItem } from "~/utils/userItems";
import {
  normalizeInventorySlots,
  slotsToInputJson,
  type InventorySlot,
} from "~/utils/inventorySlots";

const BASE_INVENTORY_CAPACITY = 25;

async function getStarterItemTemplateIds() {
  const [woodenSwordTemplate, goldRingTemplate, goldGlovesTemplate] =
    await Promise.all([
      prisma.item.findFirst({ where: { name: "Wooden Sword" }, select: { id: true } }),
      prisma.item.findFirst({ where: { name: "Gold Ring" }, select: { id: true } }),
      prisma.item.findFirst({ where: { name: "Gold Gloves" }, select: { id: true } }),
    ]);

  if (!woodenSwordTemplate || !goldRingTemplate || !goldGlovesTemplate) {
    return null;
  }

  return {
    woodenSwordId: woodenSwordTemplate.id,
    goldRingId: goldRingTemplate.id,
    goldGlovesId: goldGlovesTemplate.id,
  };
}

function buildEmptySlots(capacity: number): InventorySlot[] {
  return Array.from({ length: capacity }, (_, index) => ({
    slotIndex: index,
    item: null,
  }));
}

function applyItemsToFirstSlots(
  slots: InventorySlot[],
  userItemIds: number[],
): InventorySlot[] {
  const updated = slots.map((slot, index): InventorySlot => {
    const itemId = userItemIds[index];
    if (itemId === undefined) return slot;

    return {
      slotIndex: index,
      item: { id: itemId },
    };
  });

  return updated;
}

/**
 * Ensures a newly created user has core game state (inventory, equipment, starter items, gold).
 *
 * Designed to be safe if called multiple times; starter items are only created if we successfully
 * created the inventory record first.
 */
export async function provisionNewUser(userId: string) {
  // Always ensure equipment exists.
  await prisma.equipment.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  // Create inventory first (unique userId prevents duplicates).
  let inventoryCreated = false;
  try {
    await prisma.inventory.create({
      data: {
        userId,
        slots: slotsToInputJson(buildEmptySlots(BASE_INVENTORY_CAPACITY)),
        maxSlots: BASE_INVENTORY_CAPACITY,
        deleteSlotId: null,
      },
      select: { id: true },
    });
    inventoryCreated = true;
  } catch (error) {
    // Unique constraint: inventory already exists (or another provisioning is racing).
    // In both cases, we avoid creating starter items twice.
    const prismaError = error as { code?: string };
    if (prismaError?.code !== "P2002") {
      throw error;
    }
  }

  if (!inventoryCreated) return;

  // Starting gold
  await prisma.user.update({
    where: { id: userId },
    data: { gold: 100 },
    select: { id: true },
  });

  const starterTemplates = await getStarterItemTemplateIds();
  if (!starterTemplates) {
    // Inventory exists, but templates are missing; keep the account usable.
    return;
  }

  const starterUserItemIds = await Promise.all([
    createUserItem(userId, starterTemplates.woodenSwordId, ItemRarity.COMMON, "IN_INVENTORY"),
    createUserItem(userId, starterTemplates.goldRingId, ItemRarity.BROKEN, "IN_INVENTORY"),
    createUserItem(userId, starterTemplates.goldGlovesId, ItemRarity.COMMON, "IN_INVENTORY"),
  ]);

  // Put starter items into first slots.
  const currentInventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { maxSlots: true, slots: true },
  });

  if (!currentInventory) return;

  const baseSlots = normalizeInventorySlots(
    currentInventory.slots,
    currentInventory.maxSlots,
  );

  const updatedSlots = applyItemsToFirstSlots(baseSlots, starterUserItemIds);

  await prisma.inventory.update({
    where: { userId },
    data: { slots: slotsToInputJson(updatedSlots) },
    select: { id: true },
  });
}
