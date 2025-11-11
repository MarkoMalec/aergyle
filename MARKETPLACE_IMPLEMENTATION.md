# Marketplace System - Complete Implementation

## Overview
A fully functional marketplace system where players can list, browse, buy, and cancel item listings. Items have status tracking and ownership transfer.

## Features Implemented

### 1. Backend API Endpoints

#### `/api/marketplace` (GET)
- Browse all marketplace listings with filters
- Query params: `equipTo`, `rarity`, `search`, `minPrice`, `maxPrice`, `page`, `limit`, `sortBy`, `sortOrder`
- Returns listings with full item details, stats, and seller info
- Pagination support

#### `/api/marketplace/list` (POST)
- List an item on the marketplace
- Validates: ownership, item is IN_INVENTORY, item is tradeable
- Sets status to LISTED, removes from inventory
- Body: `{ userId, userItemId, price }`

#### `/api/marketplace/buy` (POST)
- Purchase a marketplace item
- Transfers ownership (changes userId)
- Moves item to buyer's inventory (status: IN_INVENTORY)
- Validates: item is LISTED, buyer has space
- Body: `{ buyerId, userItemId }`
- TODO: Add currency (gold) transaction

#### `/api/marketplace/cancel` (DELETE)
- Cancel own marketplace listing
- Returns item to seller's inventory
- Validates: ownership, inventory space
- Body: `{ userId, userItemId }`

#### `/api/marketplace/my-listings` (GET)
- Get player's active listings
- Returns count, total value, and listing details
- Query param: `userId`

### 2. Frontend Pages

#### `/marketplace/page.tsx`
- Main marketplace browser
- React Query for data fetching
- Server-side pagination (50 items per page)
- Buy item functionality with mutation
- Loading and error states
- Real-time query invalidation after purchase

#### `/marketplace/my-listings/page.tsx`
- View all active listings for logged-in player
- Summary cards: Active Listings, Total Value, Average Price
- Cancel listing functionality with confirmation
- Full table with item details, rarity badges, prices, and dates

### 3. Components

#### `MarketplaceDataTable`
- TanStack Table v8 with sorting
- Client-side filtering (search, equipTo, rarity, price range)
- Columns: Image, Name, Rarity, Type, Seller, Price, Buy button
- Loading skeleton support
- Responsive design

#### `ItemFilters`
- Price range filter popover
- Min/max price inputs
- Visual indicator when filters are active

#### `DraggableItem` (Updated)
- Added "List on Marketplace" button for inventory items
- Price input form in popover
- React Query mutation for listing
- Loading states and error handling

### 4. Type Definitions

#### `MarketplaceListing`
```typescript
interface MarketplaceListing extends PrismaUserItem {
  itemTemplate: { /* full item details */ };
  stats: { /* item stats */ }[];
  user: { /* seller info */ };
}
```

#### `MarketplaceResponse`
```typescript
interface MarketplaceResponse {
  listings: MarketplaceListing[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

#### `MyListingsResponse`
```typescript
interface MyListingsResponse {
  listings: MarketplaceListing[];
  count: number;
  totalValue: number;
}
```

## ItemStatus Enum
```prisma
enum ItemStatus {
  IN_INVENTORY  // Visible in player's inventory
  EQUIPPED      // Currently equipped on character
  LISTED        // On marketplace, not in inventory
  SOLD          // Transaction history (not implemented yet)
  DELETED       // Item destroyed
}
```

## Database Schema Changes
- Added `status` field to UserItem (ItemStatus enum, default: IN_INVENTORY)
- Added `listedPrice` (Float?, nullable)
- Added `listedAt` (DateTime?, nullable)
- Removed deprecated `isEquipped` field

## User Flow

### Listing an Item
1. Player opens inventory
2. Clicks on item to open popover
3. Clicks "List on Marketplace"
4. Enters price in gold
5. Confirms listing
6. Item disappears from inventory (status: LISTED)

### Buying an Item
1. Player navigates to `/marketplace`
2. Browses listings (can filter by type, rarity, price, search)
3. Clicks "Buy" on desired item
4. Item ownership transfers (userId changes)
5. Item appears in buyer's inventory (status: IN_INVENTORY)
6. Marketplace refreshes to remove sold item

### Canceling a Listing
1. Player navigates to `/marketplace/my-listings`
2. Views all active listings
3. Clicks "Cancel" on a listing
4. Confirms cancellation
5. Item returns to inventory (status: IN_INVENTORY)

## React Query Integration
- `QueryClient` already configured in `providers.tsx`
- Mutations automatically invalidate relevant queries:
  - Buying invalidates: `marketplace`, `inventory`
  - Listing invalidates: `marketplace`, `inventory`
  - Canceling invalidates: `marketplace`, `inventory`, `my-listings`
- Stale time: 10-30 seconds for marketplace data

## Next Steps (TODOs)

### High Priority
1. **Currency System**
   - Add `gold` field to User model
   - Deduct gold from buyer in `/api/marketplace/buy`
   - Add gold to seller in `/api/marketplace/buy`
   - Validate buyer has enough gold before purchase

2. **Transaction History**
   - Keep SOLD items in database with transaction metadata
   - Create Transaction model linking buyer, seller, item, price, timestamp
   - `/api/marketplace/history` endpoint
   - Transaction history page

### Medium Priority
3. **Search & Filters Enhancement**
   - Move filters from client-side to server-side (API params)
   - Add more filter options: min/max level, damage range, armor range
   - Save filter preferences in localStorage

4. **UI Improvements**
   - Add item tooltips on hover (show full stats)
   - Better mobile responsive design
   - Add sorting options in UI (by price, rarity, date)
   - Add item comparison feature

5. **Notifications**
   - Replace alerts with proper toast notifications
   - Success/error notifications with undo option
   - "Your item sold!" notification system

### Low Priority
6. **Advanced Features**
   - Auction system (bidding)
   - Buy orders (players can request items at specific prices)
   - Marketplace tax/fee system
   - Trading between players directly
   - Item bundles (sell multiple items together)

## Files Modified/Created

### Created
- `/src/app/(game)/marketplace/page.tsx` - Main marketplace browser
- `/src/app/(game)/marketplace/my-listings/page.tsx` - Player's listings
- `/src/types/marketplace.ts` - TypeScript interfaces
- `/src/app/api/marketplace/route.ts` - Browse listings
- `/src/app/api/marketplace/list/route.ts` - List item
- `/src/app/api/marketplace/buy/route.ts` - Purchase item
- `/src/app/api/marketplace/cancel/route.ts` - Cancel listing
- `/src/app/api/marketplace/my-listings/route.ts` - Get player listings

### Modified
- `/src/components/dnd/DraggableItem.tsx` - Added marketplace listing button
- `/src/components/game/marketplace/marketplaceTable.tsx` - Adapted to API types
- `/src/utils/ui/rarity-badge.tsx` - Updated for ItemRarity enum
- `/prisma/schema.prisma` - Added ItemStatus, marketplace fields

## Testing Checklist
- [ ] List an item from inventory
- [ ] Browse marketplace and see listed items
- [ ] Filter by type, rarity, price range, search
- [ ] Buy an item (should appear in inventory)
- [ ] Cancel a listing (should return to inventory)
- [ ] View my-listings page
- [ ] Pagination works correctly
- [ ] Can't buy own listings
- [ ] Can't list equipped items
- [ ] Can't list items without inventory space for return
