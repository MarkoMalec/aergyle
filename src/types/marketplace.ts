import { ItemRarity, StatType, UserItem as PrismaUserItem } from "@prisma/client";

// Marketplace listing type with all relationships
export interface MarketplaceListing extends PrismaUserItem {
  itemTemplate: {
    id: number;
    name: string;
    sprite: string;
    equipTo: string | null;
    price: number;
    rarity: ItemRarity;
    minPhysicalDamage: number | null;
    maxPhysicalDamage: number | null;
    minMagicDamage: number | null;
    maxMagicDamage: number | null;
    armor: number | null;
    requiredLevel: number | null;
  };
  stats: {
    id: number;
    userItemId: number;
    statType: StatType;
    value: number;
  }[];
  user: {
    id: string;
    name: string | null;
  };
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

export interface MyListingsResponse {
  listings: MarketplaceListing[];
  count: number;
  totalValue: number;
}
