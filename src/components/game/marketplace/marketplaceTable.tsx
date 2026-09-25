"use client";

import { useEffect, useState } from "react";
import { BarChart3, PackageOpen } from "lucide-react";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { MARKET_DEFAULT_MAX_PRICE } from "~/lib/marketplace";
import { cn } from "~/lib/utils";
import type {
  MarketplaceGroupedItem,
  MarketplaceGroupedResponse,
} from "~/types/marketplace";
import { MarketDetailPanel } from "./MarketDetailPanel";
import { MarketFilterBar } from "./marketplaceFilters";
import type { MarketFilterBarProps } from "./marketplaceFilters";
import {
  MarketItemCell,
  MarketTable,
  MarketTableEmpty,
  MarketTableHead,
  MarketTablePagination,
  MarketTableRow,
  MarketTableSkeleton,
} from "./MarketTable";

interface DataTableProps
  extends Omit<MarketFilterBarProps, "hasFilters" | "onReset"> {
  data: MarketplaceGroupedItem[];
  isLoading?: boolean;
  currentUserId?: string;
  pagination?: MarketplaceGroupedResponse["pagination"];
  onPageChange: (page: number) => void;
}

export function MarketplaceDataTable({
  data,
  isLoading = false,
  currentUserId,
  pagination,
  onPageChange,
  ...filters
}: DataTableProps) {
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

  const isFiltered =
    filters.searchValue.length > 0 ||
    filters.itemTypeFilter !== "all" ||
    filters.rarityFilter !== "all" ||
    filters.priceRange.min > 0 ||
    filters.priceRange.max < MARKET_DEFAULT_MAX_PRICE;
  const resetFilters = () => {
    filters.onSearchChange("");
    filters.onItemTypeFilterChange("all");
    filters.onRarityFilterChange("all");
    filters.onPriceRangeChange({ min: 0, max: MARKET_DEFAULT_MAX_PRICE });
    filters.onSortChange("price-asc");
  };

  return (
    <div className="space-y-4">
      <MarketFilterBar
        {...filters}
        hasFilters={isFiltered || filters.sortValue !== "price-asc"}
        onReset={resetFilters}
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px]">
        <MarketTable
          title="Goods for sale"
          meta={
            isLoading
              ? "Loading…"
              : `${data.length} market${data.length === 1 ? "" : "s"}`
          }
          className="game-market-results"
          aria-label="Market results"
        >
          <div
            key={pagination?.page}
            className="max-h-[68vh] overflow-y-auto px-1.5 pb-1.5"
          >
            <MarketTableHead className="game-market-columns">
              <span>Item</span>
              <span className="text-right">Lowest ask</span>
              <span className="text-right">Supply</span>
              <span className="text-right">24h sold</span>
            </MarketTableHead>

            {isLoading ? (
              <MarketTableSkeleton />
            ) : data.length > 0 ? (
              data.map((row) => {
                const active =
                  selected?.itemTemplateId === row.itemTemplateId &&
                  selected.rarity === row.rarity;
                return (
                  <MarketTableRow
                    key={`${row.itemTemplateId}:${row.rarity}`}
                    active={active}
                    className="game-stretched-row game-market-row"
                  >
                    <MarketItemCell
                      item={{
                        id: row.itemTemplateId,
                        name: row.itemName,
                        sprite: row.sprite,
                        rarity: row.rarity,
                      }}
                      name={
                        <button
                          type="button"
                          onClick={() => choose(row)}
                          aria-pressed={active}
                          className={cn(
                            "game-stretched-action block w-full truncate font-semibold",
                            active && "text-primary",
                          )}
                        >
                          {row.itemName}
                        </button>
                      }
                    >
                      <span className="game-market-narrow text-[11px] text-muted-foreground">
                        {row.totalUnits.toLocaleString()} for sale ·{" "}
                        {row.volume24h.toLocaleString()} sold 24h
                      </span>
                    </MarketItemCell>
                    <span className="text-right font-semibold tabular-nums text-currency">
                      <CoinsIcon size={14} /> {row.minPrice.toLocaleString()}
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        each
                      </span>
                    </span>
                    <span className="game-market-wide text-right text-sm tabular-nums">
                      {row.totalUnits.toLocaleString()}
                      <span className="block text-[10px] text-muted-foreground">
                        {row.totalListings} offer
                        {row.totalListings === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="game-market-wide text-right text-sm tabular-nums">
                      {row.volume24h.toLocaleString()}
                    </span>
                  </MarketTableRow>
                );
              })
            ) : (
              <MarketTableEmpty
                icon={<PackageOpen className="mx-auto mb-3 h-7 w-7" />}
                title="No matching offers"
              >
                <p className="mt-1 text-sm">
                  Try widening the price range or clearing a filter.
                </p>
                {isFiltered && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={resetFilters}
                  >
                    Clear filters
                  </Button>
                )}
              </MarketTableEmpty>
            )}
          </div>

          {pagination && (
            <MarketTablePagination
              page={pagination.page}
              hasPreviousPage={pagination.hasPreviousPage}
              hasNextPage={pagination.hasNextPage}
              onPageChange={onPageChange}
            />
          )}
        </MarketTable>

        <aside
          className="game-panel-flat hidden min-h-[580px] min-w-0 flex-col overflow-hidden lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100dvh-7.5rem)]"
          aria-label="Selected market"
        >
          {selected ? (
            <MarketDetailPanel
              market={selected}
              currentUserId={currentUserId}
            />
          ) : (
            <div className="game-empty-state m-3 border-0 bg-surface-inset/60">
              <BarChart3 className="mx-auto mb-3 h-7 w-7" />
              Select a market to inspect its offers and completed-sale metrics.
            </div>
          )}
        </aside>
      </div>

      <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
        <SheetContent
          side="bottom"
          className="h-[90dvh] overflow-hidden rounded-t-xl border-0 bg-card p-0 lg:hidden"
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
