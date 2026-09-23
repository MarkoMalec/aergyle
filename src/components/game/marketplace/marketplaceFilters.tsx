"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { ArrowDownUp, Grid2X2, Layers, Package, Search, X } from "lucide-react";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ItemRarity, ItemType } from "~/generated/prisma/enums";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { MARKET_DEFAULT_MAX_PRICE } from "~/lib/marketplace";
import { cn } from "~/lib/utils";
import type { MarketplaceFilterOptions } from "~/types/marketplace";
import { rarityStyle } from "~/utils/rarity-colors";
import { RarityMark } from "~/utils/ui/rarity-mark";

/** Borderless inset well shared by every control in the filter toolbar. */
const controlClass =
  "flex h-9 w-full min-w-0 items-center justify-start gap-2 whitespace-nowrap rounded-[9px] border-0 bg-surface-inset px-2.5 text-[13px] text-foreground shadow-none transition-colors hover:bg-secondary/70 focus:outline-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-ring/80 data-[state=open]:bg-secondary/70 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:text-left";
// `shadow-[var(...)]` compiles to a shadow *colour*, so the overlay shadow is
// set as a plain property.
const overlayClass = "border-0 [box-shadow:var(--shadow-overlay)]";
const menuClass = cn(
  overlayClass,
  "max-h-[min(22rem,var(--radix-select-content-available-height))] rounded-[12px]",
);
const menuItemClass = "rounded-[8px] text-[13px]";

const SORT_OPTIONS = [
  { value: "price-asc", label: "Lowest ask" },
  { value: "price-desc", label: "Highest ask" },
  { value: "supply-desc", label: "Most supply" },
  { value: "listings-desc", label: "Most listings" },
];

function labelEnum(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

// A fixed locale: the label is also rendered on the server from URL params.
const compactGold = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function priceLabel({ min, max }: { min: number; max: number }) {
  const hasMax = max < MARKET_DEFAULT_MAX_PRICE;
  if (min > 0 && hasMax) {
    return `${compactGold.format(min)}–${compactGold.format(max)}`;
  }
  if (min > 0) return `${compactGold.format(min)}+`;
  if (hasMax) return `≤ ${compactGold.format(max)}`;
  return "Any price";
}

function ItemTypeOption({
  itemType,
  sprite,
}: {
  itemType: string;
  sprite?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {sprite ? (
        <Image
          src={sprite}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 object-contain"
        />
      ) : (
        <span className="grid h-5 w-5 shrink-0 place-items-center text-muted-foreground">
          {itemType === "all" ? (
            <Grid2X2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Package className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
      )}
      {itemType === "all" ? (
        <span className="truncate">All item types</span>
      ) : (
        <span className="truncate capitalize">{labelEnum(itemType)}</span>
      )}
    </span>
  );
}

function RarityOption({
  rarity,
  color,
}: {
  rarity: ItemRarity;
  color?: string;
}) {
  return (
    <span
      className="flex min-w-0 items-center gap-2"
      style={rarityStyle(rarity, color)}
    >
      <span className="game-rarity-chip" data-rarity={rarity}>
        <RarityMark rarity={rarity} />
      </span>
      <span className="game-rarity-text truncate font-medium capitalize">
        {rarity.toLowerCase()}
      </span>
    </span>
  );
}

interface ItemFiltersProps {
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
}

/** Unit-price range: a toolbar control that opens a small min/max form. */
export function ItemFilters({
  priceRange,
  onPriceRangeChange,
}: ItemFiltersProps) {
  const priceId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  useEffect(() => {
    setMinValue(priceRange.min > 0 ? priceRange.min.toString() : "");
    setMaxValue(
      priceRange.max < MARKET_DEFAULT_MAX_PRICE
        ? priceRange.max.toString()
        : "",
    );
  }, [priceRange.max, priceRange.min, isOpen]);

  const handleApply = (event: FormEvent) => {
    event.preventDefault();
    const parsedMin = Number.parseFloat(minValue);
    const parsedMax = Number.parseFloat(maxValue);
    const min = Math.max(0, Number.isFinite(parsedMin) ? parsedMin : 0);
    const max = Math.max(
      min,
      Number.isFinite(parsedMax) ? parsedMax : MARKET_DEFAULT_MAX_PRICE,
    );
    onPriceRangeChange({ min, max });
    setIsOpen(false);
  };

  const label = priceLabel(priceRange);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Unit price: ${label}`}
          className={controlClass}
        >
          <CoinsIcon size={16} className="shrink-0" />
          <span className="truncate">{label}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn(overlayClass, "w-64 p-3")}>
        <form onSubmit={handleApply} className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">
            Unit price, in gold
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor={`${priceId}-min`} className="sr-only">
              Minimum price
            </label>
            <Input
              type="number"
              id={`${priceId}-min`}
              min="0"
              step="0.01"
              inputMode="decimal"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="Min"
              className="h-9 border-0 shadow-none"
            />
            <span className="text-muted-foreground" aria-hidden="true">
              –
            </span>
            <label htmlFor={`${priceId}-max`} className="sr-only">
              Maximum price
            </label>
            <Input
              type="number"
              id={`${priceId}-max`}
              min="0"
              step="0.01"
              inputMode="decimal"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              placeholder="Max"
              className="h-9 border-0 shadow-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onPriceRangeChange({ min: 0, max: MARKET_DEFAULT_MAX_PRICE });
                setIsOpen(false);
              }}
            >
              Clear
            </Button>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export interface MarketFilterBarProps extends ItemFiltersProps {
  filterOptions?: MarketplaceFilterOptions;
  searchValue: string;
  onSearchChange: (value: string) => void;
  itemTypeFilter: string;
  onItemTypeFilterChange: (value: string) => void;
  rarityFilter: string;
  onRarityFilterChange: (value: string) => void;
  sortValue: string;
  onSortChange: (value: string) => void;
  hasFilters: boolean;
  onReset: () => void;
}

/** One compact toolbar: search, then type, rarity, price and sort wells. */
export function MarketFilterBar({
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
  hasFilters,
  onReset,
}: MarketFilterBarProps) {
  const searchId = useId();
  const { colors } = useRarityColors();

  // Keep an active filter selectable (and shown on its trigger) even when
  // nothing of it is on sale any more.
  const listedTypes = filterOptions?.itemTypes ?? [];
  const itemTypes: { itemType: ItemType; sprite?: string }[] =
    itemTypeFilter === "all" ||
    listedTypes.some((option) => option.itemType === itemTypeFilter)
      ? listedTypes
      : [...listedTypes, { itemType: itemTypeFilter as ItemType }];
  const listedRarities = filterOptions?.rarities ?? [];
  const rarities =
    rarityFilter === "all" ||
    listedRarities.includes(rarityFilter as ItemRarity)
      ? listedRarities
      : [...listedRarities, rarityFilter as ItemRarity];

  return (
    <div
      role="search"
      aria-label="Filter the marketplace"
      className="game-panel-flat flex flex-wrap items-center gap-1.5 p-1.5"
    >
      <div className="order-1 flex h-9 min-w-0 flex-1 items-center rounded-[9px] bg-surface-inset pr-1 transition-shadow focus-within:ring-1 focus-within:ring-ring/80">
        <label
          htmlFor={searchId}
          className="flex h-full shrink-0 items-center pl-3 text-muted-foreground"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Search marketplace</span>
        </label>
        <Input
          id={searchId}
          placeholder="Search items…"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-0"
        />
        {searchValue && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="order-3 grid basis-full grid-cols-2 gap-1.5 lg:grid-cols-4 xl:order-2 xl:basis-auto xl:grid-cols-[176px_152px_136px_152px]">
        <Select value={itemTypeFilter} onValueChange={onItemTypeFilterChange}>
          <SelectTrigger
            aria-label="Filter by item type"
            className={controlClass}
          >
            <SelectValue placeholder="All item types" />
          </SelectTrigger>
          <SelectContent className={menuClass}>
            <SelectItem value="all" className={menuItemClass}>
              <ItemTypeOption itemType="all" />
            </SelectItem>
            {itemTypes.map((option) => (
              <SelectItem
                key={option.itemType}
                value={option.itemType}
                className={menuItemClass}
              >
                <ItemTypeOption
                  itemType={option.itemType}
                  sprite={option.sprite}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={rarityFilter} onValueChange={onRarityFilterChange}>
          <SelectTrigger aria-label="Filter by rarity" className={controlClass}>
            <SelectValue placeholder="All rarities" />
          </SelectTrigger>
          <SelectContent className={menuClass}>
            <SelectItem value="all" className={menuItemClass}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="game-rarity-chip bg-secondary text-muted-foreground">
                  <Layers aria-hidden="true" />
                </span>
                <span className="truncate">All rarities</span>
              </span>
            </SelectItem>
            {rarities.map((rarity) => (
              <SelectItem
                key={rarity}
                value={rarity}
                style={rarityStyle(rarity, colors[rarity])}
                className={cn(
                  menuItemClass,
                  "focus:bg-[color-mix(in_srgb,var(--rarity-color)_14%,transparent)]",
                )}
              >
                <RarityOption rarity={rarity} color={colors[rarity]} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ItemFilters
          priceRange={priceRange}
          onPriceRangeChange={onPriceRangeChange}
        />

        <Select value={sortValue} onValueChange={onSortChange}>
          <SelectTrigger aria-label="Sort marketplace" className={controlClass}>
            <ArrowDownUp
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={menuClass}>
            {SORT_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className={menuItemClass}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="order-2 h-9 shrink-0 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground xl:order-3"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" /> Reset
        </Button>
      )}
    </div>
  );
}
