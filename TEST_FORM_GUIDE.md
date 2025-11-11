# Test Form: Add Items to Inventory

## What Was Added

A test form on the `/character` page that allows you to:
1. Select any item from the database
2. Choose a rarity (including all 12 rarities: WORTHLESS → DIVINE)
3. Add it to your inventory with that rarity

## How to Use

1. Go to `/character` page
2. At the top, you'll see "🧪 Test: Add Item to Inventory"
3. Select an item from dropdown (shows all items in database)
4. Select a rarity from dropdown (WORTHLESS, BROKEN, COMMON, ... DIVINE)
5. Click "Add Item to Inventory"
6. Page will reload and show the new item in your inventory

## What Happens Behind the Scenes

### 1. User Selects Item & Rarity
```
User picks: "Wooden Bow" + rarity "MYTHIC"
```

### 2. API Creates UserItem Instance
```typescript
POST /api/test/add-item
{
  userId: "user_123",
  itemId: 5,        // Wooden Bow template ID
  rarity: "MYTHIC"
}
```

### 3. System Creates Instance
```typescript
// Creates new UserItem
const userItemId = await createUserItem(
  userId,
  itemId: 5,
  rarity: "MYTHIC",
  isEquipped: false
);

// Copies base stats and applies rarity multiplier
// Base: Physical Damage 10-20
// Mythic (2.5x): Physical Damage 25-50
```

### 4. Adds to Inventory
```typescript
// Finds first empty slot
const slotIndex = await addItemToInventory(userId, userItemId);

// Updates both:
// - JSON slots: [{ userItemId: 456 }, ...]
// - InventorySlot: (inventoryId, slotIndex: 3, userItemId: 456)
```

### 5. Result
- ✅ You now own a Mythic Wooden Bow (unique instance)
- ✅ Stats are 2.5x base stats
- ✅ Shows in your inventory with mythic color
- ✅ Other players can have same item with different rarity

## Files Created/Modified

### New Files:
- `/src/components/forms/AddItemTestForm.tsx` - The test form component
- `/src/app/api/test/add-item/route.ts` - API endpoint to add items

### Modified Files:
- `/src/app/(game)/character/page.tsx` - Added form to character page

## API Endpoint

### POST `/api/test/add-item`

**Request:**
```json
{
  "userId": "user_123",
  "itemId": 5,
  "rarity": "MYTHIC"
}
```

**Response (Success):**
```json
{
  "success": true,
  "userItemId": 456,
  "itemName": "Wooden Bow",
  "rarity": "MYTHIC",
  "slotIndex": 3
}
```

**Response (Error):**
```json
{
  "error": "Inventory is full"
}
```

## Example Test Scenarios

### Scenario 1: Different Rarities
```
1. Add "Iron Sword" with rarity "COMMON"
2. Add "Iron Sword" with rarity "LEGENDARY"
3. You now have 2 Iron Swords with different stats!
```

### Scenario 2: Fill Inventory
```
1. Keep adding items until inventory is full
2. Try to add one more → Error: "Inventory is full"
```

### Scenario 3: View Stats
```
1. Add "Steel Armor" with rarity "EPIC"
2. Click on it in inventory
3. See stats with Epic multiplier (1.6x)
4. Item name shows in Epic color (purple)
```

## Rarity Colors in UI

When you add items, they'll show with these colors:

| Rarity | Color | Multiplier |
|--------|-------|------------|
| Worthless | Dark Gray | 0.5x |
| Broken | Gray | 0.75x |
| Common | Light Gray | 1.0x |
| Uncommon | Green | 1.15x |
| Rare | Blue | 1.35x |
| Exquisite | Cyan | 1.45x |
| Epic | Purple | 1.6x |
| Elite | Pink | 1.7x |
| Unique | Amber | 1.85x |
| Legendary | Gold | 2.0x |
| Mythic | Red | 2.5x |
| Divine | White/Glow | 3.0x |

## Cleanup

When you're done testing, you can:
1. Remove the form from `/src/app/(game)/character/page.tsx`
2. Keep the API endpoint if you want to add items programmatically
3. Or delete both if no longer needed

The test form is just for development - you wouldn't want this in production!

## Future: How You Can Do This Yourself

To add new rarities or change multipliers:

1. **Update Enum** (`schema.prisma`):
```prisma
enum ItemRarity {
  // Add new rarity here
  ANCIENT
}
```

2. **Update Constants** (`src/utils/rarity.ts`):
```typescript
const RARITY_MULTIPLIERS: Record<ItemRarity, number> = {
  // ...
  ANCIENT: 5.0,  // Add multiplier
};
```

3. **Update initializeRarityConfigs** (`src/utils/rarity.ts`):
```typescript
// Add config object
{
  rarity: ItemRarity.ANCIENT,
  statMultiplier: 5.0,
  minStats: 7,
  maxStats: 12,
  bonusStatChance: 1.0,
  color: "#8b5cf6",
  displayName: "Ancient",
  sortOrder: 13,
  upgradeEnabled: false,
  nextRarity: null,
  upgradeCost: null,
}
```

4. **Update getRarityColor** (`src/utils/rarity.ts`):
```typescript
const colors: Record<ItemRarity, string> = {
  // ...
  ANCIENT: "#8b5cf6",
};
```

5. **Run Migration**:
```bash
npx prisma migrate dev --name add_ancient_rarity
```

6. **Reinitialize Configs**:
```bash
POST /api/admin/rarity/init
```

Done! 🎉
