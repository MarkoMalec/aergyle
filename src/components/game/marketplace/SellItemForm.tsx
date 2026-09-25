"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpFromLine, BadgeDollarSign } from "lucide-react";
import toast from "react-hot-toast";
import type { ItemRarity } from "~/generated/prisma/enums";
import {
  MARKET_TAX_PERCENT,
  calculateMarketSale,
  estimateSellNow,
  fetchMarketStats,
} from "~/lib/marketplace";
import {
  inventoryQueryKeys,
  marketplaceQueryKeys,
  userQueryKeys,
} from "~/lib/query-keys";
import type { MarketStatsData } from "~/types/marketplace";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { RarityBadge } from "~/utils/ui/rarity-badge";

export interface MarketSellItem {
  userItemId: number;
  itemId: number;
  itemName: string;
  sprite: string;
  rarity: ItemRarity;
  maxQuantity: number;
  stackable: boolean;
}

function apiError(value: unknown) {
  if (typeof value === "object" && value !== null) {
    const message = (value as { error?: unknown }).error;
    if (typeof message === "string") return message;
  }
  return "The market could not complete that action";
}

export function SellItemForm({
  item,
  onCompleted,
  showItemHeader = true,
}: {
  item: MarketSellItem;
  onCompleted?: () => void;
  showItemHeader?: boolean;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"SELL_NOW" | "LIST">("LIST");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const statsQuery = useQuery<MarketStatsData>({
    queryKey: marketplaceQueryKeys.stats(item.itemId, item.rarity),
    queryFn: () => fetchMarketStats(item.itemId, item.rarity),
    staleTime: 30_000,
  });

  useEffect(() => {
    setMode("LIST");
    setQuantity(1);
    setPrice("");
  }, [item.userItemId]);

  useEffect(() => {
    if (price || !statsQuery.data) return;
    const suggestion =
      statsQuery.data.activeMarket.lowestAsk ??
      statsQuery.data.sales.medianPrice30d;
    if (suggestion != null) setPrice(suggestion.toFixed(2));
  }, [price, statsQuery.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: marketplaceQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() }),
    ]);
    onCompleted?.();
  };

  const listMutation = useMutation({
    mutationFn: async () => {
      const unitPrice = Number(price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error("Enter a valid unit price");
      }
      const response = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userItemId: item.userItemId,
          quantity,
          price: unitPrice,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(body));
      return body as { message: string };
    },
    onSuccess: async (data) => {
      toast.success(data.message);
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sellNowMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/marketplace/sell-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userItemId: item.userItemId, quantity }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(body));
      return body as { message: string; net: number };
    },
    onSuccess: async (data) => {
      toast.success(
        `${data.message} · received ${data.net.toLocaleString()} gold`,
      );
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unitPrice = Number(price) || 0;
  const listingSale = calculateMarketSale(unitPrice, quantity);
  const levels = useMemo(
    () => statsQuery.data?.activeMarket.executableBuyOrderLevels ?? [],
    [statsQuery.data?.activeMarket.executableBuyOrderLevels],
  );
  const immediateSale = useMemo(
    () => estimateSellNow(levels, quantity),
    [levels, quantity],
  );
  const median = statsQuery.data?.sales.medianPrice30d ?? null;
  const lowestAsk = statsQuery.data?.activeMarket.lowestAsk ?? null;
  const highestBid = levels[0]?.price ?? null;
  const priceWarning =
    mode === "LIST" &&
    unitPrice > 0 &&
    highestBid != null &&
    unitPrice <= highestBid
      ? `A buyer already offers ${highestBid.toLocaleString()} gold. Use Sell now for an immediate fill, or ask above that price.`
      : mode === "LIST" &&
          unitPrice > 0 &&
          lowestAsk != null &&
          unitPrice > lowestAsk * 1.25
        ? `This is ${Math.round((unitPrice / lowestAsk - 1) * 100)}% above the current lowest ask and may sell slowly.`
        : mode === "LIST" &&
            unitPrice > 0 &&
            median != null &&
            unitPrice < median * 0.5
          ? "This is far below the 30-day median sale price. Check the value before listing."
          : null;

  return (
    <div className="space-y-5">
      {showItemHeader && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-inset p-3">
          <ItemArtwork
            src={item.sprite}
            name={item.itemName}
            rarity={item.rarity}
            size={56}
            itemId={item.itemId}
          />
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{item.itemName}</h2>
            <div className="mt-1 flex items-center gap-2">
              <RarityBadge rarity={item.rarity} />
              <span className="text-xs text-muted-foreground">
                {item.maxQuantity.toLocaleString()} owned
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-inset p-1">
        <button
          disabled={!item.stackable}
          className={`rounded px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${mode === "SELL_NOW" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setMode("SELL_NOW")}
        >
          Sell now
        </button>
        <button
          className={`rounded px-3 py-2 text-sm font-semibold ${mode === "LIST" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={() => setMode("LIST")}
        >
          Create listing
        </button>
      </div>

      {!item.stackable && (
        <p className="rounded-md border border-border bg-surface-inset p-3 text-xs text-muted-foreground">
          Rolled equipment is sold as an exact listing so buyers can inspect its
          stats.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`sell-quantity-${item.userItemId}`}
            className="text-sm font-medium"
          >
            Quantity
          </label>
          <div className="flex gap-1">
            {[1, 10, 100].map((amount) => (
              <Button
                key={amount}
                size="sm"
                variant="outline"
                onClick={() => setQuantity(Math.min(amount, item.maxQuantity))}
                disabled={amount > item.maxQuantity}
              >
                {amount}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setQuantity(item.maxQuantity)}
            >
              All
            </Button>
          </div>
        </div>
        <Input
          id={`sell-quantity-${item.userItemId}`}
          type="number"
          min={1}
          max={item.maxQuantity}
          value={quantity}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            setQuantity(
              Math.min(
                item.maxQuantity,
                Math.max(1, Number.isFinite(parsed) ? parsed : 1),
              ),
            );
          }}
        />
      </div>

      {mode === "LIST" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`sell-price-${item.userItemId}`}
              className="text-sm font-medium"
            >
              Price per item
            </label>
            {lowestAsk != null && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setPrice(lowestAsk.toFixed(2))}
              >
                Use lowest ask: {lowestAsk.toLocaleString()}
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              id={`sell-price-${item.userItemId}`}
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Enter a unit price"
              className="pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              gold
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>Lowest ask: {lowestAsk?.toLocaleString() ?? "—"}</span>
            <span>
              Median completed sale (30d): {median?.toLocaleString() ?? "—"}
            </span>
            <span>
              Highest executable bid: {highestBid?.toLocaleString() ?? "—"}
            </span>
          </div>
          {priceWarning && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
              {priceWarning}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-border bg-surface-inset p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current highest bid</span>
            <span className="font-semibold text-success">
              {levels[0]
                ? `${levels[0].price.toLocaleString()} gold`
                : "No bids"}
            </span>
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-muted-foreground">Can sell immediately</span>
            <span className="font-semibold">
              {immediateSale.filledQuantity} / {quantity}
            </span>
          </div>
          {immediateSale.unfilledQuantity > 0 &&
            immediateSale.filledQuantity > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {immediateSale.unfilledQuantity} will remain in your inventory
                because current bids do not cover them.
              </p>
            )}
        </div>
      )}

      <div className="rounded-md bg-surface-inset p-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Gross sale</span>
          <span className="tabular-nums">
            {(mode === "LIST"
              ? listingSale.gross
              : immediateSale.gross
            ).toLocaleString()}{" "}
            gold
          </span>
        </div>
        <div className="mt-1 flex justify-between text-muted-foreground">
          <span>Exchange tax ({MARKET_TAX_PERCENT}%)</span>
          <span className="tabular-nums text-danger">
            −
            {(mode === "LIST"
              ? listingSale.tax
              : immediateSale.tax
            ).toLocaleString()}{" "}
            gold
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
          <span>You receive</span>
          <span className="inline-flex items-center gap-1 tabular-nums text-success">
            <CoinsIcon size={16} />
            {(mode === "LIST"
              ? listingSale.net
              : immediateSale.net
            ).toLocaleString()}
          </span>
        </div>
      </div>

      <Button
        className="w-full"
        disabled={
          listMutation.isPending ||
          sellNowMutation.isPending ||
          (mode === "LIST"
            ? unitPrice <= 0
            : immediateSale.filledQuantity === 0)
        }
        onClick={() =>
          mode === "LIST" ? listMutation.mutate() : sellNowMutation.mutate()
        }
      >
        {mode === "LIST" ? (
          <ArrowUpFromLine className="h-4 w-4" />
        ) : (
          <BadgeDollarSign className="h-4 w-4" />
        )}
        {listMutation.isPending || sellNowMutation.isPending
          ? "Working…"
          : mode === "LIST"
            ? `Create listing · ${quantity} at ${unitPrice.toLocaleString()} each`
            : immediateSale.filledQuantity > 0
              ? `Sell ${immediateSale.filledQuantity} now · receive ${immediateSale.net.toLocaleString()}`
              : "No matching buy orders"}
      </Button>
    </div>
  );
}
