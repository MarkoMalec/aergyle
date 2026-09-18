"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PackageOpen, Search, Store } from "lucide-react";
import { MarketplaceNav } from "~/components/game/marketplace/MarketplaceNav";
import {
  SellItemForm,
  type MarketSellItem,
} from "~/components/game/marketplace/SellItemForm";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import PageHeading from "~/components/game/ui/PageHeading";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { useUserContext } from "~/context/userContext";
import { inventoryQueryKeys } from "~/lib/query-keys";
import type { SellableItem } from "~/types/marketplace";
import { RarityBadge } from "~/utils/ui/rarity-badge";

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
    <div className="min-w-0 space-y-6">
      <PageHeading
        eyebrow="The exchange"
        title="Sell"
        description="Accept the best current bid for immediate gold, or create an exact listing at your own price."
      />
      <MarketplaceNav />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <section className="game-panel min-w-0 overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tradeable inventory…"
                aria-label="Search tradeable inventory"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Only tradeable items currently in your inventory are shown.
            </p>
          </div>

          <div className="max-h-[68vh] overflow-y-auto">
            {query.isLoading ? (
              Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="flex gap-3 border-b border-border p-3"
                >
                  <Skeleton className="h-12 w-12" />
                  <Skeleton className="h-12 flex-1" />
                </div>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((item) => (
                <div
                  key={item.id}
                  className={`game-stretched-row flex w-full items-center gap-3 border-b border-border p-3 text-left transition-colors last:border-0 ${selected?.id === item.id ? "bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]" : "hover:bg-secondary/50"}`}
                >
                  <ItemArtwork
                    src={item.itemTemplate.sprite}
                    name={item.itemTemplate.name}
                    rarity={item.rarity}
                    size={48}
                    itemId={item.itemTemplate.id}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => choose(item)}
                      aria-pressed={selected?.id === item.id}
                      className="game-stretched-action block w-full truncate font-semibold"
                    >
                      {item.itemTemplate.name}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <RarityBadge rarity={item.rarity} />
                      <span className="text-xs text-muted-foreground">
                        {item.quantity.toLocaleString()} available
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {item.itemTemplate.stackable
                      ? "Instant or listing"
                      : "Exact listing"}
                  </span>
                </div>
              ))
            ) : (
              <div className="game-empty-state m-4">
                <PackageOpen className="mx-auto mb-3 h-7 w-7" />
                <p className="font-medium text-foreground">
                  No tradeable items found
                </p>
                <p className="mt-1 text-sm">
                  Try another search or place items in your inventory first.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="game-panel hidden h-fit min-h-[520px] p-5 lg:block">
          {selected ? (
            <SellItemForm item={toFormItem(selected)} onCompleted={completed} />
          ) : (
            <div className="game-empty-state">
              <Store className="mx-auto mb-3 h-7 w-7" />
              Choose an inventory item to prepare a sale.
            </div>
          )}
        </aside>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto rounded-t-xl border-primary/30 p-5 lg:hidden"
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
