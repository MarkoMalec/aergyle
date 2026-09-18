"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import type { ItemRarity } from "~/generated/prisma/enums";
import { marketplaceQueryKeys } from "~/lib/query-keys";
import type { MarketStatsData } from "~/types/marketplace";
import { resolveRarityTextColor } from "~/utils/rarity-colors";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";

interface MarketStatsProps {
  itemId: number;
  itemName: string;
  sprite: string;
  rarity: ItemRarity;
  className?: string;
}

export async function fetchMarketStats(itemId: number, rarity: ItemRarity) {
  const response = await fetch(
    `/api/marketplace/stats?itemId=${itemId}&rarity=${rarity}`,
  );
  if (!response.ok) throw new Error("Failed to fetch market metrics");
  return response.json() as Promise<MarketStatsData>;
}

function GoldValue({ value }: { value: number | null }) {
  return value == null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <CoinsIcon size={14} /> {value.toLocaleString()}
    </span>
  );
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
    queryFn: () => fetchMarketStats(itemId, rarity),
    staleTime: 30_000,
  });
  const { colors } = useRarityColors();

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">No market data available.</p>
    );
  }

  const change = data.sales.priceChange7d;
  return (
    <section
      className={`overflow-hidden rounded-lg bg-surface-inset ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Image src={sprite} alt="" width={28} height={28} />
        <div className="min-w-0">
          <h3
            className="truncate font-semibold"
            style={{ color: resolveRarityTextColor(rarity, colors[rarity]) }}
          >
            {itemName}
          </h3>
          <p className="text-xs text-muted-foreground">
            {rarity.toLowerCase()} market
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-border text-sm">
        <div className="bg-surface-inset p-3">
          <dt className="text-xs text-muted-foreground">Lowest ask</dt>
          <dd className="mt-1 font-medium">
            <GoldValue value={data.activeMarket.lowestAsk} />
          </dd>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {data.activeMarket.sellUnits.toLocaleString()} units for sale
          </p>
        </div>
        <div className="bg-surface-inset p-3">
          <dt className="text-xs text-muted-foreground">Highest bid</dt>
          <dd className="mt-1 font-medium">
            <GoldValue value={data.activeMarket.highestBid} />
          </dd>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {data.activeMarket.buyUnits.toLocaleString()} units wanted
          </p>
        </div>
        <div className="bg-surface-inset p-3">
          <dt className="flex items-center gap-1 text-xs text-muted-foreground">
            Median sale{" "}
            <Badge variant="outline" className="px-1 py-0 text-[9px]">
              30d
            </Badge>
          </dt>
          <dd className="mt-1 font-medium">
            <GoldValue value={data.sales.medianPrice30d} />
          </dd>
        </div>
        <div className="bg-surface-inset p-3">
          <dt className="text-xs text-muted-foreground">Volume (24h)</dt>
          <dd className="mt-1 font-medium tabular-nums">
            {data.sales.volume24h.toLocaleString()} units
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3 border-t border-border p-3 text-xs">
        <span className="text-muted-foreground">
          {data.sales.completedTransactions30d > 0
            ? `${data.sales.completedTransactions30d} completed trades in 30 days`
            : "No completed sales in the last 30 days"}
        </span>
        {change != null && (
          <span
            className={
              change > 0
                ? "text-success"
                : change < 0
                  ? "text-danger"
                  : "text-muted-foreground"
            }
          >
            {change > 0 ? "+" : ""}
            {change.toFixed(1)}% 7d
          </span>
        )}
      </div>
    </section>
  );
}
