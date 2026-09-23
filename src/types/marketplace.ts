import type {
  ItemEquipTo,
  ItemRarity,
  ItemType,
  StatType,
} from "~/generated/prisma/enums";

export interface MarketplaceItemTemplate {
  id: number;
  name: string;
  description?: string | null;
  sprite: string;
  itemType: ItemType | null;
  equipTo: ItemEquipTo | null;
  stackable: boolean;
  maxStackSize: number;
  price: number;
  rarity: ItemRarity;
  minPhysicalDamage: number | null;
  maxPhysicalDamage: number | null;
  minMagicDamage: number | null;
  maxMagicDamage: number | null;
  armor: number | null;
  requiredLevel: number | null;
  quantity?: number;
}

export interface MarketplaceListing {
  id: number;
  userId?: string;
  itemId?: number;
  rarity: ItemRarity;
  quantity: number;
  listedPrice: number | null;
  listedAt: string | Date | null;
  isTradeable?: boolean;
  acquiredAt?: string | Date;
  itemTemplate: MarketplaceItemTemplate;
  stats: {
    id?: number;
    userItemId?: number;
    statType: StatType;
    value: number;
  }[];
  user: { id: string; name: string | null };
}

export interface MarketplaceResponse {
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

export interface MarketplaceGroupedItem {
  itemTemplateId: number;
  itemName: string;
  sprite: string;
  itemType: ItemType | null;
  equipTo: ItemEquipTo | null;
  stackable: boolean;
  rarity: ItemRarity;
  minPrice: number;
  maxPrice: number;
  totalListings: number;
  totalUnits: number;
  highestBid: number | null;
  demandUnits: number;
  volume24h: number;
  value24h: number;
}

export interface MarketplaceGroupedResponse {
  items: MarketplaceGroupedItem[];
  pagination: {
    page: number;
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filterOptions: MarketplaceFilterOptions;
}

export interface MarketplaceFilterOptions {
  /** Item types on sale, each with the sprite of one listed item of that type. */
  itemTypes: { itemType: ItemType; sprite: string }[];
  rarities: ItemRarity[];
}

export interface MarketStatsData {
  itemId: number;
  rarity: ItemRarity;
  activeMarket: {
    lowestAsk: number | null;
    highestBid: number | null;
    spread: number | null;
    sellListings: number;
    sellUnits: number;
    buyOrders: number;
    buyUnits: number;
    buyOrderLevels: { price: number; quantity: number }[];
    executableBuyOrderLevels: { price: number; quantity: number }[];
  };
  sales: {
    averagePrice30d: number | null;
    medianPrice30d: number | null;
    minPrice30d: number | null;
    maxPrice30d: number | null;
    lastPrice: number | null;
    lastSaleAt: string | null;
    completedTransactions30d: number;
    volume24h: number;
    value24h: number;
    volume30d: number;
    value30d: number;
    priceChange7d: number | null;
    history: {
      date: string;
      averagePrice: number | null;
      volume: number;
    }[];
  };
}

export interface MarketBuyOrder {
  id: number;
  itemId: number;
  rarity: ItemRarity;
  quantity: number;
  remainingQuantity: number;
  pricePerItem: number;
  reservedGold: number;
  status: "OPEN" | "FILLED" | "CANCELLED";
  createdAt: string | Date;
  item: MarketplaceItemTemplate;
}

export interface MyListingsResponse {
  sellListings: MarketplaceListing[];
  buyOrders: MarketBuyOrder[];
  summary: {
    sellListingCount: number;
    sellUnits: number;
    sellGross: number;
    sellTax: number;
    sellNet: number;
    buyOrderCount: number;
    buyUnits: number;
    reservedGold: number;
  };
  listings: MarketplaceListing[];
  count: number;
  totalValue: number;
}

export interface SellableItem extends Omit<MarketplaceListing, "user"> {
  slotIndex: number;
}
