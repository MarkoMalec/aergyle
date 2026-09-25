# Items System Guide

Complete guide to the items system - database architecture, functions, and how to use them.

---

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Core Concepts](#core-concepts)
3. [Available Functions](#available-functions)
4. [Where Item Flows Live](#where-item-flows-live)
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

#### 4. **UserItemStatModifier** (Instance additions, table `UserItemStat`)
```prisma
model UserItemStatModifier {
  id         Int
  userItemId Int      // References UserItem
  statType   StatType
  value      Float    // Added on top of the live template stats

  userItem UserItem @relation(fields: [userItemId], references: [id])

  @@map("UserItemStat")
}
```

**Purpose:** Additions unique to one item instance, such as future enchantments. Template and rarity stats are never stored here; they are resolved live (see [Stats System](#stats-system)).

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
  greavesItemId   Int?
  bootsItemId     Int?
  weaponItemId    Int?
  pauldronsItemId Int?
  bracersItemId   Int?
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

Edit the item in the admin item editor (`/admin/items`). Progressions are a CSV
of `statType,baseValue,unlocksAtRarity`:

```
statType,baseValue,unlocksAtRarity
CRITICAL_CHANCE,5,COMMON
ATTACK_SPEED,0.1,MYTHIC
LIFESTEAL,3,DIVINE
```

See `docs/STAT_PROGRESSION_SYSTEM.md`.

---

#### Hands and Required Tools

- `equipTo = weapon` items fit the main hand. They also fit the off hand unless
  `Item.twoHanded` is set (the "Two-handed" checkbox in the admin item form).
- `equipTo = offhand` items (shields) fit the off hand only.
- A two-handed weapon keeps the off hand empty. Equipping one sends the
  off-hand item to the bags, and equipping an off-hand item sends the
  two-handed weapon there; `/api/equipment` rejects both at once.
- Tool slots: `fellingAxe`, `pickaxe`, `fishingRod`, `hoe`. `TOOL_RULES` in
  `src/server/vocations/tools.ts` requires the matching tool to start
  woodcutting, mining or fishing and to plant seeds in the garden.

#### Vocational Tool Efficiencies

Some equipment pieces (felling axes, pickaxes, fishing rods, etc.) boost offline skill actions via **ToolEfficiency** records:

```
model ToolEfficiency {
  id             Int      @id @default(autoincrement())
  itemId         Int
  actionType     VocationalActionType  // WOODCUTTING, MINING, FISHING...
  baseEfficiency Float                 // Percent at COMMON rarity
}
```

- Each entry links a template to a vocation and defines the **base percentage** applied at Common rarity.
- When a `UserItem` is created or its rarity is upgraded, the system copies these efficiencies into the item's stats (`WOODCUTTING_EFFICIENCY`, `MINING_EFFICIENCY`, `FISHING_EFFICIENCY`, etc.), multiplied by the current rarity multiplier.
- Because the stat lives on the `UserItem`, marketplace listings, trades, and transfers always carry the correct upgraded value—selling an enchanted axe sells *that exact item* with its boosted efficiency.
- Non-tool items no longer have to define nullable vocation stats in `ItemStat`/`ItemStatProgression`, keeping the general stat tables clean.

To configure a tool you can either insert rows manually (admin UI/SQL) or create a helper script, for example:

```typescript
await prisma.toolEfficiency.upsert({
  where: {
    itemId_actionType: { itemId: SIMPLE_FELLING_AXE_ID, actionType: "WOODCUTTING" },
  },
  update: { baseEfficiency: 5 }, // 5%
  create: { itemId: SIMPLE_FELLING_AXE_ID, actionType: "WOODCUTTING", baseEfficiency: 5 },
});
```

Repeat for each rarity tier of the tool (Iron Felling Axe at 10%, etc.). When you later allow enchanting to higher rarities, the efficiency scales automatically using the same rarity multipliers that weapons/armor already use.

---

## Available Functions

All inventory writes go through two server modules, so every system stacks,
fills slots and guards against double-spending the same way. Pass the
transaction client (`db: tx`) to commit an item change together with whatever
paid for it.

### Giving Items

#### **grantStackableItemToInventory()** - `src/server/items/grantItem.ts`
```typescript
const grant = await grantStackableItemToInventory({
  db: tx,
  userId,
  itemId,            // Item template ID
  rarity: ItemRarity.RARE,
  quantity: 5,
  unitSize: 1,       // optional: only grant whole units of this size
});
// grant.addedQuantity / grant.remainingQuantity (what did not fit)
// grant.itemChanges: new quantity of every stack touched (for realtime sync)
```
Tops up existing stacks of the same item and rarity first, then opens new
stacks in empty slots. Non-stackable items become one instance per slot.
`getStackCapacity()` answers "how many fit?" with the same filling rules.

#### **createUserItem()** - `src/utils/userItems.ts`
Creates one UserItem instance without placing it in a slot. Used when setting
up a new character; prefer `grantStackableItemToInventory()` everywhere else.

### Taking Items

`src/server/items/consumeItems.ts`:

| Function | Use |
|----------|-----|
| `consumeInventoryItems({ db, userId, items })` | Hand-ins and costs by template, lowest rarity first |
| `removeFromStack({ db, userId, userItemId, quantity })` | Take from one specific stack (eat, learn, sell) |
| `loadInventoryStacks(db, userId)` + `countItems(stacks)` | Read what the player holds per template |
| `takeFromStacks(...)` / `takeFromStack(...)` + `saveInventorySlots(...)` | The same removal on stacks the caller already loaded |

Every removal only writes if the stack still holds what was read, and throws
otherwise, so run it inside the caller's transaction.

### Reading Item Data

#### **fetchUserItemsByIds()** - `src/utils/userItemInventory.ts`
Returns items ready for display: template fields, instance rarity and quantity,
and the current effective stats.

#### **hydrateEffectiveItemStats()** - `src/server/items/effectiveStats.ts`
Resolves live stats for rows loaded with `ITEM_BALANCE_RELATIONS`.

#### **loadEquipmentWithItems()** - `src/utils/inventory.ts`
The character's equipment with each slot's item.

### Equipment Rules

`src/utils/inventoryClient.ts` (safe to import in client components):
`canEquipToSlot()`, `getDisplacedHand()`, `meetsItemLevelRequirement()` and
`getEquipmentValidationError()`, which `POST /api/equipment` uses as the
server-side check. Slot definitions live in `EQUIPMENT_SLOTS`
(`src/utils/itemEquipTo.ts`).

### Creating New Item Templates

- **Admin item editor** (`/admin/items`): one item at a time, with base stats,
  progressions, rarity overrides, tool efficiencies and timed effects.
- **CSV import** on the admin dashboard (`/admin`): export the current items,
  edit the CSV, upload it back.
- **Content packs** (`prisma/content/*` + `scripts/seed*.ts`): items that ship
  with a feature, seeded with `npm run db:seed:<pack>`.

---

## Where Item Flows Live

| Flow | Code |
|------|------|
| Gathering, hunting and dungeon rewards | `src/server/{gathering,hunting,dungeons}/service.ts` |
| Vocation ticks (inputs consumed, output granted) | `src/server/vocations/claim.ts` |
| Garden planting and harvests | `src/server/garden/service.ts` |
| Quest rewards and hand-ins, community projects | `src/server/settlements/quests.ts`, `projects.ts` |
| NPC shop buy and sell | `src/server/settlements/shop.ts` |
| Settlement storage | `src/server/settlements/storage.ts` |
| Player marketplace | `src/app/api/marketplace/*` |
| Eating food, learning recipes | `src/server/food-effects/service.ts`, `src/server/recipes/service.ts` |
| Equipping | `POST /api/equipment` |
| Splitting and merging stacks | `src/utils/userItems.ts` (`splitStack`), `POST /api/inventory/merge-stacks` |

---

## Rarity System

### Configuration

Rarity configs are stored in the `RarityConfig` table and tuned at
`/admin/rarity`. Seed the defaults once with `scripts/initRarities.ts`.

Each rarity has:
- `statMultiplier`: How much stats are multiplied (0.5x - 3.0x)
- `color`: Hex color for UI display
- `upgradeEnabled`, `nextRarity`, `upgradeCost`: reserved for rarity upgrades,
  which no game system offers yet

### Rarity Order

```
WORTHLESS → BROKEN → COMMON → UNCOMMON → RARE → EXQUISITE →
EPIC → ELITE → UNIQUE → LEGENDARY → MYTHIC → DIVINE
```

---

## Stats System

### How Stats are Calculated

Stats are live balance data, resolved every time an item is read
(`resolveEffectiveItemStats` in `src/utils/itemInstanceStats.ts`):

1. The template's base stats (`ItemStat`), scaled by the rarity's `statMultiplier`
2. Stat progressions that unlock at or below the item's rarity (`ItemStatProgression`)
3. Per-rarity overrides (`ItemStatRarityOverride`)
4. Per-instance additions (`UserItemStatModifier`), reserved for systems such
   as enchantments

Nothing template-derived is copied onto a player's item, so editing a template
rebalances every existing copy immediately. No migration is needed.

---

## Best Practices

1. **Store UserItem IDs in slots**, never Item template IDs.
2. **Check ownership and status**: a UserItem must belong to the player and be
   `IN_INVENTORY` before it is used, sold or equipped.
3. **Use the shared grant and consume helpers** instead of writing
   `Inventory.slots` directly, and check `remainingQuantity` for a full bag.
4. **Commit together**: pass the transaction client so the items, gold and XP
   of one action land or fail as one.
5. **Display with `fetchUserItemsByIds()`** so stats and rarity are current.

---

## Troubleshooting

**Items not appearing in inventory?**
- Check you're using UserItem IDs, not Item template IDs
- Check the item is `IN_INVENTORY` and referenced by a slot

**Stats not correct?**
- Check the template's stats, progressions and rarity overrides in `/admin/items`
- Check the rarity's `statMultiplier` in `/admin/rarity`

**Cannot equip item?**
- Check `equipTo` field is set on Item template
- Check the character meets `requiredLevel`
- A two-handed weapon needs an empty off hand

**Inventory full?**
- `grantStackableItemToInventory()` reports what did not fit in `remainingQuantity`
- Capacity is 25 slots plus the character's `CARRYING_CAPACITY`

---

This guide covers the complete items system. For bulk item management via CSV, see [ITEM_MANAGEMENT.md](./ITEM_MANAGEMENT.md).
