import { prisma } from "~/lib/prisma";

/**
 * Fetch UserItems by their IDs with all related data
 * Returns data in ItemWithStats format (compatible with existing components)
 * Only fetches items with status IN_INVENTORY (not LISTED, SOLD, etc.)
 */
export async function fetchUserItemsByIds(userItemIds: number[]) {
  if (userItemIds.length === 0) return [];

  console.log(`fetchUserItemsByIds: Attempting to fetch UserItem IDs: ${userItemIds.join(', ')}`);

  const userItems = await prisma.userItem.findMany({
    where: {
      id: { in: userItemIds },
      status: "IN_INVENTORY", // Only fetch items in inventory (not listed on marketplace)
    },
    include: {
      itemTemplate: true, // Get the base item data (name, sprite, etc.)
      stats: true, // Get the rarity-multiplied stats
    },
  });

  console.log(`fetchUserItemsByIds: Found ${userItems.length} UserItems out of ${userItemIds.length} requested`);
  
  // Check for missing UserItems
  const foundIds = new Set(userItems.map(ui => ui.id));
  const missingIds = userItemIds.filter(id => !foundIds.has(id));
  if (missingIds.length > 0) {
    console.warn(`⚠️ WARNING: UserItem IDs not found: ${missingIds.join(', ')}`);
    console.warn(`These are likely old Item template IDs that need to be converted to UserItems`);
  }

  // Transform to match ItemWithStats format
  return userItems.map((userItem) => ({
    id: userItem.id, // UserItem ID (not template ID)
    name: userItem.itemTemplate.name,
    price: userItem.itemTemplate.price,
    sprite: userItem.itemTemplate.sprite,
    equipTo: userItem.itemTemplate.equipTo,
    rarity: userItem.rarity, // UserItem's rarity (player-specific)
    minPhysicalDamage: userItem.itemTemplate.minPhysicalDamage,
    maxPhysicalDamage: userItem.itemTemplate.maxPhysicalDamage,
    minMagicDamage: userItem.itemTemplate.minMagicDamage,
    maxMagicDamage: userItem.itemTemplate.maxMagicDamage,
    armor: userItem.itemTemplate.armor,
    requiredLevel: userItem.itemTemplate.requiredLevel,
    stats: userItem.stats.map((stat) => ({
      id: stat.id,
      itemId: userItem.itemTemplate.id, // For compatibility
      statType: stat.statType,
      value: stat.value, // Rarity-multiplied value
    })),
  }));
}
