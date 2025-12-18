"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { ItemRarity } from "@prisma/client";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Search,
  X,
  ShoppingCart,
  SortDesc,
  SortAsc,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ItemFilters } from "./marketplaceFilters";
import { MarketplaceGroupedItem, MarketplaceListing } from "~/types/marketplace";
import SingleItemTemplate from "../items/single-item-template";
import { Skeleton } from "~/components/ui/skeleton";
import { CoinsIcon } from "../ui/coins-icon";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { getRarityTailwindClass } from "~/utils/rarity-colors";
import Image from "next/image";
import { Separator } from "~/components/ui/separator";

declare module "@tanstack/react-table" {
  interface TableMeta<TData> {
    currentUserId?: string;
  }
}

type GroupedMarketplaceItem = MarketplaceGroupedItem;

interface DataTableProps {
  data: MarketplaceGroupedItem[];
  onBuyItem: (payload: { id: number; name: string; price: number }) => void;
  onFetchItemListings?: (
    itemTemplateId: number,
    cursor: string | null,
    rarity?: string,
  ) => Promise<{
    listings: MarketplaceListing[];
    hasMore: boolean;
    nextCursor: string | null;
    availableRarities?: string[];
  }>;
  isLoading?: boolean;
  currentUserId?: string; // Current logged-in user ID
  // Controlled filters (lifted to page, persisted via URL)
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  equipToFilter?: string;
  onEquipToFilterChange?: (v: string) => void;
  rarityFilter?: string;
  onRarityFilterChange?: (v: string) => void;
  priceRange?: { min: number; max: number };
  onPriceRangeChange?: (r: { min: number; max: number }) => void;
}

const createColumns = (
  rarityColors: Record<ItemRarity, string>
): ColumnDef<GroupedMarketplaceItem>[] => [
  {
    id: "item",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="flex items-center gap-2"
      >
        Item
        {column.getIsSorted() === "asc" ? (
          <SortAsc className="h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <SortDesc className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4" />
        )}
      </Button>
    ),
    accessorFn: (row) => row.itemName,
    cell: ({ row }) => {
      const rarity = row.original.lowestRarity;
      return (
        <div className="flex items-center gap-3">
          <Image
            src={row.original.sprite}
            alt={row.original.itemName}
            width={56}
            height={56}
          />
          <div>
            <div
              className={`font-medium ${getRarityTailwindClass(
                rarity,
                rarityColors[rarity],
                "text"
              )}`}
            >
              {row.original.itemName}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.totalListings} listing
              {row.original.totalListings !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "priceRange",
    header: ({ column }) => (
      //   <Button
      //     variant="ghost"
      //     onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      //     className="flex items-center gap-2"
      //   >
      //     Price Range
      //     {column.getIsSorted() === "asc" ? (
      //       <SortAsc className="h-4 w-4" />
      //     ) : column.getIsSorted() === "desc" ? (
      //       <SortDesc className="h-4 w-4" />
      //     ) : (
      //       <ArrowUpDown className="h-4 w-4" />
      //     )}
      //   </Button>
      <></>
    ),
    accessorFn: (row) => row.minPrice,
    cell: ({ row }) => {
      const { minPrice, maxPrice } = row.original;
      return (
        <div className="flex items-center justify-end gap-2 font-semibold text-yellow-600">
          {minPrice === maxPrice ? (
            <span>
              <CoinsIcon /> {minPrice.toLocaleString()}
            </span>
          ) : (
            <span>
              <CoinsIcon /> {minPrice.toLocaleString()} - <CoinsIcon />{" "}
              {maxPrice.toLocaleString()}{" "}
            </span>
          )}
        </div>
      );
    },
  },
];

export function MarketplaceDataTable({
  data,
  onBuyItem,
  onFetchItemListings,
  isLoading = false,
  currentUserId,
  searchValue: controlledSearchValue,
  onSearchChange,
  equipToFilter: controlledEquipTo,
  onEquipToFilterChange,
  rarityFilter: controlledRarity,
  onRarityFilterChange,
  priceRange: controlledPriceRange,
  onPriceRangeChange,
}: DataTableProps) {
  const { colors: rarityColors } = useRarityColors();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalSearchValue, setInternalSearchValue] = useState("");
  const [internalEquipTo, setInternalEquipTo] = useState<string>("all");
  const [internalRarity, setInternalRarity] = useState<string>("all");
  const [internalPriceRange, setInternalPriceRange] = useState<{
    min: number;
    max: number;
  }>({
    min: 0,
    max: 100000,
  });

  // Dialog states
  const [selectedGroup, setSelectedGroup] =
    useState<GroupedMarketplaceItem | null>(null);
  const [selectedListing, setSelectedListing] =
    useState<MarketplaceListing | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  // Pagination state for listings
  const [paginatedListings, setPaginatedListings] = useState<
    MarketplaceListing[]
  >([]);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [availableRarities, setAvailableRarities] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const listingsScrollRef = useRef<HTMLDivElement>(null);

  // Refs to track state in scroll handler
  const isLoadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const nextCursorRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    isLoadingRef.current = isLoadingListings;
  }, [isLoadingListings]);

  useEffect(() => {
    hasMoreRef.current = hasMoreListings;
  }, [hasMoreListings]);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  // Use controlled values if provided, otherwise fall back to internal state
  const searchValue = controlledSearchValue ?? internalSearchValue;
  const equipToFilter = controlledEquipTo ?? internalEquipTo;
  const rarityFilter = controlledRarity ?? internalRarity;
  const priceRange = controlledPriceRange ?? internalPriceRange;

  const handleRowClick = async (group: GroupedMarketplaceItem) => {
    setPaginatedListings([]);
    setHasMoreListings(true);
    hasMoreRef.current = true;
    setSelectedGroup(group);
    setSelectedRarity(null); // Reset rarity filter
    setAvailableRarities([]); // Will be populated from API response
    setNextCursor(null);
    nextCursorRef.current = null;

    if (onFetchItemListings) {
      isLoadingRef.current = true;
      setIsLoadingListings(true);
      try {
        const result = await onFetchItemListings(group.itemTemplateId, null);

        setPaginatedListings(result.listings);
        setHasMoreListings(result.hasMore);
        hasMoreRef.current = result.hasMore;
        setNextCursor(result.nextCursor);
        nextCursorRef.current = result.nextCursor;
        
        // Capture available rarities from first page response
        if (result.availableRarities) {
          setAvailableRarities(result.availableRarities);
        }
      } catch (error) {
        console.error("Error fetching listings:", error);
      } finally {
        setIsLoadingListings(false);
        isLoadingRef.current = false;
      }
    } else {
      // If the API fetcher isn't provided, we can't load listings.
      setPaginatedListings([]);
      setHasMoreListings(false);
    }
  };

  const handleListingClick = (listing: MarketplaceListing) => {
    setSelectedListing(listing);
    setPurchaseQuantity(1);
  };

  const loadMoreListings = async () => {
    if (
      !selectedGroup ||
      isLoadingRef.current ||
      !hasMoreRef.current ||
      !nextCursorRef.current
    ) {
      return;
    }

    if (onFetchItemListings) {
      isLoadingRef.current = true;
      setIsLoadingListings(true);
      try {
        const result = await onFetchItemListings(
          selectedGroup.itemTemplateId,
          nextCursorRef.current,
          selectedRarity ?? undefined,
        );
        setPaginatedListings((prev) => [...prev, ...result.listings]);
        setHasMoreListings(result.hasMore);
        hasMoreRef.current = result.hasMore;
        setNextCursor(result.nextCursor);
        nextCursorRef.current = result.nextCursor;
      } catch (error) {
        console.error("Error loading more listings:", error);
      } finally {
        setIsLoadingListings(false);
        isLoadingRef.current = false;
      }
    } else {
      // No-op without API fetcher.
    }
  };

  const handleRaritySelect = async (rarity: string | null) => {
    if (!selectedGroup) return;
    
    setSelectedRarity(rarity);
    setPaginatedListings([]);
    setHasMoreListings(true);
    hasMoreRef.current = true;
    setNextCursor(null);
    nextCursorRef.current = null;

    if (onFetchItemListings) {
      isLoadingRef.current = true;
      setIsLoadingListings(true);
      try {
        const result = await onFetchItemListings(
          selectedGroup.itemTemplateId,
          null,
          rarity ?? undefined,
        );
        setPaginatedListings(result.listings);
        setHasMoreListings(result.hasMore);
        hasMoreRef.current = result.hasMore;
        setNextCursor(result.nextCursor);
        nextCursorRef.current = result.nextCursor;
      } catch (error) {
        console.error("Error fetching filtered listings:", error);
      } finally {
        setIsLoadingListings(false);
        isLoadingRef.current = false;
      }
    } else {
      // No-op without API fetcher.
    }
  };

  // Attach scroll listener to load more listings
  useEffect(() => {
    // Only attach listener when dialog is open
    if (!selectedGroup) return;

    const timeoutId = setTimeout(() => {
      const scrollContainer = listingsScrollRef.current;
      if (!scrollContainer) {
        return;
      }

      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 50;

        if (isLoadingRef.current || !hasMoreRef.current) {
          return;
        }

        if (isNearBottom) {
          void loadMoreListings();
        }
      };

      scrollContainer.addEventListener("scroll", handleScroll);

      return () => {
        scrollContainer.removeEventListener("scroll", handleScroll);
      };
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [selectedGroup]);

  const handlePurchase = () => {
    if (selectedListing) {
      onBuyItem({
        id: selectedListing.id,
        name: selectedListing.itemTemplate.name,
        price: selectedListing.listedPrice ?? 0,
      });
      setSelectedListing(null);
      setSelectedGroup(null);
    }
  };

  const columns = useMemo(() => createColumns(rarityColors), [rarityColors]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    meta: {
      currentUserId,
    },
  });

  const tableRef = useRef<HTMLTableElement>(null);

  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableRef.current?.parentElement as HTMLElement | null,
    estimateSize: () => 64,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1]!.end
      : 0;

  const equipToOptions = useMemo(() => {
    const unique = new Set(
      data.map((item) => item.equipTo).filter(Boolean),
    );
    return Array.from(unique).sort();
  }, [data]);

  const rarities = useMemo(() => {
    const unique = new Set<string>();
    return Array.from(unique).sort();
  }, [data]);

  const resetFilters = () => {
    if (onSearchChange) onSearchChange("");
    else setInternalSearchValue("");

    if (onEquipToFilterChange) onEquipToFilterChange("all");
    else setInternalEquipTo("all");

    if (onRarityFilterChange) onRarityFilterChange("all");
    else setInternalRarity("all");

    if (onPriceRangeChange) onPriceRangeChange({ min: 0, max: 100000 });
    else setInternalPriceRange({ min: 0, max: 100000 });

    setSorting([]);
  };

  const hasActiveFilters =
    !!searchValue ||
    equipToFilter !== "all" ||
    rarityFilter !== "all" ||
    sorting.length > 0;

  return (
    <>
      <div className="flex gap-6">
        {/* Table */}
        <div className="relative flex-1 overflow-hidden rounded-lg border">
          <div className="relative w-full overflow-auto max-h-[70vh]">
            <table
              ref={tableRef}
              className="w-full caption-bottom text-sm"
            >
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="font-semibold">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              {/* Virtualized rows */}
              <TableBody>
                {paddingTop > 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      style={{ height: paddingTop }}
                      className="p-0"
                    />
                  </TableRow>
                )}

                {rows.length > 0
                  ? virtualItems.map((virtualRow) => {
                      const row = rows[virtualRow.index]!;
                      const idx = virtualRow.index;
                      return (
                        <TableRow
                          key={row.id}
                          onClick={() => {
                            void handleRowClick(row.original);
                          }}
                          className={`${idx % 2 === 0 ? "bg-muted/5" : "bg-transparent"} cursor-pointer border-none text-white hover:bg-muted/10`}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="text-white">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  : null}

                {paddingBottom > 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      style={{ height: paddingBottom }}
                      className="p-0"
                    />
                  </TableRow>
                )}
              </TableBody>

              {/* Loading skeleton rows */}
              {isLoading && (
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRow
                      key={`skeleton-${i}`}
                      className={`${i % 2 === 0 ? "bg-muted/5" : "bg-transparent"} border-none`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-14 w-14 rounded" />
                          <div className="space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-40" />
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>

        <div className="max-w-md">
          {/* Search and Filter Controls */}
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Search items by name..."
                value={searchValue}
                onChange={(e) =>
                  onSearchChange
                    ? onSearchChange(e.target.value)
                    : setInternalSearchValue(e.target.value)
                }
                className="indent-5"
              />
            </div>

            {/* Filter Row */}
            <div className="flex flex-col gap-3 md:flex-row">
              <Select
                value={equipToFilter}
                onValueChange={(v) =>
                  onEquipToFilterChange
                    ? onEquipToFilterChange(v)
                    : setInternalEquipTo(v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {equipToOptions.map((equipTo) => (
                    <SelectItem key={equipTo} value={equipTo ?? "consumable"}>
                      {equipTo ?? "Consumable"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={rarityFilter}
                onValueChange={(v) =>
                  onRarityFilterChange
                    ? onRarityFilterChange(v)
                    : setInternalRarity(v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Rarities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rarities</SelectItem>
                  {rarities.map((rarity) => (
                    <SelectItem key={rarity} value={rarity}>
                      {rarity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ItemFilters
                priceRange={priceRange}
                onPriceRangeChange={(r) =>
                  onPriceRangeChange
                    ? onPriceRangeChange(r)
                    : setInternalPriceRange(r)
                }
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="ml-auto flex gap-2"
              >
                <X className="h-4 w-4" />
                Reset Filters
              </Button>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {table.getRowModel().rows.length} items
            </span>
            {isLoading && (
              <span className="text-xs italic">Loading listings...</span>
            )}
          </div>
        </div>
      </div>

      {/* Listings Dialog */}
      <Dialog
        open={!!selectedGroup}
        onOpenChange={(open) => !open && setSelectedGroup(null)}
      >
        <DialogContent className="max-w-sm px-0 pb-0">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-3">
              {selectedGroup && (
                <div className="flex flex-col items-center justify-center gap-2">
                  {/* <SingleItemTemplate
                    item={{
                      ...selectedGroup.listings[0]!.itemTemplate,
                      id: selectedGroup.listings[0]!.id,
                      itemId: selectedGroup.listings[0]!.itemTemplate.id,
                      rarity: selectedGroup.listings[0]!.rarity,
                      stats: selectedGroup.listings[0]!.stats.map((stat) => ({
                        id: stat.id,
                        itemId: selectedGroup.listings[0]!.itemTemplate.id,
                        statType: stat.statType,
                        value: stat.value,
                      })),
                    }}
                    sprite={selectedGroup.sprite}
                    showEquipButton={false}
                    showUnequipButton={false}
                    showListButton={false}
                    className="w-16 h-16"
                  /> */}
                  <Image
                    src={selectedGroup.sprite}
                    alt={selectedGroup.itemName}
                    width={60}
                    height={60}
                  />
                  <h3 className="text-sm">{selectedGroup.itemName}</h3>
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              {selectedGroup?.totalListings} listing
              {selectedGroup?.totalListings !== 1 ? "s" : ""} available
            </DialogDescription>
          </DialogHeader>

          <Separator className="text-xs font-semibold text-gray-400">
            FILTERS
          </Separator>

          {/* Rarity Filter Badges */}
          {availableRarities.length > 0 && (
            <div className="flex flex-wrap justify-center items-center gap-2 px-2">
              <Badge
                variant={selectedRarity === null ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleRaritySelect(null)}
              >
                All
              </Badge>
              {availableRarities.map((rarity) => {
                const hexColor = rarityColors[rarity as keyof typeof rarityColors];
                return (
                  <Badge
                    key={rarity}
                    variant={selectedRarity === rarity ? "default" : "outline"}
                    className="cursor-pointer"
                    style={{
                      backgroundColor:
                        selectedRarity === rarity
                          ? hexColor
                          : "transparent",
                      borderColor: hexColor,
                      color:
                        selectedRarity === rarity ? "white" : hexColor,
                    }}
                    onClick={() => handleRaritySelect(rarity)}
                  >
                    {rarity}
                  </Badge>
                );
              })}
            </div>
          )}

          <Separator className="text-xs font-semibold text-gray-400">
            LISTINGS
          </Separator>

          <div
            ref={listingsScrollRef}
            className="h-[32vh] space-y-2 overflow-y-auto"
          >
            {paginatedListings.map((listing) => {
              const isOwnListing = listing.user.id === currentUserId;
              return (
                <div
                  key={listing.id}
                  onClick={() => !isOwnListing && handleListingClick(listing)}
                  className={`flex items-center justify-between border-b p-4 px-8 transition-colors ${
                    isOwnListing
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-muted/10"
                  }`}
                >
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{listing.quantity}x</span>
                      <span
                        className={`font-medium ${getRarityTailwindClass(listing.rarity, rarityColors[listing.rarity], "text")}`}
                      >
                        {listing.itemTemplate.name}
                      </span>
                      {/* <RarityBadge rarity={listing.rarity} className="text-[8px] px-1 h-4" /> */}
                    </div>
                    <Badge className="mt-1 bg-gray-700/60 text-xs font-medium text-gray-400 shadow-none">
                      @{listing.user.name ?? "Unknown"}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-yellow-600">
                      {listing.listedPrice?.toLocaleString() ?? "0"}{" "}
                      <CoinsIcon size={18} />
                    </div>
                    {isOwnListing && (
                      <div className="text-xs text-muted-foreground">
                        Your listing
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading indicator */}
            {isLoadingListings && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* End of list indicator */}
            {!isLoadingListings &&
              hasMoreListings &&
              paginatedListings.length > 0 && (
                <div className="flex justify-center py-4 text-xs text-muted-foreground">
                  Scroll for more...
                </div>
              )}

          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase Quantity Dialog */}
      <Dialog
        open={!!selectedListing}
        onOpenChange={(open) => !open && setSelectedListing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase Item</DialogTitle>
            <DialogDescription>
              Select the quantity you want to purchase
            </DialogDescription>
          </DialogHeader>

          {selectedListing && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <SingleItemTemplate
                  item={{
                    ...selectedListing.itemTemplate,
                    id: selectedListing.id,
                    itemId: selectedListing.itemTemplate.id,
                    rarity: selectedListing.rarity,
                    stats: selectedListing.stats.map((stat) => ({
                      id: stat.id,
                      itemId: selectedListing.itemTemplate.id,
                      statType: stat.statType,
                      value: stat.value,
                    })),
                  }}
                  sprite={selectedListing.itemTemplate.sprite}
                  showEquipButton={false}
                  showUnequipButton={false}
                  showListButton={false}
                />
                <div className="flex-1">
                  <div
                    className={`font-medium ${getRarityTailwindClass(selectedListing.rarity, rarityColors[selectedListing.rarity], "text")}`}
                  >
                    {selectedListing.itemTemplate.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    @{selectedListing.user.name ?? "Unknown"}
                  </div>
                  <div className="mt-1 text-sm">
                    Available: {selectedListing.quantity}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))
                    }
                    disabled={purchaseQuantity <= 1}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    max={selectedListing.quantity}
                    value={purchaseQuantity}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      const val = Number.isFinite(parsed) ? parsed : 1;
                      setPurchaseQuantity(
                        Math.min(Math.max(1, val), selectedListing.quantity),
                      );
                    }}
                    className="text-center"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPurchaseQuantity(
                        Math.min(
                          selectedListing.quantity,
                          purchaseQuantity + 1,
                        ),
                      )
                    }
                    disabled={purchaseQuantity >= selectedListing.quantity}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="rounded-lg bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Price per item:</span>
                  <span className="font-semibold text-yellow-600">
                    {selectedListing.listedPrice?.toLocaleString() ?? "0"}{" "}
                    <CoinsIcon />
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <span className="font-medium">Total:</span>
                  <span className="text-lg font-bold text-yellow-600">
                    {(
                      (selectedListing.listedPrice ?? 0) * purchaseQuantity
                    ).toLocaleString()}{" "}
                    <CoinsIcon />
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedListing(null)}
                >
                  Cancel
                </Button>
                <Button className="flex-1 gap-2" onClick={handlePurchase}>
                  <ShoppingCart className="h-4 w-4" />
                  Purchase
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
