"use client";

import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { MarketplaceNav } from "~/components/game/marketplace/MarketplaceNav";
import {
  MarketItemCell,
  MarketTable,
  MarketTableEmpty,
  MarketTableHead,
  MarketTableRow,
} from "~/components/game/marketplace/MarketTable";
import PageHeading from "~/components/game/ui/PageHeading";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { calculateMarketSale } from "~/lib/marketplace";
import {
  inventoryQueryKeys,
  marketplaceQueryKeys,
  userQueryKeys,
} from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import type { MyListingsResponse } from "~/types/marketplace";

const columns =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_56px_96px_104px_104px]";
const wideCell = "hidden text-right tabular-nums sm:block";

function SummaryTile({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: ReactNode;
  note: string;
  className?: string;
}) {
  return (
    <div className="rounded-[10px] bg-surface-inset px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-1 text-xl font-semibold tabular-nums", className)}>
        {value}
      </dd>
      <p className="text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

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
    <div className="min-w-0 space-y-4">
      <PageHeading
        eyebrow="The exchange"
        title="My orders"
        description="Track what you are offering, what you want to buy, and exactly how much gold is committed."
      />
      <MarketplaceNav />

      {!session?.user?.id ? (
        <div className="game-empty-state border-0 bg-surface-inset/60">
          Sign in to view your market orders.
        </div>
      ) : query.isLoading ? (
        <div className="game-empty-state border-0 bg-surface-inset/60">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      ) : !query.data ? (
        <div className="game-empty-state border-0 bg-surface-inset/60 text-danger">
          {query.error?.message ?? "Could not load your orders"}
        </div>
      ) : (
        <>
          <dl className="game-panel-flat grid grid-cols-2 gap-1.5 p-1.5 md:grid-cols-4">
            <SummaryTile
              label="Sell offers"
              value={query.data.summary.sellListingCount}
              note={`${query.data.summary.sellUnits} units`}
            />
            <SummaryTile
              label="Expected proceeds"
              value={query.data.summary.sellNet.toLocaleString()}
              note={`after ${query.data.summary.sellTax.toLocaleString()} tax`}
              className="text-success"
            />
            <SummaryTile
              label="Buy orders"
              value={query.data.summary.buyOrderCount}
              note={`${query.data.summary.buyUnits} units wanted`}
            />
            <SummaryTile
              label="Gold reserved"
              value={query.data.summary.reservedGold.toLocaleString()}
              note="returned if cancelled"
              className="text-currency"
            />
          </dl>

          <MarketTable
            title={
              <span className="flex items-center gap-2">
                <ArrowUpFromLine className="h-4 w-4 text-primary" /> Sell offers
              </span>
            }
            meta={`${query.data.sellListings.length} active`}
            action={
              <Button asChild size="sm">
                <Link href="/marketplace/sell">Sell an item</Link>
              </Button>
            }
          >
            <div className="px-1.5 pb-1.5">
              {query.data.sellListings.length > 0 ? (
                <>
                  <MarketTableHead className={cn(columns, "hidden sm:grid")}>
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Price each</span>
                    <span className="text-right">Net after tax</span>
                    <span className="sr-only">Actions</span>
                  </MarketTableHead>
                  {query.data.sellListings.map((listing) => {
                    const sale = calculateMarketSale(
                      listing.listedPrice ?? 0,
                      listing.quantity,
                    );
                    return (
                      <MarketTableRow key={listing.id} className={columns}>
                        <MarketItemCell
                          item={{
                            ...listing.itemTemplate,
                            rarity: listing.rarity,
                          }}
                        >
                          <span className="text-[11px] tabular-nums text-muted-foreground sm:hidden">
                            {listing.quantity} ×{" "}
                            {listing.listedPrice?.toLocaleString()}
                          </span>
                        </MarketItemCell>
                        <span className={cn(wideCell, "text-sm")}>
                          {listing.quantity.toLocaleString()}
                        </span>
                        <span
                          className={cn(
                            wideCell,
                            "font-semibold text-currency",
                          )}
                        >
                          <CoinsIcon size={14} />{" "}
                          {listing.listedPrice?.toLocaleString()}
                        </span>
                        <span
                          className={cn(wideCell, "font-semibold text-success")}
                        >
                          {sale.net.toLocaleString()}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="justify-self-end"
                          onClick={() => withdrawListing.mutate(listing.id)}
                          disabled={withdrawListing.isPending}
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Withdraw
                        </Button>
                      </MarketTableRow>
                    );
                  })}
                </>
              ) : (
                <MarketTableEmpty title="You have no active sell offers." />
              )}
            </div>
          </MarketTable>

          <MarketTable
            title={
              <span className="flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4 text-primary" /> Buy orders
              </span>
            }
            meta={`${query.data.buyOrders.length} open`}
          >
            <div className="px-1.5 pb-1.5">
              {query.data.buyOrders.length > 0 ? (
                <>
                  <MarketTableHead className={cn(columns, "hidden sm:grid")}>
                    <span>Item</span>
                    <span className="text-right">Left</span>
                    <span className="text-right">Bid each</span>
                    <span className="text-right">Reserved</span>
                    <span className="sr-only">Actions</span>
                  </MarketTableHead>
                  {query.data.buyOrders.map((order) => (
                    <MarketTableRow key={order.id} className={columns}>
                      <MarketItemCell
                        item={{
                          id: order.itemId,
                          name: order.item.name,
                          sprite: order.item.sprite,
                          rarity: order.rarity,
                        }}
                      >
                        <span className="text-[11px] tabular-nums text-muted-foreground sm:hidden">
                          {order.remainingQuantity} ×{" "}
                          {order.pricePerItem.toLocaleString()}
                        </span>
                      </MarketItemCell>
                      <span className={cn(wideCell, "text-sm")}>
                        {order.remainingQuantity}
                        <span className="block text-[10px] text-muted-foreground">
                          of {order.quantity}
                        </span>
                      </span>
                      <span
                        className={cn(wideCell, "font-semibold text-success")}
                      >
                        {order.pricePerItem.toLocaleString()}
                      </span>
                      <span
                        className={cn(wideCell, "font-semibold text-currency")}
                      >
                        <CoinsIcon size={14} />{" "}
                        {order.reservedGold.toLocaleString()}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="justify-self-end"
                        onClick={() => cancelBuyOrder.mutate(order.id)}
                        disabled={cancelBuyOrder.isPending}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    </MarketTableRow>
                  ))}
                </>
              ) : (
                <MarketTableEmpty title="You have no open buy orders." />
              )}
            </div>
          </MarketTable>
        </>
      )}
    </div>
  );
}
