# Inventory System Architecture

## Overview

The inventory system uses a **dual-storage approach** to balance performance and functionality:

1. **JSON `slots` field** - Fast, simple storage for DnD (drag & drop)
2. **Relational `UserItem` + `InventorySlot`** - Full item instance data with rarity, stats, etc.

## Why Both?

### JSON Slots (DnD Performance)
```prisma
model Inventory {
  slots Json  // [{ userItemId: 123 }, { userItemId: 456 }, null, ...]
}
```

**Pros:**
- ✅ Fast read/write for drag & drop operations
- ✅ Preserves exact slot positions
- ✅ Simple structure for UI state
- ✅ No joins needed for basic rendering

**Use for:**
- Rendering inventory grid
- DnD operations (swap, move)
- Quick slot lookups

### Relational System (Item Instances)
```prisma
model UserItem {
  id      Int
  userId  String
  itemId  Int     // Template reference
  rarity  ItemRarity
  stats   UserItemStat[]
}

model InventorySlot {
  inventoryId Int
  slotIndex   Int
  userItemId  Int
}
```

**Pros:**
- ✅ Each player has unique item instances
- ✅ Players can have different rarities for same item
- ✅ Item stats are instance-specific
- ✅ Supports trading, upgrading, enchanting
- ✅ Proper foreign keys and cascading

**Use for:**
- Item ownership tracking
- Rarity/stat management
- Trading/marketplace
- Equipment stats calculation

## How They Work Together

### Data Flow

```
Player picks up "Wooden Bow"
    ↓
1. Create UserItem instance (userId, itemId=5, rarity=COMMON)
    ↓
2. Add to inventory JSON: slots[3] = { userItemId: 789 }
    ↓
3. Create InventorySlot (inventoryId, slotIndex=3, userItemId=789)
```

### Example: Player Upgrades Item

```typescript
// Player 2 upgrades their Wooden Bow to Mythic
await upgradeItemRarity(userItemId: 789, userId: "player2");

// Result:
// ✅ Player 2's UserItem (id=789) → rarity=MYTHIC, stats multiplied by 2.5x
// ✅ JSON slots[3] still points to userItemId=789 (no change needed)
// ❌ Player 1's UserItem (id=456) → rarity=COMMON (unchanged)

// The Item template (itemId=5) is never modified!
```

## Usage Examples

### Get Inventory for Rendering
```typescript
import { getUserInventoryWithItems } from "~/utils/inventorySync";

const inventory = await getUserInventoryWithItems(userId);

// Returns:
// {
//   maxSlots: 20,
//   slots: [
//     { slotIndex: 0, userItemId: 123, userItem: { rarity: 'MYTHIC', ... } },
//     { slotIndex: 1, userItemId: null, userItem: null },
//     ...
//   ]
// }

// Use for rendering grid:
inventory.slots.map(slot => (
  <InventorySlot item={slot.userItem} />
))
```

### Move Item (DnD)
```typescript
import { moveItemInInventory } from "~/utils/inventorySync";

// User drags item from slot 5 to slot 10
await moveItemInInventory(userId, fromSlotIndex: 5, toSlotIndex: 10);

// Updates BOTH:
// 1. JSON: swaps userItemIds in slots array
// 2. InventorySlot: updates slotIndex for both items
```

### Add Item to Inventory
```typescript
import { createUserItem } from "~/utils/userItems";
import { addItemToInventory } from "~/utils/inventorySync";

// 1. Create instance
const userItem = await createUserItem({
  userId: "player1",
  itemId: 5,  // Wooden Bow template
  rarity: "COMMON",
});

// 2. Add to inventory (finds first empty slot)
const slotIndex = await addItemToInventory("player1", userItem.id);
// Result: userItem added to first empty slot, both JSON and InventorySlot updated
```

### Remove Item from Inventory
```typescript
import { removeItemFromInventory } from "~/utils/inventorySync";

await removeItemFromInventory(userId, userItemId: 789);

// Updates BOTH:
// 1. JSON: sets slot to null
// 2. InventorySlot: deletes the mapping
// Note: UserItem still exists (could be in equipment, traded, etc.)
```

## Data Consistency

### Sync Rules
1. **JSON is source of truth for positions**
2. **InventorySlot mirrors JSON (for queries)**
3. **UserItem is source of truth for item data**

### When to Sync
- ✅ On every inventory update (add/remove/move)
- ✅ Automatically via `inventorySync.ts` helpers
- ❌ Don't manually edit JSON without syncing

### Migration/Repair
If JSON and InventorySlot get out of sync:

```typescript
import { updateInventorySlots } from "~/utils/inventorySync";

const inventory = await prisma.inventory.findUnique({ where: { userId } });
const jsonSlots = inventory.slots as { userItemId: number | null }[];

const slotsToSync = jsonSlots.map((slot, index) => ({
  slotIndex: index,
  userItemId: slot?.userItemId || null,
}));

await updateInventorySlots(userId, slotsToSync);
```

## Schema Reference

### Inventory Table
```prisma
model Inventory {
  id       Int             @id
  maxSlots Int             @default(20)  // From equipped backpack
  userId   String          @unique
  slots    Json            // DnD positions: [{ userItemId: 123 }, ...]
  slotData InventorySlot[] // Relational mirror
}
```

### UserItem Table
```prisma
model UserItem {
  id          Int        @id
  userId      String     // Owner
  itemId      Int        // Template reference
  rarity      ItemRarity // Instance rarity
  acquiredAt  DateTime
  isTradeable Boolean
  isEquipped  Boolean
  
  itemTemplate Item
  stats        UserItemStat[]
}
```

### InventorySlot Table (Mirror)
```prisma
model InventorySlot {
  inventoryId Int
  slotIndex   Int      // 0-19 (based on maxSlots)
  userItemId  Int?     // null = empty slot
  
  @@unique([inventoryId, slotIndex])
}
```

## Best Practices

1. **Always use sync helpers** from `inventorySync.ts`
2. **Never directly modify JSON** without updating InventorySlot
3. **Use UserItem.id** in JSON, not Item.id (template)
4. **Check maxSlots** before adding items
5. **Delete UserItem** only when truly discarded (not just unequipped)

## Performance Considerations

- **JSON reads are fast** - No joins for basic grid rendering
- **UserItem queries are needed** for stats calculation
- **InventorySlot enables advanced queries** (find all players with item X)
- **Index on UserItem.userId** for fast player inventory lookups
- **Cascade deletes** when user is deleted

## Future Enhancements

- Item stacking (store quantity in JSON/UserItem)
- Item durability (add durability field to UserItem)
- Item sockets (add SocketedGem[] relation to UserItem)
- Item bindings (add bindType field to UserItem)
