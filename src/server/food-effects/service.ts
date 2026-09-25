import { ItemType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import {
  resolveRegeneratedHealth,
  writeCharacterHealth,
} from "~/server/combat";
import { removeFromStack } from "~/server/items/consumeItems";
import { getCharacterStatSnapshot } from "~/server/stats";
import { normalizeInventorySlots } from "~/utils/inventorySlots";

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
              healingAmount: true,
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
    if (!slots.some((slot) => slot.item?.id === userItem.id)) {
      throw new Error("Consumable was not found in your inventory");
    }

    if (
      !userItem.itemTemplate.itemType ||
      !TIMED_EFFECT_ITEM_TYPES.has(userItem.itemTemplate.itemType)
    ) {
      throw new Error("This item cannot be consumed");
    }

    // A consumable may heal instantly, start a timed effect, or both.
    const healingAmount = Math.floor(userItem.itemTemplate.healingAmount ?? 0);
    const duration = Math.floor(userItem.itemTemplate.foodEffectSeconds ?? 0);
    const hasTimedEffect =
      duration > 0 && userItem.itemTemplate.foodEffectStats.length > 0;
    if (healingAmount <= 0 && !hasTimedEffect) {
      throw new Error("This consumable has no effect configured");
    }

    const now = new Date();
    let healing: {
      healed: number;
      currentHealth: number;
      maxHealth: number;
    } | null = null;
    if (healingAmount > 0) {
      const [character, storedHealth] = await Promise.all([
        getCharacterStatSnapshot(userId),
        tx.characterHealth.findUnique({ where: { userId } }),
      ]);
      const maxHealth = character.finalStats.health;
      const currentHealth = storedHealth
        ? resolveRegeneratedHealth({
            currentHealth: storedHealth.currentHealth,
            maxHealth,
            healthRegen: character.finalStats.healthRegen,
            regeneratedAt: storedHealth.regeneratedAt,
            now,
          })
        : maxHealth;
      const nextHealth = Math.min(maxHealth, currentHealth + healingAmount);

      await writeCharacterHealth({
        db: tx,
        userId,
        currentHealth: nextHealth,
        at: now,
      });
      healing = {
        healed: nextHealth - currentHealth,
        currentHealth: nextHealth,
        maxHealth,
      };
    }

    let timed: {
      startedAt: Date;
      endsAt: Date;
      stats: typeof userItem.itemTemplate.foodEffectStats;
    } | null = null;
    if (hasTimedEffect) {
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
      timed = {
        startedAt: now,
        endsAt,
        stats: userItem.itemTemplate.foodEffectStats,
      };
    }

    await removeFromStack({
      db: tx,
      userId,
      userItemId: userItem.id,
      quantity: 1,
    });

    return {
      itemId: userItem.itemId,
      itemName: userItem.itemTemplate.name,
      healing,
      timed,
    };
  });
}
