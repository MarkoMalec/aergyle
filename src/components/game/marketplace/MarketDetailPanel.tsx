"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, BarChart3, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import {
  inventoryQueryKeys,
  marketplaceQueryKeys,
  userQueryKeys,
} from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import type {
  MarketStatsData,
  MarketplaceGroupedItem,
  MarketplaceListing,
} from "~/types/marketplace";
import { rarityStyle } from "~/utils/rarity-colors";
import { RarityBadge } from "~/utils/ui/rarity-badge";
import { fetchMarketStats } from "~/lib/marketplace";
import { BuyConfirmDialog, QuantityField } from "./BuyConfirmDialog";

type ActionMode = "BUY_NOW" | "BUY_ORDER";
type ViewMode = "SIMPLE" | "TRADER";

function errorMessage(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return "The market could not complete that action";
}

async function fetchListings(market: MarketplaceGroupedItem) {
  const params = new URLSearchParams({
    limit: "50",
    rarity: market.rarity,
  });
  const response = await fetch(
    `/api/marketplace/listings/${market.itemTemplateId}?${params.toString()}`,
  );
  if (!response.ok) throw new Error("Could not load active listings");
  return response.json() as Promise<{ listings: MarketplaceListing[] }>;
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-[10px] bg-surface-inset px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export function MarketDetailPanel({
  market,
  currentUserId,
}: {
  market: MarketplaceGroupedItem;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const { colors } = useRarityColors();
  const [actionMode, setActionMode] = useState<ActionMode>("BUY_NOW");
  const [viewMode, setViewMode] = useState<ViewMode>("SIMPLE");
  const [selectedListingId, setSelectedListingId] = useState<number | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listingsQuery = useQuery({
    queryKey: marketplaceQueryKeys.detail(market.itemTemplateId, market.rarity),
    queryFn: () => fetchListings(market),
    staleTime: 10_000,
  });
  const statsQuery = useQuery<MarketStatsData>({
    queryKey: marketplaceQueryKeys.stats(market.itemTemplateId, market.rarity),
    queryFn: () => fetchMarketStats(market.itemTemplateId, market.rarity),
    staleTime: 30_000,
  });

  const listings = useMemo(
    () => listingsQuery.data?.listings ?? [],
    [listingsQuery.data?.listings],
  );
  const purchasableListings = useMemo(
    () => listings.filter((listing) => listing.user.id !== currentUserId),
    [currentUserId, listings],
  );
  const selectedListing =
    purchasableListings.find((listing) => listing.id === selectedListingId) ??
    purchasableListings[0] ??
    null;

  useEffect(() => {
    setActionMode("BUY_NOW");
    setViewMode("SIMPLE");
    setSelectedListingId(null);
    setQuantity(1);
    setOrderPrice("");
    setConfirmOpen(false);
  }, [market.itemTemplateId, market.rarity]);

  useEffect(() => {
    if (selectedListing && selectedListing.id !== selectedListingId) {
      setSelectedListingId(selectedListing.id);
    }
  }, [selectedListing, selectedListingId]);

  useEffect(() => {
    const stats = statsQuery.data;
    if (!stats || orderPrice) return;
    const suggested = stats.activeMarket.highestBid
      ? stats.activeMarket.highestBid + 0.01
      : stats.activeMarket.lowestAsk
        ? Math.max(0.01, stats.activeMarket.lowestAsk * 0.8)
        : stats.sales.medianPrice30d ?? 1;
    setOrderPrice(suggested.toFixed(2));
  }, [orderPrice, statsQuery.data]);

  useEffect(() => {
    if (selectedListing) {
      setQuantity((current) =>
        Math.min(Math.max(1, current), selectedListing.quantity),
      );
    }
  }, [selectedListing]);

  const refreshMarket = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: marketplaceQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() }),
      queryClient.invalidateQueries({
        queryKey: marketplaceQueryKeys.myListings(currentUserId),
      }),
    ]);
  };

  const buyMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Sign in to buy items");
      if (!selectedListing) throw new Error("Choose an active listing");
      const response = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userItemId: selectedListing.id, quantity }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(body));
      return body as { message: string };
    },
    onSuccess: async (data) => {
      toast.success(data.message);
      setConfirmOpen(false);
      setQuantity(1);
      await refreshMarket();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const buyOrderMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Sign in to place a buy order");
      const pricePerItem = Number(orderPrice);
      if (!Number.isFinite(pricePerItem) || pricePerItem <= 0) {
        throw new Error("Enter a valid bid price");
      }
      const response = await fetch("/api/marketplace/buy-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: market.itemTemplateId,
          rarity: market.rarity,
          quantity,
          pricePerItem,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorMessage(body));
      return body as { message: string };
    },
    onSuccess: async (data) => {
      toast.success(data.message);
      setConfirmOpen(false);
      setQuantity(1);
      await refreshMarket();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const maxQuantity =
    actionMode === "BUY_NOW" ? selectedListing?.quantity ?? 1 : 100_000;
  const unitPrice =
    actionMode === "BUY_NOW"
      ? selectedListing?.listedPrice ?? 0
      : Number(orderPrice) || 0;
  const total = unitPrice * quantity;
  const stats = statsQuery.data;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="game-market-detail-header flex items-start gap-3 p-4 pb-2"
        style={rarityStyle(market.rarity, colors[market.rarity])}
      >
        <ItemArtwork
          src={market.sprite}
          name={market.itemName}
          rarity={market.rarity}
          size={62}
          itemId={market.itemTemplateId}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="game-section-title truncate">{market.itemName}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RarityBadge
                  rarity={market.rarity}
                  className="border-0 px-1.5 py-0.5 text-[11px]"
                />
                <span className="text-xs capitalize text-muted-foreground">
                  {(market.itemType ?? market.equipTo ?? "item")
                    .toLowerCase()
                    .replaceAll("_", " ")}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex rounded-md bg-surface-inset p-1 text-xs">
            <button
              className={`flex-1 rounded px-2 py-1.5 ${viewMode === "SIMPLE" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              onClick={() => setViewMode("SIMPLE")}
            >
              Simple
            </button>
            <button
              className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 ${viewMode === "TRADER" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              onClick={() => setViewMode("TRADER")}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Trader
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {statsQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : stats ? (
          <dl className="grid grid-cols-2 gap-2">
            <Metric
              label="Lowest ask"
              value={
                stats.activeMarket.lowestAsk == null ? (
                  "—"
                ) : (
                  <>
                    <CoinsIcon size={14} />{" "}
                    {stats.activeMarket.lowestAsk.toLocaleString()}
                  </>
                )
              }
            />
            <Metric
              label="Highest bid"
              value={
                stats.activeMarket.highestBid == null ? (
                  "—"
                ) : (
                  <>
                    <CoinsIcon size={14} />{" "}
                    {stats.activeMarket.highestBid.toLocaleString()}
                  </>
                )
              }
            />
            {viewMode === "TRADER" && (
              <>
                <Metric
                  label="Median sale · 30d"
                  value={
                    stats.sales.medianPrice30d?.toLocaleString() ?? "No sales"
                  }
                />
                <Metric
                  label="Completed volume · 24h"
                  value={`${stats.sales.volume24h.toLocaleString()} units`}
                />
              </>
            )}
          </dl>
        ) : null}

        {viewMode === "TRADER" && stats && (
          <div className="rounded-[10px] bg-surface-inset p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide">
                Bid ladder
              </span>
              <span className="text-muted-foreground">
                {stats.activeMarket.buyUnits.toLocaleString()} wanted
              </span>
            </div>
            <div className="mt-2 space-y-1 text-xs tabular-nums">
              {stats.activeMarket.buyOrderLevels.slice(0, 5).map((level) => (
                <div key={level.price} className="flex justify-between">
                  <span className="text-success">
                    {level.price.toLocaleString()} gold
                  </span>
                  <span className="text-muted-foreground">
                    {level.quantity} units
                  </span>
                </div>
              ))}
              {stats.activeMarket.buyOrderLevels.length === 0 && (
                <p className="text-muted-foreground">No open buy orders.</p>
              )}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {stats.sales.completedTransactions30d > 0
                ? `${stats.sales.completedTransactions30d} completed trades in 30 days${stats.sales.priceChange7d == null ? "" : ` · ${stats.sales.priceChange7d > 0 ? "+" : ""}${stats.sales.priceChange7d}% over 7 days`}`
                : "No completed sales in the last 30 days. Active offers are not counted as sales."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-inset p-1">
          <button
            className={`rounded px-3 py-2 text-sm font-semibold ${actionMode === "BUY_NOW" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => {
              setActionMode("BUY_NOW");
              setQuantity(1);
            }}
          >
            Buy now
          </button>
          <button
            disabled={!market.stackable}
            className={`rounded px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${actionMode === "BUY_ORDER" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => {
              setActionMode("BUY_ORDER");
              setQuantity(1);
            }}
          >
            Buy order
          </button>
        </div>

        {actionMode === "BUY_NOW" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide">
                Exact offers
              </h3>
              <span className="text-xs text-muted-foreground">
                {listings.length} listing{listings.length === 1 ? "" : "s"}
              </span>
            </div>
            {listingsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : listings.length > 0 ? (
              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                {listings.map((listing) => {
                  const own = listing.user.id === currentUserId;
                  const selected = listing.id === selectedListing?.id;
                  return (
                    <button
                      key={listing.id}
                      disabled={own}
                      onClick={() => {
                        setSelectedListingId(listing.id);
                        setQuantity(1);
                      }}
                      className={cn(
                        "w-full rounded-[10px] px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        selected
                          ? "bg-sidebar-accent"
                          : "bg-surface-inset hover:bg-secondary/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold tabular-nums text-currency">
                          <CoinsIcon size={14} />{" "}
                          {listing.listedPrice?.toLocaleString()} each
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {listing.quantity} available
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {own
                            ? "Your listing"
                            : `Seller: ${listing.user.name ?? "Wayfarer"}`}
                        </span>
                        {listing.stats.length > 0 && (
                          <span>{listing.stats.length} effective stats</span>
                        )}
                      </div>
                      {selected && listing.stats.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {listing.stats.map((stat) => (
                            <span
                              key={stat.statType}
                              className="rounded bg-background px-1.5 py-1 text-[10px]"
                            >
                              {stat.statType.replaceAll("_", " ")}{" "}
                              {stat.value > 0 ? "+" : ""}
                              {stat.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-[10px] bg-surface-inset p-3 text-sm text-muted-foreground">
                No active offers remain for this rarity.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label
              htmlFor="buy-order-price"
              className="text-xs font-semibold uppercase tracking-wide"
            >
              Your price per item
            </label>
            <div className="relative">
              <Input
                id="buy-order-price"
                type="number"
                min="0.01"
                step="0.01"
                value={orderPrice}
                onChange={(event) => setOrderPrice(event.target.value)}
                className="border-0 pr-16 shadow-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                gold
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Gold is reserved while the order is open. Higher bids fill first;
              equal bids fill oldest first. If your inventory cannot receive a
              fill, the unfilled reserve is returned.
            </p>
          </div>
        )}

        {actionMode === "BUY_NOW" && !selectedListing ? (
          <p className="rounded-[10px] bg-surface-inset p-3 text-sm text-muted-foreground">
            {purchasableListings.length === 0 && listings.length > 0
              ? "Only your own offer is available, so there is nothing here you can buy."
              : "There is no offer you can buy right now."}
            {market.stackable
              ? " You can still place a buy order at your preferred price."
              : " Check back when another wayfarer lists one."}
          </p>
        ) : (
          <div className="space-y-2 pt-2">
            <QuantityField
              value={quantity}
              max={maxQuantity}
              allowAll={actionMode === "BUY_NOW"}
              onChange={setQuantity}
            />
            <div className="rounded-[10px] bg-surface-inset p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {quantity} × {unitPrice.toLocaleString()} gold
                </span>
                <span>
                  {total.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between font-semibold">
                <span>
                  {actionMode === "BUY_NOW" ? "You pay" : "Gold reserved"}
                </span>
                <span className="inline-flex items-center gap-1 text-currency">
                  <CoinsIcon size={16} />{" "}
                  {total.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={
                unitPrice <= 0 ||
                (actionMode === "BUY_NOW" && !selectedListing) ||
                buyMutation.isPending ||
                buyOrderMutation.isPending
              }
              onClick={() => setConfirmOpen(true)}
            >
              {actionMode === "BUY_NOW" ? (
                <ShoppingCart className="h-4 w-4" />
              ) : (
                <ArrowDownToLine className="h-4 w-4" />
              )}
              {buyMutation.isPending || buyOrderMutation.isPending
                ? "Working…"
                : actionMode === "BUY_NOW"
                  ? `Buy ${quantity} now · ${total.toLocaleString()} gold`
                  : `Place order · reserve ${total.toLocaleString()} gold`}
            </Button>
          </div>
        )}
      </div>

      <BuyConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        market={market}
        listing={actionMode === "BUY_NOW" ? selectedListing : null}
        quantity={quantity}
        maxQuantity={maxQuantity}
        onQuantityChange={setQuantity}
        unitPrice={unitPrice}
        isPending={buyMutation.isPending || buyOrderMutation.isPending}
        onConfirm={() =>
          actionMode === "BUY_NOW"
            ? buyMutation.mutate()
            : buyOrderMutation.mutate()
        }
      />
    </div>
  );
}
