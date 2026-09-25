"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PackageOpen, Search, Store } from "lucide-react";
import { MarketplaceNav } from "~/components/game/marketplace/MarketplaceNav";
import {
  SellItemForm,
  type MarketSellItem,
} from "~/components/game/marketplace/SellItemForm";
import {
  MarketItemCell,
  MarketTable,
  MarketTableEmpty,
  MarketTableHead,
  MarketTableRow,
  MarketTableSkeleton,
} from "~/components/game/marketplace/MarketTable";
import PageHeading from "~/components/game/ui/PageHeading";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useUserContext } from "~/context/userContext";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import type { SellableItem } from "~/types/marketplace";

const columns =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_80px_120px]";

function toFormItem(item: SellableItem): MarketSellItem {
  return {
    userItemId: item.id,
    itemId: item.itemTemplate.id,
    itemName: item.itemTemplate.name,
    sprite: item.itemTemplate.sprite,
    rarity: item.rarity,
    maxQuantity: item.quantity,
    stackable: item.itemTemplate.stackable,
  };
}

export default function MarketplaceSellPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { user } = useUserContext();
  // Lives under the inventory key, so activity ticks and inventory changes keep it current.
  const query = useQuery<{ items: SellableItem[] }>({
    queryKey: inventoryQueryKeys.sellable(user?.id),
    queryFn: async () => {
      const response = await fetch("/api/marketplace/sellable");
      if (!response.ok) throw new Error("Could not load your inventory");
      return response.json() as Promise<{ items: SellableItem[] }>;
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (query.data?.items ?? []).filter(
      (item) =>
        !needle || item.itemTemplate.name.toLowerCase().includes(needle),
    );
  }, [query.data?.items, search]);
  const selected =
    filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    if (!selected) setSelectedId(null);
  }, [selected, selectedId]);

  const choose = (item: SellableItem) => {
    setSelectedId(item.id);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setSheetOpen(true);
    }
  };

  const completed = async () => {
    setSheetOpen(false);
    setSelectedId(null);
    await query.refetch();
  };

  return (
    <div className="min-w-0 space-y-4">
      <PageHeading
        eyebrow="The exchange"
        title="Sell"
        description="Accept the best current bid for immediate gold, or create an exact listing at your own price."
      />
      <MarketplaceNav />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className="min-w-0 space-y-4">
          <div role="search" className="game-panel-flat p-1.5">
            <div className="flex h-9 items-center rounded-[9px] bg-surface-inset transition-shadow focus-within:ring-1 focus-within:ring-ring/80">
              <label
                htmlFor="sell-search"
                className="flex h-full shrink-0 items-center pl-3 text-muted-foreground"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Search tradeable inventory</span>
              </label>
              <Input
                id="sell-search"
                placeholder="Search tradeable inventory…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <MarketTable
            title="Tradeable inventory"
            meta={
              query.isLoading
                ? "Loading…"
                : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`
            }
          >
            <div className="max-h-[68vh] overflow-y-auto px-1.5 pb-1.5">
              <MarketTableHead className={cn(columns, "hidden sm:grid")}>
                <span>Item</span>
                <span className="text-right">Available</span>
                <span className="text-right">Sale</span>
              </MarketTableHead>

              {query.isLoading ? (
                <MarketTableSkeleton rows={6} />
              ) : filtered.length > 0 ? (
                filtered.map((item) => {
                  const active = selected?.id === item.id;
                  return (
                    <MarketTableRow
                      key={item.id}
                      active={active}
                      className={cn(columns, "game-stretched-row")}
                    >
                      <MarketItemCell
                        item={{ ...item.itemTemplate, rarity: item.rarity }}
                        name={
                          <button
                            type="button"
                            onClick={() => choose(item)}
                            aria-pressed={active}
                            className={cn(
                              "game-stretched-action block w-full truncate font-semibold",
                              active && "text-primary",
                            )}
                          >
                            {item.itemTemplate.name}
                          </button>
                        }
                      />
                      <span className="text-right text-sm font-semibold tabular-nums">
                        {item.quantity.toLocaleString()}
                        <span className="block text-[10px] font-normal text-muted-foreground sm:hidden">
                          available
                        </span>
                      </span>
                      <span className="hidden text-right text-xs text-muted-foreground sm:block">
                        {item.itemTemplate.stackable
                          ? "Instant or listing"
                          : "Exact listing"}
                      </span>
                    </MarketTableRow>
                  );
                })
              ) : (
                <MarketTableEmpty
                  icon={<PackageOpen className="mx-auto mb-3 h-7 w-7" />}
                  title="No tradeable items found"
                >
                  <p className="mt-1 text-sm">
                    Try another search or place items in your inventory first.
                  </p>
                </MarketTableEmpty>
              )}
            </div>
          </MarketTable>
        </div>

        <aside className="game-panel-flat hidden h-fit min-h-[520px] p-5 lg:block">
          {selected ? (
            <SellItemForm item={toFormItem(selected)} onCompleted={completed} />
          ) : (
            <div className="game-empty-state border-0 bg-surface-inset/60">
              <Store className="mx-auto mb-3 h-7 w-7" />
              Choose an inventory item to prepare a sale.
            </div>
          )}
        </aside>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto rounded-t-xl border-0 bg-card p-5 lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              Sell {selected?.itemTemplate.name ?? "item"}
            </SheetTitle>
            <SheetDescription>
              Choose an immediate sale or create a listing.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <SellItemForm item={toFormItem(selected)} onCompleted={completed} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
