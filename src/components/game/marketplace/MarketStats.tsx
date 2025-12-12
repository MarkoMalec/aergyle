"use client";

import { useQuery } from "@tanstack/react-query";
import { ItemRarity } from "@prisma/client";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Skeleton } from "~/components/ui/skeleton";
import { marketplaceQueryKeys } from "~/lib/query-keys";
import Image from "next/image";
import { Badge } from "~/components/ui/badge";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { getRarityTailwindClass } from "~/utils/rarity-colors";

interface MarketStatsProps {
  itemId: number;
  itemName: string;
  sprite: string;
  rarity: ItemRarity;
  className?: string;
}

interface MarketStatsData {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  totalListings: number;
}

export function MarketStats({
  itemId,
  itemName,
  sprite,
  rarity,
  className = "",
}: MarketStatsProps) {
  const { data, isLoading } = useQuery({
    queryKey: marketplaceQueryKeys.stats(itemId, rarity),
    queryFn: async () => {
      const response = await fetch(
        `/api/marketplace/stats?itemId=${itemId}&rarity=${rarity}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch market stats");
      }
      return response.json() as Promise<MarketStatsData>;
    },
    staleTime: 60000, // Cache for 1 minute
  });

  const { colors } = useRarityColors();
  const hexColor = colors[rarity];
  const textColorClass = getRarityTailwindClass(rarity, hexColor, "text");

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`text-sm text-gray-400 ${className}`}>
        No market data available
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 rounded-lg  bg-gray-900/40 text-sm ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-gray-700 p-3">
        <Image src={sprite} alt={itemName} width={28} height={28} />
        <h3 className={`font-semibold ${textColorClass}`}>{itemName}</h3>
      </div>
      <div className="space-y-2 p-2">
        <div className="flex items-center justify-between">
          <div className="text-gray-400">
            Average Price{" "}
            <Badge className="border-gray-500 bg-gray-800">30d</Badge>
          </div>
          <span className="flex items-center gap-1 font-medium text-white">
            <CoinsIcon size={14} />
            {data.averagePrice > 0 ? data.averagePrice.toFixed(2) : "N/A"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Price Range</span>
          <span className="flex items-center gap-1 font-medium text-white">
            <CoinsIcon size={14} />
            {data.minPrice > 0 && data.maxPrice > 0
              ? `${data.minPrice.toFixed(2)} - ${data.maxPrice.toFixed(2)}`
              : "N/A"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Items on Market</span>
          <span className="font-medium text-white">{data.totalListings}</span>
        </div>
      </div>
    </div>
  );
}
