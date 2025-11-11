# Items System Guide

Complete guide to the items system - database architecture, functions, and how to use them.

---

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Core Concepts](#core-concepts)
3. [Available Functions](#available-functions)
4. [Common Use Cases](#common-use-cases)
5. [Rarity System](#rarity-system)
6. [Stats System](#stats-system)
7. [Best Practices](#best-practices)

---

## Database Architecture

### Table Relationships

```
Item (Templates)
├── ItemStat (Base stats for template)
└── UserItem (Player-owned instances)
    ├── UserItemStat (Instance-specific stats with rarity multipliers)
    └── InventorySlot (Position in inventory)

User
├── UserItem (All items they own)
├── Inventory (JSON slots + deleteSlot)
└── Equipment (Equipped UserItem IDs)
```

### Key Tables

#### 1. **Item** (Templates - Shared by all players)
```prisma
model Item {
  id                Int        // Unique item template ID
  name              String     // Item name (e.g., "Wooden Sword")
  price             Float      // Base gold value
  sprite            String     // Path to image
  equipTo           String?    // Slot: weapon, head, chest, belt, etc.
  rarity            ItemRarity // Default rarity for this template
  
  // Denormalized columns (for fast queries)
  minPhysicalDamage Float?
  maxPhysicalDamage Float?
  minMagicDamage    Float?
  maxMagicDamage    Float?
  armor             Float?
  requiredLevel     Int?
  
  // Relations
  stats     ItemStat[]   // Base stats (before rarity multiplier)
  userItems UserItem[]   // All player instances of this item
}
```

**Purpose:** Item templates are the "blueprint" for items. They define what the item is, what it looks like, and its base stats. Multiple players can have the same item template but with different rarities.

#### 2. **ItemStat** (Template stats)
```prisma
model ItemStat {
  id       Int      
  itemId   Int      // References Item
  statType StatType // STRENGTH, VITALITY, CRITICAL_CHANCE, etc.
  value    Float    // Base value (before rarity multiplier)
  
  item Item @relation(fields: [itemId], references: [id])
}
```

**Purpose:** Stores base stats for item templates. These are multiplied by rarity when creating UserItems.

#### 3. **UserItem** (Player-owned instances)
```prisma
model UserItem {
  id             Int           
  userId         String        // Owner
  itemId         Int           // References Item template
  rarity         ItemRarity    // COMMON, RARE, LEGENDARY, etc.
  
  acquiredAt     DateTime      // When player got this
  isTradeable    Boolean       
  isEquipped     Boolean       
  
  user           User          
  itemTemplate   Item          
  stats          UserItemStat[] // Rarity-multiplied stats
  inventorySlots InventorySlot[]
}
```

**Purpose:** Each UserItem represents one specific item instance that a player owns. Same item template can exist multiple times for same player with different rarities and stats.

**Example:** Player has 3 "Wooden Sword" items:
- UserItem #1: COMMON rarity (1.0x stats)
- UserItem #2: RARE rarity (1.35x stats)
- UserItem #3: LEGENDARY rarity (2.3x stats)

#### 4. **UserItemStat** (Instance stats)
```prisma
model UserItemStat {
  id         Int      
  userItemId Int      // References UserItem
  statType   StatType 
  value      Float    // Rarity-multiplied value
  
  userItem UserItem @relation(fields: [userItemId], references: [id])
}
```

**Purpose:** Stores the actual stats for each UserItem instance. Values are calculated as: `ItemStat.value × RarityMultiplier`.

#### 5. **Inventory**
```prisma
model Inventory {
  id           Int   
  userId       String @unique
  maxSlots     Int   @default(20)
  slots        Json  // DnD format: [{ slotIndex: 0, item: { id: userItemId } }]
  deleteSlotId Int?  // UserItem ID in delete/trash slot
  
  User     User
  slotData InventorySlot[] // Relational reference
}
```

**Purpose:** 
- **slots (JSON):** Used for drag-and-drop UI. Stores UserItem IDs in slots.
- **deleteSlotId:** Temporary trash slot for items before permanent deletion.
- **slotData:** Relational data for complex queries (not used by UI).

#### 6. **Equipment**
```prisma
model Equipment {
  id     Int    
  userId String @unique
  
  // UserItem instance IDs (current system)
  headItemId      Int?
  chestItemId     Int?
  beltItemId      Int?
  legsItemId      Int?
  bootsItemId     Int?
  weaponItemId    Int?
  shouldersItemId Int?
  glovesItemId    Int?
  necklaceItemId  Int?
  ring1ItemId     Int?
  ring2ItemId     Int?
  amuletItemId    Int?
  backpackItemId  Int?
  
  // DEPRECATED columns (old system - ignore these)
  head      Int?
  chest     Int?
  // ... etc
  
  User User
}
```

**Purpose:** Stores which UserItems the player currently has equipped. Uses UserItem IDs (not template IDs).

---

## Core Concepts

### 1. Templates vs Instances

**Item Template (Item table):**
- Shared blueprint for all players
- Defines: name, sprite, base stats, default rarity
- Created once, used by many players

**UserItem Instance (UserItem table):**
- Player-specific copy of a template
- Has unique: rarity, stats (multiplied by rarity), acquisition time
- Created every time a player receives an item

**Analogy:** Think of Item as a "recipe" and UserItem as the "meal you cooked from it."

### 2. Rarity System

Items have 12 rarity tiers:

| Rarity      | Multiplier | Color    | Typical Use                  |
|-------------|------------|----------|------------------------------|
| WORTHLESS   | 0.5x       | Gray     | Junk items                   |
| BROKEN      | 0.75x      | Brown    | Damaged items                |
| COMMON      | 1.0x       | Gray     | Starting gear                |
| UNCOMMON    | 1.15x      | Green    | Basic loot drops             |
| RARE        | 1.35x      | Blue     | Quest rewards                |
| EXQUISITE   | 1.5x       | Cyan     | Crafted items                |
| EPIC        | 1.7x       | Purple   | Boss drops                   |
| ELITE       | 1.9x       | Pink     | Elite enemy drops            |
| UNIQUE      | 2.1x       | Amber    | Special event items          |
| LEGENDARY   | 2.3x       | Gold     | Endgame content              |
| MYTHIC      | 2.7x       | Red      | Extremely rare               |
| DIVINE      | 3.0x       | White    | Ultimate tier (cannot upgrade)|

**Rarity affects:**
- Stat values (all stats multiplied by rarity multiplier)
- Visual appearance (color coding in UI)
- Upgrade costs (higher rarities cost more to upgrade)

### 3. Stats System

**Available Stat Types (StatType enum):**

```typescript
// Offensive
PHYSICAL_DAMAGE_MIN
PHYSICAL_DAMAGE_MAX
MAGIC_DAMAGE_MIN
MAGIC_DAMAGE_MAX
CRITICAL_CHANCE
CRITICAL_DAMAGE
ATTACK_SPEED
ACCURACY

// Defensive
ARMOR
MAGIC_RESIST
EVASION_MELEE
EVASION_RANGED
EVASION_MAGIC
BLOCK_CHANCE

// Resistances
FIRE_RESIST
COLD_RESIST
LIGHTNING_RESIST
POISON_RESIST

// Resources
HEALTH
MANA
HEALTH_REGEN
MANA_REGEN

// Special
PRAYER_POINTS
MOVEMENT_SPEED
LUCK
GOLD_FIND
EXPERIENCE_GAIN
LIFESTEAL
THORNS
```

**How Stats Work:**

The system uses **Stat Progressions** to ensure consistency: **items of the same template and rarity always have identical stats**.

#### Stat Progression System

Each item template defines which stats unlock at which rarity using the `ItemStatProgression` table:

```typescript
// Example: Wooden Sword progressions
ItemStatProgression:
- CRITICAL_CHANCE: 5 base, unlocks at COMMON
- ATTACK_SPEED: 0.1 base, unlocks at MYTHIC
- LIFESTEAL: 3 base, unlocks at DIVINE

// What players get:
COMMON Wooden Sword:    CRITICAL_CHANCE: 5 × 1.0 = 5
RARE Wooden Sword:      CRITICAL_CHANCE: 5 × 1.35 = 6.75
MYTHIC Wooden Sword:    CRITICAL_CHANCE: 5 × 2.7 = 13.5
                        ATTACK_SPEED: 0.1 × 2.7 = 0.27
DIVINE Wooden Sword:    CRITICAL_CHANCE: 5 × 3.0 = 15
                        ATTACK_SPEED: 0.1 × 3.0 = 0.3
                        LIFESTEAL: 3 × 3.0 = 9
```

**Key Benefits:**
- ✅ Same item + same rarity = identical stats (no RNG)
- ✅ Higher rarities unlock new stats (exciting progression)
- ✅ Stats scale with rarity multiplier
- ✅ Unlimited stats (not limited to 2)

#### Setting Up Stat Progressions

```typescript
import { setItemStatProgressions } from "~/utils/statProgressions";
import { StatType, ItemRarity } from "@prisma/client";

// Define what stats unlock at each rarity
await setItemStatProgressions(19, [ // Wooden Sword
  { 
    statType: StatType.CRITICAL_CHANCE, 
    baseValue: 5, 
    unlocksAtRarity: ItemRarity.COMMON 
  },
  { 
    statType: StatType.ATTACK_SPEED, 
    baseValue: 0.1, 
    unlocksAtRarity: ItemRarity.MYTHIC 
  },
  { 
    statType: StatType.LIFESTEAL, 
    baseValue: 3, 
    unlocksAtRarity: ItemRarity.DIVINE 
  },
]);
```

See `scripts/setupStatProgressions.ts` for examples.

---

## Available Functions

### Creating Items for Players

#### **createUserItem()** - Give item to player
```typescript
import { createUserItem } from "~/utils/userItems";
import { ItemRarity } from "@prisma/client";

// Give player a specific item with specific rarity
const userItemId = await createUserItem(
  userId,        // Player's user ID
  itemId,        // Item template ID
  ItemRarity.RARE, // Rarity tier
  false          // isEquipped (usually false for new items)
);

// Returns: UserItem ID (NOT Item template ID)
```

**When to use:**
- Quest rewards
- Enemy loot drops
- Shop purchases
- Achievement unlocks
- Admin giving items

**Example - Quest Reward:**
```typescript
// After completing quest, give player a rare sword
const swordTemplateId = 19; // Wooden Sword template
const userItemId = await createUserItem(
  player.id,
  swordTemplateId,
  ItemRarity.RARE
);

// Add to inventory
await addItemToInventory(player.id, userItemId);
```

---

### Managing Inventory

#### **addItemToInventory()** - Add UserItem to first empty slot
```typescript
import { addItemToInventory } from "~/utils/inventorySync";

const slotIndex = await addItemToInventory(userId, userItemId);
// Returns: slot index (0-19) where item was placed
// Throws error if inventory is full
```

#### **removeItemFromInventory()** - Remove item from inventory
```typescript
import { removeItemFromInventory } from "~/utils/inventorySync";

await removeItemFromInventory(userId, userItemId);
// Clears the slot containing this UserItem
```

#### **moveItemInInventory()** - Move item between slots
```typescript
import { moveItemInInventory } from "~/utils/inventorySync";

await moveItemInInventory(userId, fromSlotIndex, toSlotIndex);
// Swaps items between slots (handles DnD)
```

#### **getUserInventoryWithItems()** - Get full inventory data
```typescript
import { getUserInventoryWithItems } from "~/utils/inventorySync";

const inventory = await getUserInventoryWithItems(userId);
// Returns: { id, maxSlots, slots: [...], deleteSlotId, slotData }
```

---

### Fetching Item Data

#### **fetchUserItemsByIds()** - Get UserItems by IDs (for display)
```typescript
import { fetchUserItemsByIds } from "~/utils/userItemInventory";

const userItems = await fetchUserItemsByIds([101, 102, 103]);
// Returns array of items with template data + rarity + stats
```

**Use this for:**
- Displaying items in inventory UI
- Showing equipped items
- Character screen
- Item tooltips

**Returns format:**
```typescript
{
  id: 101,              // UserItem ID
  name: "Wooden Sword", // From template
  sprite: "/assets/items/weapons/wooden-sword.jpg",
  rarity: "RARE",       // Instance rarity
  minPhysicalDamage: 3,
  maxPhysicalDamage: 7,
  stats: [              // Rarity-multiplied stats
    { statType: "STRENGTH", value: 13.5 }
  ]
}
```

#### **getUserItem()** - Get single UserItem with full details
```typescript
import { getUserItem } from "~/utils/userItems";

const item = await getUserItem(userItemId);
// Returns: UserItem with itemTemplate, stats, user
```

#### **getUserItems()** - Get all items owned by user
```typescript
import { getUserItems } from "~/utils/userItems";

const allItems = await getUserItems(userId);
// Returns: All UserItems for this player (including equipped)
```

---

### Rarity & Upgrades

#### **upgradeUserItemRarity()** - Upgrade item to next tier
```typescript
import { upgradeUserItemRarity } from "~/utils/userItems";

const result = await upgradeUserItemRarity(userItemId, userId);

if (result.success) {
  console.log(`Upgraded to ${result.newRarity}`);
  console.log(`New stats:`, result.newStats);
} else {
  console.error(result.message); // e.g., "Cannot upgrade DIVINE items"
}
```

**What it does:**
1. Checks if upgrade is allowed (DIVINE cannot be upgraded)
2. Calculates new stats with higher multiplier
3. Updates UserItem rarity
4. Updates UserItemStat values
5. Returns new rarity and stats

**Costs:** Defined in `RarityConfig.upgradeCost` (currently not deducted - implement gold check)

#### **getRarityMultiplier()** - Get multiplier for rarity
```typescript
import { getRarityMultiplier } from "~/utils/rarity";

const multiplier = getRarityMultiplier(ItemRarity.LEGENDARY);
// Returns: 2.3
```

#### **getRarityColor()** - Get color hex for UI
```typescript
import { getRarityColor } from "~/utils/rarity";

const color = getRarityColor(ItemRarity.EPIC);
// Returns: "#a855f7" (purple)
```

---

### Creating New Item Templates

**Option 1: CSV Import (Recommended)**
1. Go to `/admin` page
2. Click "Export Current Items" to get template
3. Edit CSV in Google Sheets
4. Add new rows with item data
5. Export as CSV
6. Upload via admin panel

**Option 2: Direct Database Insert**
```typescript
import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType } from "@prisma/client";

// Create item template
const item = await prisma.item.create({
  data: {
    name: "Magic Staff",
    price: 500,
    sprite: "/assets/items/weapons/magic-staff.jpg",
    equipTo: "weapon",
    rarity: ItemRarity.UNCOMMON, // Default rarity
    minPhysicalDamage: 0,
    maxPhysicalDamage: 0,
    minMagicDamage: 15,
    maxMagicDamage: 30,
    armor: 0,
    requiredLevel: 8,
  },
});

// Add base stats
await prisma.itemStat.createMany({
  data: [
    {
      itemId: item.id,
      statType: StatType.MAGIC_DAMAGE_MAX,
      value: 30,
    },
    {
      itemId: item.id,
      statType: StatType.MANA,
      value: 50,
    },
  ],
});
```

---

## Common Use Cases

### 1. Enemy Drops Loot

```typescript
import { createUserItem } from "~/utils/userItems";
import { addItemToInventory } from "~/utils/inventorySync";
import { ItemRarity } from "@prisma/client";

async function dropLoot(playerId: string, enemyLevel: number) {
  // Determine loot (simplified)
  const lootTable = {
    itemId: 19, // Wooden Sword
    dropChance: 0.3,
  };
  
  if (Math.random() > lootTable.dropChance) {
    return; // No drop
  }
  
  // Determine rarity based on enemy level
  let rarity = ItemRarity.COMMON;
  const roll = Math.random();
  
  if (enemyLevel > 10) {
    if (roll < 0.05) rarity = ItemRarity.EPIC;
    else if (roll < 0.15) rarity = ItemRarity.RARE;
    else if (roll < 0.40) rarity = ItemRarity.UNCOMMON;
  } else {
    if (roll < 0.10) rarity = ItemRarity.UNCOMMON;
  }
  
  // Create item instance with determined rarity
  const userItemId = await createUserItem(
    playerId,
    lootTable.itemId,
    rarity
  );
  
  // Add to inventory
  try {
    const slotIndex = await addItemToInventory(playerId, userItemId);
    return {
      success: true,
      itemId: userItemId,
      rarity,
      slotIndex,
    };
  } catch (error) {
    // Inventory full - handle appropriately
    // Option: Send to mailbox, drop on ground, etc.
    return { success: false, reason: "inventory_full" };
  }
}
```

---

### 2. Quest Reward System

```typescript
import { createUserItem } from "~/utils/userItems";
import { addItemToInventory } from "~/utils/inventorySync";
import { ItemRarity } from "@prisma/client";

async function giveQuestReward(playerId: string, questId: string) {
  const questRewards = {
    "starter_quest": {
      itemId: 19, // Wooden Sword
      rarity: ItemRarity.COMMON,
      gold: 100,
    },
    "dragon_slayer": {
      itemId: 23, // Silver Revolver
      rarity: ItemRarity.LEGENDARY,
      gold: 5000,
    },
  };
  
  const reward = questRewards[questId];
  if (!reward) return;
  
  // Create item with fixed rarity
  const userItemId = await createUserItem(
    playerId,
    reward.itemId,
    reward.rarity
  );
  
  await addItemToInventory(playerId, userItemId);
  
  // Give gold (implement your gold system)
  // await addGold(playerId, reward.gold);
  
  return {
    itemId: userItemId,
    gold: reward.gold,
  };
}
```

---

### 3. NPC Shop Purchase (New Items)

**For NPC vendors that sell new items (not player marketplace):**

```typescript
import { createUserItem } from "~/utils/userItems";
import { addItemToInventory } from "~/utils/inventorySync";
import { prisma } from "~/lib/prisma";
import { ItemRarity } from "@prisma/client";

async function purchaseFromNPC(
  playerId: string,
  itemTemplateId: number
): Promise<{ success: boolean; message: string }> {
  // Get item template
  const itemTemplate = await prisma.item.findUnique({
    where: { id: itemTemplateId },
  });
  
  if (!itemTemplate) {
    return { success: false, message: "Item not found" };
  }
  
  // Check player gold (implement your currency system)
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    // select: { gold: true } // Add gold field to User model
  });
  
  // if (player.gold < itemTemplate.price) {
  //   return { success: false, message: "Not enough gold" };
  // }
  
  // NPC shops sell COMMON rarity by default
  const userItemId = await createUserItem(
    playerId,
    itemTemplateId,
    ItemRarity.COMMON
  );
  
  try {
    await addItemToInventory(playerId, userItemId);
    
    // Deduct gold
    // await prisma.user.update({
    //   where: { id: playerId },
    //   data: { gold: { decrement: itemTemplate.price } }
    // });
    
    return {
      success: true,
      message: `Purchased ${itemTemplate.name}`,
    };
  } catch (error) {
    // Rollback: delete created UserItem
    await prisma.userItem.delete({
      where: { id: userItemId },
    });
    
    return {
      success: false,
      message: error.message,
    };
  }
}
```

---

### 3b. Player Marketplace (Transfer UserItems)

**For player-to-player trading marketplace:**

```typescript
import { addItemToInventory } from "~/utils/inventorySync";
import { removeItemFromInventory } from "~/utils/inventorySync";
import { getUserItem } from "~/utils/userItems";
import { prisma } from "~/lib/prisma";

// Marketplace listing model (add to schema.prisma):
// model MarketplaceListing {
//   id          Int      @id @default(autoincrement())
//   userItemId  Int      @unique
//   sellerId    String
//   price       Float
//   listedAt    DateTime @default(now())
//   
//   userItem    UserItem @relation(fields: [userItemId], references: [id])
//   seller      User     @relation(fields: [sellerId], references: [id])
// }

async function listItemOnMarketplace(
  sellerId: string,
  userItemId: number,
  price: number
): Promise<{ success: boolean; message: string }> {
  // Verify ownership
  const userItem = await getUserItem(userItemId);
  
  if (!userItem || userItem.userId !== sellerId) {
    return { success: false, message: "Item not found or not yours" };
  }
  
  if (userItem.isEquipped) {
    return { success: false, message: "Cannot sell equipped items" };
  }
  
  if (!userItem.isTradeable) {
    return { success: false, message: "This item cannot be traded" };
  }
  
  // Remove from seller's inventory
  await removeItemFromInventory(sellerId, userItemId);
  
  // Create marketplace listing
  await prisma.marketplaceListing.create({
    data: {
      userItemId,
      sellerId,
      price,
    },
  });
  
  return { success: true, message: "Item listed on marketplace" };
}

async function purchaseFromMarketplace(
  buyerId: string,
  listingId: number
): Promise<{ success: boolean; message: string; userItemId?: number }> {
  // Get listing
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: listingId },
    include: {
      userItem: {
        include: {
          itemTemplate: true,
        },
      },
    },
  });
  
  if (!listing) {
    return { success: false, message: "Listing not found" };
  }
  
  if (listing.sellerId === buyerId) {
    return { success: false, message: "Cannot buy your own item" };
  }
  
  // Check buyer has enough gold
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    // select: { gold: true }
  });
  
  // if (buyer.gold < listing.price) {
  //   return { success: false, message: "Not enough gold" };
  // }
  
  // Execute transaction
  await prisma.$transaction(async (tx) => {
    // Transfer gold: buyer → seller
    // await tx.user.update({
    //   where: { id: buyerId },
    //   data: { gold: { decrement: listing.price } }
    // });
    
    // await tx.user.update({
    //   where: { id: listing.sellerId },
    //   data: { gold: { increment: listing.price } }
    // });
    
    // Transfer item ownership
    await tx.userItem.update({
      where: { id: listing.userItemId },
      data: {
        userId: buyerId, // Change owner
        isEquipped: false,
      },
    });
    
    // Delete listing
    await tx.marketplaceListing.delete({
      where: { id: listingId },
    });
  });
  
  // Add to buyer's inventory
  try {
    await addItemToInventory(buyerId, listing.userItemId);
  } catch (error) {
    // Inventory full - item is owned but not in inventory
    // Could implement mailbox system here
    return {
      success: true,
      message: "Purchase successful! Item sent to mailbox (inventory full)",
      userItemId: listing.userItemId,
    };
  }
  
  return {
    success: true,
    message: `Purchased ${listing.userItem.itemTemplate.name}`,
    userItemId: listing.userItemId,
  };
}

async function cancelMarketplaceListing(
  sellerId: string,
  listingId: number
): Promise<{ success: boolean; message: string }> {
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: listingId },
  });
  
  if (!listing) {
    return { success: false, message: "Listing not found" };
  }
  
  if (listing.sellerId !== sellerId) {
    return { success: false, message: "Not your listing" };
  }
  
  // Delete listing
  await prisma.marketplaceListing.delete({
    where: { id: listingId },
  });
  
  // Return item to seller's inventory
  try {
    await addItemToInventory(sellerId, listing.userItemId);
    return { success: true, message: "Listing cancelled, item returned" };
  } catch (error) {
    // Inventory full - item still owned, just not in inventory
    return {
      success: true,
      message: "Listing cancelled (check mailbox - inventory full)",
    };
  }
}

// Get marketplace listings
async function getMarketplaceListings(filters?: {
  itemTemplateId?: number;
  minPrice?: number;
  maxPrice?: number;
  rarity?: ItemRarity;
  equipTo?: string;
}) {
  return await prisma.marketplaceListing.findMany({
    where: {
      ...(filters?.itemTemplateId && {
        userItem: { itemId: filters.itemTemplateId },
      }),
      ...(filters?.rarity && {
        userItem: { rarity: filters.rarity },
      }),
      ...(filters?.equipTo && {
        userItem: { itemTemplate: { equipTo: filters.equipTo } },
      }),
      ...(filters?.minPrice && { price: { gte: filters.minPrice } }),
      ...(filters?.maxPrice && { price: { lte: filters.maxPrice } }),
    },
    include: {
      userItem: {
        include: {
          itemTemplate: true,
          stats: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      listedAt: "desc",
    },
  });
}
```

---

### 4. Crafting System

```typescript
import { createUserItem } from "~/utils/userItems";
import { addItemToInventory } from "~/utils/inventorySync";
import { removeItemFromInventory } from "~/utils/inventorySync";
import { ItemRarity } from "@prisma/client";

async function craftItem(
  playerId: string,
  recipeId: string,
  materialUserItemIds: number[]
) {
  // Define recipe
  const recipes = {
    "iron_sword": {
      outputItemId: 20, // Iron Sword template
      outputRarity: ItemRarity.UNCOMMON,
      requiredMaterials: [
        { itemId: 50, quantity: 5 }, // Iron Ore
        { itemId: 51, quantity: 2 }, // Leather
      ],
    },
  };
  
  const recipe = recipes[recipeId];
  if (!recipe) {
    return { success: false, message: "Invalid recipe" };
  }
  
  // Verify player has materials (simplified - check userItemIds match)
  // ... material validation logic ...
  
  // Remove materials from inventory
  for (const materialId of materialUserItemIds) {
    await removeItemFromInventory(playerId, materialId);
    // Delete UserItem
    await prisma.userItem.delete({
      where: { id: materialId },
    });
  }
  
  // Create crafted item
  const craftedItemId = await createUserItem(
    playerId,
    recipe.outputItemId,
    recipe.outputRarity
  );
  
  await addItemToInventory(playerId, craftedItemId);
  
  return {
    success: true,
    itemId: craftedItemId,
    rarity: recipe.outputRarity,
  };
}
```

---

### 5. Random Loot Chest

```typescript
import { createUserItem } from "~/utils/userItems";
import { addItemToInventory } from "~/utils/inventorySync";
import { ItemRarity } from "@prisma/client";

async function openLootChest(playerId: string, chestType: string) {
  const lootTables = {
    "common_chest": {
      items: [
        { itemId: 19, weight: 50 }, // Wooden Sword
        { itemId: 20, weight: 50 }, // Wooden Dagger
        { itemId: 25, weight: 30 }, // Gold Helmet
      ],
      rarityWeights: {
        [ItemRarity.COMMON]: 70,
        [ItemRarity.UNCOMMON]: 25,
        [ItemRarity.RARE]: 5,
      },
    },
    "legendary_chest": {
      items: [
        { itemId: 23, weight: 40 }, // Silver Revolver
        { itemId: 34, weight: 60 }, // Gold Amulet
      ],
      rarityWeights: {
        [ItemRarity.EPIC]: 40,
        [ItemRarity.UNIQUE]: 35,
        [ItemRarity.LEGENDARY]: 20,
        [ItemRarity.MYTHIC]: 5,
      },
    },
  };
  
  const lootTable = lootTables[chestType];
  if (!lootTable) return { success: false };
  
  // Pick random item based on weights
  const totalWeight = lootTable.items.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * totalWeight;
  
  let selectedItem = lootTable.items[0];
  for (const item of lootTable.items) {
    roll -= item.weight;
    if (roll <= 0) {
      selectedItem = item;
      break;
    }
  }
  
  // Pick random rarity based on weights
  const rarityTotal = Object.values(lootTable.rarityWeights).reduce(
    (sum, w) => sum + w,
    0
  );
  roll = Math.random() * rarityTotal;
  
  let selectedRarity = ItemRarity.COMMON;
  for (const [rarity, weight] of Object.entries(lootTable.rarityWeights)) {
    roll -= weight;
    if (roll <= 0) {
      selectedRarity = rarity as ItemRarity;
      break;
    }
  }
  
  // Create and give item
  const userItemId = await createUserItem(
    playerId,
    selectedItem.itemId,
    selectedRarity
  );
  
  await addItemToInventory(playerId, userItemId);
  
  return {
    success: true,
    itemId: userItemId,
    rarity: selectedRarity,
  };
}
```

---

### 6. Equipping Items

```typescript
import { prisma } from "~/lib/prisma";
import { getUserItem } from "~/utils/userItems";

async function equipItem(
  playerId: string,
  userItemId: number
): Promise<{ success: boolean; message: string }> {
  // Get UserItem
  const userItem = await getUserItem(userItemId);
  
  if (!userItem) {
    return { success: false, message: "Item not found" };
  }
  
  if (userItem.userId !== playerId) {
    return { success: false, message: "Not your item" };
  }
  
  const equipSlot = userItem.itemTemplate.equipTo;
  if (!equipSlot) {
    return { success: false, message: "Item cannot be equipped" };
  }
  
  // Get or create equipment record
  let equipment = await prisma.equipment.findUnique({
    where: { userId: playerId },
  });
  
  if (!equipment) {
    equipment = await prisma.equipment.create({
      data: { userId: playerId },
    });
  }
  
  // Determine which column to update
  const slotColumnMap = {
    weapon: "weaponItemId",
    head: "headItemId",
    chest: "chestItemId",
    belt: "beltItemId",
    legs: "legsItemId",
    boots: "bootsItemId",
    shoulders: "shouldersItemId",
    gloves: "glovesItemId",
    necklace: "necklaceItemId",
    ring: "ring1ItemId", // Or ring2ItemId - implement dual ring logic
    amulet: "amuletItemId",
    backpack: "backpackItemId",
  };
  
  const column = slotColumnMap[equipSlot];
  if (!column) {
    return { success: false, message: "Invalid equipment slot" };
  }
  
  // Update equipment
  await prisma.equipment.update({
    where: { userId: playerId },
    data: {
      [column]: userItemId,
    },
  });
  
  // Mark UserItem as equipped
  await prisma.userItem.update({
    where: { id: userItemId },
    data: { isEquipped: true },
  });
  
  return { success: true, message: `Equipped to ${equipSlot}` };
}
```

---

## Rarity System

### Configuration

Rarity configs are stored in the `RarityConfig` table. Initialize them with:

```typescript
import { initializeRarityConfigs } from "~/utils/rarity";

await initializeRarityConfigs();
```

This creates configurations for all 12 rarities with:
- `statMultiplier`: How much stats are multiplied (0.5x - 3.0x)
- `color`: Hex color for UI display
- `upgradeEnabled`: Can this rarity be upgraded?
- `nextRarity`: What rarity it upgrades to
- `upgradeCost`: Gold cost to upgrade

### Upgrade Paths

```
WORTHLESS → BROKEN → COMMON → UNCOMMON → RARE → EXQUISITE → 
EPIC → ELITE → UNIQUE → LEGENDARY → MYTHIC → DIVINE (max)
```

DIVINE cannot be upgraded further.

---

## Stats System

### How Stats are Calculated

1. **Item Template Created** (base stats in ItemStat table)
   - Example: Wooden Sword has STRENGTH: 10

2. **UserItem Created** (rarity chosen)
   - COMMON: 10 × 1.0 = 10
   - RARE: 10 × 1.35 = 13.5
   - LEGENDARY: 10 × 2.3 = 23

3. **Stored in UserItemStat** (multiplied values)
   - Each UserItem has its own stats table
   - Values are final (already multiplied)

### When Stats are Recalculated

- **On UserItem creation:** Stats copied from template and multiplied
- **On rarity upgrade:** Base stats calculated (current / old multiplier), then new multiplier applied
- **Never on template changes:** Existing UserItems keep their stats

### Balancing Items

To change item balance:

1. **For NEW items only:** Update Item template stats
2. **For EXISTING items:** Need migration script to recalculate UserItemStats

Example migration:
```typescript
import { prisma } from "~/lib/prisma";
import { getRarityMultiplier } from "~/utils/rarity";

async function rebalanceItem(itemTemplateId: number, newBaseStats: any[]) {
  // Update template
  await prisma.itemStat.deleteMany({
    where: { itemId: itemTemplateId },
  });
  
  await prisma.itemStat.createMany({
    data: newBaseStats.map(stat => ({
      itemId: itemTemplateId,
      statType: stat.statType,
      value: stat.value,
    })),
  });
  
  // Update all UserItems of this template
  const userItems = await prisma.userItem.findMany({
    where: { itemId: itemTemplateId },
  });
  
  for (const userItem of userItems) {
    const multiplier = getRarityMultiplier(userItem.rarity);
    
    // Delete old stats
    await prisma.userItemStat.deleteMany({
      where: { userItemId: userItem.id },
    });
    
    // Create new stats with multiplier
    await prisma.userItemStat.createMany({
      data: newBaseStats.map(stat => ({
        userItemId: userItem.id,
        statType: stat.statType,
        value: stat.value * multiplier,
      })),
    });
  }
}
```

---

## Best Practices

### 1. Always Use UserItems

❌ **Wrong:**
```typescript
// Don't store Item template IDs in inventory
inventory.slots = [{ item: { id: 19 } }]; // Item ID
```

✅ **Correct:**
```typescript
// Always store UserItem IDs
const userItemId = await createUserItem(userId, 19, ItemRarity.COMMON);
inventory.slots = [{ item: { id: userItemId } }]; // UserItem ID
```

### 2. Check Ownership

Always verify UserItem belongs to the player:

```typescript
const userItem = await getUserItem(userItemId);
if (userItem.userId !== playerId) {
  throw new Error("Unauthorized");
}
```

### 3. Handle Full Inventory

```typescript
try {
  await addItemToInventory(playerId, userItemId);
} catch (error) {
  if (error.message === "Inventory is full") {
    // Send to mailbox, drop on ground, or notify player
  }
}
```

### 4. Delete UserItems When Consumed

For consumable items (potions, scrolls):

```typescript
// After using potion
await removeItemFromInventory(playerId, userItemId);
await prisma.userItem.delete({
  where: { id: userItemId },
});
```

### 5. Transaction Safety

Use transactions for complex operations:

```typescript
await prisma.$transaction(async (tx) => {
  // Remove materials
  for (const matId of materialIds) {
    await tx.userItem.delete({ where: { id: matId } });
  }
  
  // Create crafted item
  const craftedItem = await tx.userItem.create({
    data: { /* ... */ },
  });
  
  // Add stats
  await tx.userItemStat.createMany({
    data: stats,
  });
});
```

### 6. Fetching for Display

Use `fetchUserItemsByIds()` for UI rendering:

```typescript
// Get equipped items for character screen
const equipment = await prisma.equipment.findUnique({
  where: { userId },
});

const itemIds = [
  equipment.headItemId,
  equipment.chestItemId,
  equipment.weaponItemId,
].filter(Boolean);

const items = await fetchUserItemsByIds(itemIds);
// Ready to render with rarity colors, stats, etc.
```

---

## Quick Reference

### Function Summary

| Function | Purpose | Returns |
|----------|---------|---------|
| `createUserItem(userId, itemId, rarity, isEquipped)` | Give item to player | UserItem ID |
| `addItemToInventory(userId, userItemId)` | Add to first empty slot | Slot index |
| `removeItemFromInventory(userId, userItemId)` | Remove from inventory | void |
| `fetchUserItemsByIds(userItemIds)` | Get items for display | Array of items with stats |
| `getUserItem(userItemId)` | Get single item details | UserItem with relations |
| `getUserItems(userId)` | Get all user's items | Array of UserItems |
| `upgradeUserItemRarity(userItemId, userId)` | Upgrade to next tier | Result with new rarity |
| `getRarityMultiplier(rarity)` | Get stat multiplier | Number (0.5-3.0) |
| `getRarityColor(rarity)` | Get UI color | Hex color string |

---

## Example Workflow: Complete Item Lifecycle

```typescript
import { createUserItem } from "~/utils/userItems";
import { addItemToInventory } from "~/utils/inventorySync";
import { upgradeUserItemRarity } from "~/utils/userItems";
import { ItemRarity } from "@prisma/client";
import { prisma } from "~/lib/prisma";

// 1. Enemy drops loot
const lootItemId = await createUserItem(
  "player123",
  19, // Wooden Sword template
  ItemRarity.COMMON
);

// 2. Add to inventory
await addItemToInventory("player123", lootItemId);

// 3. Player picks it up and sees it in inventory
// (UI fetches with fetchUserItemsByIds)

// 4. Player upgrades the item
const upgradeResult = await upgradeUserItemRarity(lootItemId, "player123");
// Now it's UNCOMMON (1.15x stats)

// 5. Player equips it
await prisma.equipment.update({
  where: { userId: "player123" },
  data: { weaponItemId: lootItemId },
});

await prisma.userItem.update({
  where: { id: lootItemId },
  data: { isEquipped: true },
});

// 6. Later, player unequips and sells it to NPC
await prisma.equipment.update({
  where: { userId: "player123" },
  data: { weaponItemId: null },
});

await prisma.userItem.update({
  where: { id: lootItemId },
  data: { isEquipped: false },
});

// Remove from inventory
await removeItemFromInventory("player123", lootItemId);

// Delete the UserItem (sold)
await prisma.userItem.delete({
  where: { id: lootItemId },
});

// Give gold (implement your economy system)
// await addGold("player123", sellPrice);
```

---

## Troubleshooting

**Items not appearing in inventory?**
- Check you're using UserItem IDs, not Item template IDs
- Verify `fetchUserItemsByIds()` is being called
- Check console for missing UserItem warnings

**Stats not correct?**
- Verify rarity multiplier is being applied
- Check UserItemStat table has entries
- Use `upgradeUserItemRarity()` to recalculate

**Cannot equip item?**
- Check `equipTo` field is set on Item template
- Verify UserItem belongs to player
- Ensure equipment column name matches slot

**Inventory full errors?**
- Handle with try/catch
- Check maxSlots limit (default 20)
- Implement overflow system (mailbox, etc.)

---

This guide covers the complete items system. For bulk item management via CSV, see [ITEM_MANAGEMENT.md](./ITEM_MANAGEMENT.md).
