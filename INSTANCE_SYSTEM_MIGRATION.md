# Instance System Migration Plan

## What Changed

### Before (Shared Items)
```
Item table: Wooden Bow (id: 5, rarity: COMMON)
Player 1 Inventory: [5, 12, 8]
Player 2 Inventory: [5, 15]
```
**Problem**: If Player 2 upgrades item 5 to MYTHIC, Player 1's item 5 also becomes MYTHIC!

### After (Item Instances)
```
Item table: Wooden Bow (template, id: 5)

UserItem table:
- id: 101, userId: "player1", itemId: 5, rarity: COMMON
- id: 102, userId: "player2", itemId: 5, rarity: MYTHIC

Player 1 Inventory: [101]
Player 2 Inventory: [102]
```
**Solution**: Each player has their own instance with unique rarity and stats!

## New Schema

### UserItem (Item Instances)
- **id**: Unique instance ID
- **userId**: Who owns this instance
- **itemId**: Reference to Item template (Wooden Bow, Iron Sword, etc.)
- **rarity**: This player's rarity level
- **stats**: UserItemStat[] - This player's stat values
- **acquiredAt**: When they got it
- **isTradeable**: Can be sold/traded
- **isEquipped**: Currently equipped?

### UserItemStat
- **userItemId**: Reference to UserItem instance
- **statType**: PHYSICAL_DAMAGE_MIN, ARMOR, etc.
- **value**: Stat value (with rarity multiplier applied)

### InventorySlot (Replaces JSON slots)
- **inventoryId**: Reference to Inventory
- **slotIndex**: 0-19 (or up to maxSlots)
- **userItemId**: Reference to UserItem instance (null = empty)

### Inventory (Updated)
- **maxSlots**: Still determines capacity based on backpack
- **slots**: JSON (DEPRECATED - for backward compatibility during migration)
- **slotData**: InventorySlot[] (NEW - relational slots)

### Equipment (Updated)
- **Old fields** (head, chest, weapon, etc.): Item template IDs (DEPRECATED)
- **New fields** (headItemId, chestItemId, weaponItemId, etc.): UserItem instance IDs

## Migration Strategy

### Phase 1: Add New Tables (Current)
✅ Create UserItem, UserItemStat, InventorySlot tables
✅ Add instance ID fields to Equipment
✅ Keep old fields for backward compatibility

### Phase 2: Migration Script
Convert existing data from old system to new:

```typescript
// For each user
for (const user of users) {
  // Migrate inventory slots
  const inventory = await prisma.inventory.findUnique({
    where: { userId: user.id }
  });
  
  const slotsJson = inventory.slots as JsonArray;
  
  for (const [index, slot] of slotsJson.entries()) {
    if (slot && slot.item && slot.item.id) {
      const itemId = slot.item.id;
      
      // Create UserItem instance
      const userItem = await prisma.userItem.create({
        data: {
          userId: user.id,
          itemId: itemId,
          rarity: ItemRarity.COMMON, // Default rarity
          isTradeable: true,
          isEquipped: false,
        }
      });
      
      // Copy stats from Item template to UserItem
      const itemStats = await prisma.itemStat.findMany({
        where: { itemId }
      });
      
      for (const stat of itemStats) {
        await prisma.userItemStat.create({
          data: {
            userItemId: userItem.id,
            statType: stat.statType,
            value: stat.value,
          }
        });
      }
      
      // Create inventory slot
      await prisma.inventorySlot.create({
        data: {
          inventoryId: inventory.id,
          slotIndex: index,
          userItemId: userItem.id,
        }
      });
    } else {
      // Empty slot
      await prisma.inventorySlot.create({
        data: {
          inventoryId: inventory.id,
          slotIndex: index,
          userItemId: null,
        }
      });
    }
  }
  
  // Migrate equipment
  const equipment = await prisma.equipment.findUnique({
    where: { userId: user.id }
  });
  
  if (equipment) {
    const updates: any = {};
    
    // For each equipment slot
    if (equipment.weapon) {
      const userItem = await createUserItemFromTemplate(
        user.id,
        equipment.weapon,
        true // isEquipped
      );
      updates.weaponItemId = userItem.id;
    }
    
    // ... repeat for all equipment slots
    
    await prisma.equipment.update({
      where: { userId: user.id },
      data: updates
    });
  }
}
```

### Phase 3: Update Application Code
- Update inventory queries to use InventorySlot + UserItem
- Update equipment queries to use *ItemId fields
- Update DnD system to work with UserItem IDs
- Update API routes to create/manage UserItem instances

### Phase 4: Remove Old Fields
Once everything is migrated and tested:
- Remove `slots` JSON field from Inventory
- Remove old equipment fields (head, chest, weapon, etc.)
- Keep Item table as templates only

## Benefits

✅ **Isolated item instances**: Each player's items are independent
✅ **Unique rarities**: Player A's Mythic Sword, Player B's Common Sword
✅ **Marketplace ready**: Trade specific instances, not templates
✅ **Upgrade system**: Upgrade YOUR item without affecting others
✅ **Better querying**: Relational data instead of JSON parsing
✅ **Scalable**: Supports future features (item durability, enchantments, sockets)

## Example Workflows

### Creating a New Item for Player
```typescript
// Player finds/buys a Wooden Bow
const userItem = await prisma.userItem.create({
  data: {
    userId: "player123",
    itemId: 5, // Wooden Bow template
    rarity: ItemRarity.COMMON,
  }
});

// Copy base stats from template and apply rarity
await applyRarityToUserItem(userItem.id, ItemRarity.COMMON);

// Add to inventory
await prisma.inventorySlot.create({
  data: {
    inventoryId: playerInventory.id,
    slotIndex: firstEmptySlot,
    userItemId: userItem.id,
  }
});
```

### Upgrading Player's Item
```typescript
// Player upgrades their Wooden Bow from COMMON to UNCOMMON
const userItem = await prisma.userItem.findUnique({
  where: { id: userItemId },
  include: { stats: true }
});

// Calculate base stats (divide by current multiplier)
const baseStats = calculateBaseStats(userItem.stats, userItem.rarity);

// Apply new rarity multiplier
const newStats = applyRarityMultiplier(baseStats, ItemRarity.UNCOMMON);

// Update UserItem
await prisma.userItem.update({
  where: { id: userItemId },
  data: { rarity: ItemRarity.UNCOMMON }
});

// Update stats
for (const stat of newStats) {
  await prisma.userItemStat.update({
    where: {
      userItemId_statType: {
        userItemId: userItemId,
        statType: stat.statType
      }
    },
    data: { value: stat.value }
  });
}
```

### Trading Items
```typescript
// Player 1 sells Mythic Wooden Bow to Player 2
const userItem = await prisma.userItem.findUnique({
  where: { id: userItemId }
});

// Verify tradeable
if (!userItem.isTradeable) {
  throw new Error("Item cannot be traded");
}

// Remove from Player 1's inventory
await prisma.inventorySlot.updateMany({
  where: { userItemId: userItemId },
  data: { userItemId: null }
});

// Transfer ownership
await prisma.userItem.update({
  where: { id: userItemId },
  data: { userId: "player2" }
});

// Add to Player 2's inventory
await prisma.inventorySlot.update({
  where: {
    inventoryId: player2Inventory.id,
    slotIndex: emptySlot
  },
  data: { userItemId: userItemId }
});
```

## Next Steps

1. Create migration script to convert existing data
2. Create utility functions for UserItem management
3. Update API routes to use UserItem system
4. Update frontend components to display UserItem data
5. Test thoroughly with multiple users
6. Deploy migration
7. Remove deprecated fields

## Rollback Plan

If issues arise:
1. Old fields still exist in Equipment and Inventory
2. Can temporarily read from both systems
3. Switch back to old system if needed
4. Fix issues and retry migration
