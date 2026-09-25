import { prisma } from "~/lib/prisma";
import {
  hydrateEffectiveItemStats,
  ITEM_BALANCE_RELATIONS,
} from "~/server/items/effectiveStats";

/**
 * Fetch UserItems by their IDs with all related data
 * Returns data in ItemWithStats format (compatible with existing components)
 * Exact inventory/equipment references may use the current IN_INVENTORY state
 * or the legacy EQUIPPED state. Market and terminal states remain excluded,
 * and so are other players' items, whatever ids are asked for.
 */
export async function fetchUserItemsByIds(
  userId: string,
  userItemIds: number[],
) {
  if (userItemIds.length === 0) return [];

  const userItems = await prisma.userItem.findMany({
    where: {
      id: { in: userItemIds },
      userId,
      status: { in: ["IN_INVENTORY", "EQUIPPED"] },
    },
    include: {
      itemTemplate: {
        include: {
          ...ITEM_BALANCE_RELATIONS,
          foodEffectStats: {
            select: { statType: true, value: true },
            orderBy: [{ statType: "asc" }],
          },
        },
      }, // Get the current shared item definition.
      statModifiers: true,
    },
  });

  // Check for missing UserItems
  const foundIds = new Set(userItems.map((ui) => ui.id));
  const missingIds = userItemIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    console.warn(
      `⚠️ WARNING: UserItem IDs not found: ${missingIds.join(", ")}`,
    );
    console.warn(
      `These are likely old Item template IDs that need to be converted to UserItems`,
    );
  }

  const effectiveItems = await hydrateEffectiveItemStats(userItems);

  // Transform to match ItemWithStats format
  return effectiveItems.map((userItem) => ({
    id: userItem.id, // UserItem ID (not template ID)
    itemId: userItem.itemTemplate.id, // Item template ID (for marketplace stats)
    name: userItem.itemTemplate.name,
    description: userItem.itemTemplate.description,
    price: userItem.itemTemplate.price,
    sprite: userItem.itemTemplate.sprite,
    itemType: userItem.itemTemplate.itemType,
    equipTo: userItem.itemTemplate.equipTo,
    twoHanded: userItem.itemTemplate.twoHanded,
    rarity: userItem.rarity, // UserItem's rarity (player-specific)
    minPhysicalDamage: userItem.itemTemplate.minPhysicalDamage,
    maxPhysicalDamage: userItem.itemTemplate.maxPhysicalDamage,
    minMagicDamage: userItem.itemTemplate.minMagicDamage,
    maxMagicDamage: userItem.itemTemplate.maxMagicDamage,
    armor: userItem.itemTemplate.armor,
    requiredLevel: userItem.itemTemplate.requiredLevel,
    stackable: userItem.itemTemplate.stackable,
    maxStackSize: userItem.itemTemplate.maxStackSize,
    isTradeable: userItem.isTradeable,
    healingAmount: userItem.itemTemplate.healingAmount,
    foodEffectSeconds: userItem.itemTemplate.foodEffectSeconds,
    foodEffectStats: userItem.itemTemplate.foodEffectStats,
    stats: userItem.stats.map((stat, index) => ({
      id: index,
      itemId: userItem.itemTemplate.id, // For compatibility
      statType: stat.statType,
      value: stat.value,
    })),
    quantity: userItem.quantity,
  }));
}
