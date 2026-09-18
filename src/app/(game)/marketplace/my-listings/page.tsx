"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { MarketplaceNav } from "~/components/game/marketplace/MarketplaceNav";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import PageHeading from "~/components/game/ui/PageHeading";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { calculateMarketSale } from "~/lib/marketplace";
import {
  inventoryQueryKeys,
  marketplaceQueryKeys,
  userQueryKeys,
} from "~/lib/query-keys";
import type { MyListingsResponse } from "~/types/marketplace";
import { RarityBadge } from "~/utils/ui/rarity-badge";

function apiError(body: unknown) {
  if (typeof body === "object" && body !== null) {
    const value = body as { error?: unknown; message?: unknown };
    if (typeof value.error === "string") return value.error;
    if (typeof value.message === "string") return value.message;
  }
  return "Could not update the order";
}

export default function MyListingsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery<MyListingsResponse>({
    queryKey: marketplaceQueryKeys.myListings(session?.user?.id),
    queryFn: async () => {
      const response = await fetch("/api/marketplace/my-listings");
      if (!response.ok) throw new Error("Could not load your market orders");
      return response.json() as Promise<MyListingsResponse>;
    },
    enabled: Boolean(session?.user?.id),
    staleTime: 10_000,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: marketplaceQueryKeys.myListings(session?.user?.id),
      }),
      queryClient.invalidateQueries({ queryKey: marketplaceQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() }),
    ]);
  };

  const withdrawListing = useMutation({
    mutationFn: async (userItemId: number) => {
      const response = await fetch("/api/marketplace/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userItemId }),
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

  const cancelBuyOrder = useMutation({
    mutationFn: async (orderId: number) => {
      const response = await fetch(`/api/marketplace/buy-orders/${orderId}`, {
        method: "DELETE",
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

  return (
    <div className="min-w-0 space-y-6">
      <PageHeading
        eyebrow="The exchange"
        title="My orders"
        description="Track what you are offering, what you want to buy, and exactly how much gold is committed."
      />
      <MarketplaceNav />

      {!session?.user?.id ? (
        <div className="game-empty-state">
          Sign in to view your market orders.
        </div>
      ) : query.isLoading ? (
        <div className="game-empty-state">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : query.error ? (
        <div className="game-empty-state text-danger">
          {query.error.message}
        </div>
      ) : !query.data ? (
        <div className="game-empty-state text-danger">
          Could not load your orders
        </div>
      ) : (
        <>
          <dl className="game-panel grid grid-cols-2 gap-px overflow-hidden bg-border md:grid-cols-4">
            <div className="bg-card p-4">
              <dt className="text-xs text-muted-foreground">Sell offers</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {query.data.summary.sellListingCount}
              </dd>
              <p className="text-[11px] text-muted-foreground">
                {query.data.summary.sellUnits} units
              </p>
            </div>
            <div className="bg-card p-4">
              <dt className="text-xs text-muted-foreground">
                Expected proceeds
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-success">
                {query.data.summary.sellNet.toLocaleString()}
              </dd>
              <p className="text-[11px] text-muted-foreground">
                after {query.data.summary.sellTax.toLocaleString()} tax
              </p>
            </div>
            <div className="bg-card p-4">
              <dt className="text-xs text-muted-foreground">Buy orders</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">
                {query.data.summary.buyOrderCount}
              </dd>
              <p className="text-[11px] text-muted-foreground">
                {query.data.summary.buyUnits} units wanted
              </p>
            </div>
            <div className="bg-card p-4">
              <dt className="text-xs text-muted-foreground">Gold reserved</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-currency">
                {query.data.summary.reservedGold.toLocaleString()}
              </dd>
              <p className="text-[11px] text-muted-foreground">
                returned if cancelled
              </p>
            </div>
          </dl>

          <section className="game-panel overflow-hidden">
            <header className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h2 className="game-section-title flex items-center gap-2">
                  <ArrowUpFromLine className="h-4 w-4 text-primary" /> Sell
                  offers
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Expected proceeds include the 12% exchange tax.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/marketplace/sell">Sell an item</Link>
              </Button>
            </header>
            {query.data.sellListings.length > 0 ? (
              <div className="divide-y divide-border">
                {query.data.sellListings.map((listing) => {
                  const sale = calculateMarketSale(
                    listing.listedPrice ?? 0,
                    listing.quantity,
                  );
                  return (
                    <div
                      key={listing.id}
                      className="grid gap-3 p-4 sm:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(80px,auto))_auto] sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ItemArtwork
                          src={listing.itemTemplate.sprite}
                          name={listing.itemTemplate.name}
                          rarity={listing.rarity}
                          size={48}
                          itemId={listing.itemTemplate.id}
                        />
                        <div className="min-w-0">
                          <span className="block truncate font-semibold">
                            {listing.itemTemplate.name}
                          </span>
                          <div className="mt-1">
                            <RarityBadge rarity={listing.rarity} />
                          </div>
                        </div>
                      </div>
                      <div className="text-sm">
                        <span className="text-xs text-muted-foreground">
                          Quantity
                        </span>
                        <span className="block font-semibold tabular-nums">
                          {listing.quantity}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-xs text-muted-foreground">
                          Unit price
                        </span>
                        <span className="block font-semibold tabular-nums text-currency">
                          {listing.listedPrice?.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-xs text-muted-foreground">
                          Net if sold
                        </span>
                        <span className="block font-semibold tabular-nums text-success">
                          {sale.net.toLocaleString()}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => withdrawListing.mutate(listing.id)}
                        disabled={withdrawListing.isPending}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Withdraw
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="game-empty-state m-4">
                You have no active sell offers.
              </div>
            )}
          </section>

          <section className="game-panel overflow-hidden">
            <header className="border-b border-border p-4">
              <h2 className="game-section-title flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-primary" /> Buy orders
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Gold is reserved; higher prices fill first and equal prices fill
                oldest first. Orders that cannot fit are cancelled and refunded.
              </p>
            </header>
            {query.data.buyOrders.length > 0 ? (
              <div className="divide-y divide-border">
                {query.data.buyOrders.map((order) => (
                  <div
                    key={order.id}
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(80px,auto))_auto] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ItemArtwork
                        src={order.item.sprite}
                        name={order.item.name}
                        rarity={order.rarity}
                        size={48}
                        itemId={order.itemId}
                      />
                      <div className="min-w-0">
                        <span className="block truncate font-semibold">
                          {order.item.name}
                        </span>
                        <div className="mt-1">
                          <RarityBadge rarity={order.rarity} />
                        </div>
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground">
                        Remaining
                      </span>
                      <span className="block font-semibold tabular-nums">
                        {order.remainingQuantity} / {order.quantity}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground">
                        Bid each
                      </span>
                      <span className="block font-semibold tabular-nums text-success">
                        {order.pricePerItem.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-xs text-muted-foreground">
                        Reserved
                      </span>
                      <span className="block font-semibold tabular-nums text-currency">
                        <CoinsIcon size={14} />{" "}
                        {order.reservedGold.toLocaleString()}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelBuyOrder.mutate(order.id)}
                      disabled={cancelBuyOrder.isPending}
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Cancel & refund
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="game-empty-state m-4">
                You have no open buy orders.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
