"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  PackageOpen,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import type { ItemRarity, ItemType } from "~/generated/prisma/enums";
import { MARKET_DEFAULT_MAX_PRICE } from "~/lib/marketplace";
import type { MarketplaceGroupedItem } from "~/types/marketplace";
import { RarityBadge } from "~/utils/ui/rarity-badge";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { ItemFilters } from "./marketplaceFilters";

interface DataTableProps {
  data: MarketplaceGroupedItem[];
  isLoading?: boolean;
  currentUserId?: string;
  filterOptions?: { itemTypes: ItemType[]; rarities: ItemRarity[] };
  searchValue: string;
  onSearchChange: (value: string) => void;
  itemTypeFilter: string;
  onItemTypeFilterChange: (value: string) => void;
  rarityFilter: string;
  onRarityFilterChange: (value: string) => void;
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
  sortValue: string;
  onSortChange: (value: string) => void;
}

function labelEnum(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function Filters({
  filterOptions,
  searchValue,
  onSearchChange,
  itemTypeFilter,
  onItemTypeFilterChange,
  rarityFilter,
  onRarityFilterChange,
  priceRange,
  onPriceRangeChange,
  sortValue,
  onSortChange,
  vertical = false,
}: Omit<DataTableProps, "data" | "isLoading" | "currentUserId"> & {
  vertical?: boolean;
}) {
  const hasFilters =
    searchValue.length > 0 ||
    itemTypeFilter !== "all" ||
    rarityFilter !== "all" ||
    priceRange.min > 0 ||
    priceRange.max < MARKET_DEFAULT_MAX_PRICE ||
    sortValue !== "price-asc";

  const reset = () => {
    onSearchChange("");
    onItemTypeFilterChange("all");
    onRarityFilterChange("all");
    onPriceRangeChange({ min: 0, max: MARKET_DEFAULT_MAX_PRICE });
    onSortChange("price-asc");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Filters
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
            <X className="h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>
      <div
        className={
          vertical ? "space-y-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        }
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search marketplace"
            placeholder="Search the exchange…"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={itemTypeFilter} onValueChange={onItemTypeFilterChange}>
          <SelectTrigger aria-label="Filter by item type">
            <SelectValue placeholder="All item types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All item types</SelectItem>
            {(filterOptions?.itemTypes ?? []).map((itemType) => (
              <SelectItem
                key={itemType}
                value={itemType}
                className="capitalize"
              >
                {labelEnum(itemType)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rarityFilter} onValueChange={onRarityFilterChange}>
          <SelectTrigger aria-label="Filter by rarity">
            <SelectValue placeholder="All rarities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rarities</SelectItem>
            {(filterOptions?.rarities ?? []).map((rarity) => (
              <SelectItem key={rarity} value={rarity} className="capitalize">
                {labelEnum(rarity)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger aria-label="Sort marketplace">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price-asc">Lowest ask first</SelectItem>
            <SelectItem value="price-desc">Highest ask first</SelectItem>
            <SelectItem value="supply-desc">Most supply</SelectItem>
            <SelectItem value="listings-desc">Most listings</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ItemFilters
        priceRange={priceRange}
        onPriceRangeChange={onPriceRangeChange}
      />
      {(priceRange.min > 0 || priceRange.max < MARKET_DEFAULT_MAX_PRICE) && (
        <p className="text-xs text-muted-foreground">
          Unit price: {priceRange.min.toLocaleString()}–
          {priceRange.max.toLocaleString()} gold
        </p>
      )}
    </div>
  );
}

export function MarketplaceDataTable(props: DataTableProps) {
  const { data, isLoading = false, currentUserId } = props;
  const [selected, setSelected] = useState<MarketplaceGroupedItem | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    if (data.length === 0) {
      setSelected(null);
      return;
    }
    setSelected((current) =>
      current &&
      data.some(
        (row) =>
          row.itemTemplateId === current.itemTemplateId &&
          row.rarity === current.rarity,
      )
        ? current
        : data[0]!,
    );
  }, [data]);

  const choose = (row: MarketplaceGroupedItem) => {
    setSelected(row);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobileDetailOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="game-panel p-4 xl:hidden">
        <Filters {...props} />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] xl:grid-cols-[240px_minmax(420px,1fr)_minmax(350px,0.82fr)]">
        <aside
          className="game-panel hidden h-fit p-4 xl:block"
          aria-label="Marketplace filters"
        >
          <Filters {...props} vertical />
        </aside>

        <section
          className="game-panel min-w-0 overflow-hidden"
          aria-label="Market results"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="game-section-title">Goods for sale</h2>
              <p className="text-xs text-muted-foreground">
                One row per item and rarity · prices are per unit
              </p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {data.length} markets
            </span>
          </div>

          <div className="hidden grid-cols-[minmax(0,1fr)_100px_88px_72px] gap-3 border-b border-border bg-surface-inset px-4 py-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Item</span>
            <span className="text-right">Lowest ask</span>
            <span className="text-right">Supply</span>
            <span className="text-right">24h sold</span>
          </div>

          <div className="max-h-[68vh] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-px">
                {Array.from({ length: 7 }, (_, index) => (
                  <div
                    key={index}
                    className="flex gap-3 border-b border-border p-3"
                  >
                    <Skeleton className="h-12 w-12" />
                    <Skeleton className="h-12 flex-1" />
                  </div>
                ))}
              </div>
            ) : data.length > 0 ? (
              data.map((row) => {
                const active =
                  selected?.itemTemplateId === row.itemTemplateId &&
                  selected.rarity === row.rarity;
                return (
                  <div
                    key={`${row.itemTemplateId}:${row.rarity}`}
                    className={`game-stretched-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors last:border-b-0 sm:grid-cols-[minmax(0,1fr)_100px_88px_72px] ${active ? "bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]" : "hover:bg-secondary/50"}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ItemArtwork
                        src={row.sprite}
                        name={row.itemName}
                        rarity={row.rarity}
                        size={48}
                        itemId={row.itemTemplateId}
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => choose(row)}
                          aria-pressed={active}
                          className="game-stretched-action block w-full truncate font-semibold"
                        >
                          {row.itemName}
                        </button>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <RarityBadge rarity={row.rarity} />
                          <span className="text-[11px] text-muted-foreground sm:hidden">
                            {row.totalUnits} for sale · {row.volume24h} sold 24h
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-right font-semibold tabular-nums text-currency">
                      <CoinsIcon size={14} /> {row.minPrice.toLocaleString()}
                      <span className="block text-[10px] font-normal text-muted-foreground sm:hidden">
                        each
                      </span>
                    </span>
                    <span className="hidden text-right text-sm tabular-nums sm:block">
                      {row.totalUnits.toLocaleString()}
                      <span className="block text-[10px] text-muted-foreground">
                        {row.totalListings} offers
                      </span>
                    </span>
                    <span className="hidden text-right text-sm tabular-nums sm:block">
                      {row.volume24h.toLocaleString()}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="game-empty-state m-4">
                <PackageOpen className="mx-auto mb-3 h-7 w-7" />
                <p className="font-medium text-foreground">
                  No matching offers
                </p>
                <p className="mt-1 text-sm">
                  Try widening the price range or clearing a filter.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside
          className="game-panel hidden h-[70vh] min-h-[580px] min-w-0 overflow-hidden lg:sticky lg:top-24 lg:block"
          aria-label="Selected market"
        >
          {selected ? (
            <MarketDetailPanel
              market={selected}
              currentUserId={currentUserId}
            />
          ) : (
            <div className="game-empty-state m-4">
              <BarChart3 className="mx-auto mb-3 h-7 w-7" />
              Select a market to inspect its offers and completed-sale metrics.
            </div>
          )}
        </aside>

      </div>

      <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <SheetContent
          side="bottom"
          className="h-[90dvh] overflow-hidden rounded-t-xl border-primary/30 p-0 lg:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{selected?.itemName ?? "Market details"}</SheetTitle>
            <SheetDescription>
              Offers, prices, and trade actions.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <MarketDetailPanel
              market={selected}
              currentUserId={currentUserId}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
