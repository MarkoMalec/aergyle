import { ItemType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "~/utils/inventorySlots";

const TIMED_EFFECT_ITEM_TYPES = new Set<ItemType>([
  ItemType.FOOD,
  ItemType.POTION,
  ItemType.ELIXIR,
]);

export async function getActiveFoodEffect(userId: string) {
  return prisma.userActiveFoodEffect.findFirst({
    where: { userId, endsAt: { gt: new Date() } },
    select: {
      id: true,
      startedAt: true,
      endsAt: true,
      item: {
        select: {
          id: true,
          name: true,
          sprite: true,
          rarity: true,
          foodEffectStats: {
            select: { statType: true, value: true },
            orderBy: [{ statType: "asc" }],
          },
        },
      },
    },
  });
}

export async function consumeFoodFromInventory(params: {
  userId: string;
  userItemId: number;
}) {
  const { userId, userItemId } = params;

  return prisma.$transaction(async (tx) => {
    const [userItem, inventory] = await Promise.all([
      tx.userItem.findFirst({
        where: { id: userItemId, userId, status: "IN_INVENTORY" },
        select: {
          id: true,
          quantity: true,
          itemId: true,
          itemTemplate: {
            select: {
              name: true,
              itemType: true,
              foodEffectSeconds: true,
              foodEffectStats: {
                select: { statType: true, value: true },
              },
            },
          },
        },
      }),
      tx.inventory.findUnique({
        where: { userId },
        select: { maxSlots: true, slots: true },
      }),
    ]);

    if (!userItem || !inventory) {
      throw new Error("Consumable was not found in your inventory");
    }

    const slots = normalizeInventorySlots(inventory.slots, inventory.maxSlots);
    const slotIndex = slots.findIndex((slot) => slot.item?.id === userItem.id);
    if (slotIndex < 0) {
      throw new Error("Consumable was not found in your inventory");
    }

    if (
      !userItem.itemTemplate.itemType ||
      !TIMED_EFFECT_ITEM_TYPES.has(userItem.itemTemplate.itemType)
    ) {
      throw new Error("This item cannot apply a timed effect");
    }

    const duration = Math.floor(userItem.itemTemplate.foodEffectSeconds ?? 0);
    if (duration <= 0 || userItem.itemTemplate.foodEffectStats.length === 0) {
      throw new Error("This consumable has no timed effect configured");
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + duration * 1000);
    await tx.userActiveFoodEffect.upsert({
      where: { userId },
      create: {
        userId,
        itemId: userItem.itemId,
        startedAt: now,
        endsAt,
      },
      update: {
        itemId: userItem.itemId,
        startedAt: now,
        endsAt,
      },
    });

    if (userItem.quantity > 1) {
      await tx.userItem.update({
        where: { id: userItem.id },
        data: { quantity: { decrement: 1 } },
      });
    } else {
      await tx.userItem.delete({ where: { id: userItem.id } });
      const slot = slots[slotIndex];
      if (slot) slots[slotIndex] = { ...slot, item: null };
      await tx.inventory.update({
        where: { userId },
        data: { slots: slotsToInputJson(slots) },
      });
    }

    return {
      itemId: userItem.itemId,
      itemName: userItem.itemTemplate.name,
      startedAt: now,
      endsAt,
      stats: userItem.itemTemplate.foodEffectStats,
    };
  });
}
