"use client";

import { useState, useMemo } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
} from "@tanstack/react-table";
import {
  Search,
  X,
  ShoppingCart,
  SortDesc,
  SortAsc,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Table,
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
import { RarityBadge } from "~/utils/ui/rarity-badge";
import { ItemFilters } from "./marketplaceFilters";
import { MarketplaceListing } from "~/types/marketplace";
import SingleItemTemplate from "../items/single-item-template";
import { Skeleton } from "~/components/ui/skeleton";
import { CoinsIcon } from "../ui/coins-icon";

// Extend TableMeta to include currentUserId
declare module "@tanstack/react-table" {
  interface TableMeta<TData> {
    currentUserId?: string;
  }
}

interface DataTableProps {
  data: MarketplaceListing[];
  onBuyItem: (itemId: number) => void;
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
  onBuyItem: (itemId: number) => void,
): ColumnDef<MarketplaceListing>[] => [
  {
    id: "image",
    header: "",
    cell: ({ row }) => {
      const itemWithStats = {
        ...row.original.itemTemplate,
        id: row.original.id, // Use the UserItem id
        rarity: row.original.rarity, // Use actual item rarity (can be upgraded)
        stats: row.original.stats.map((stat) => ({
          id: stat.id,
          itemId: row.original.itemTemplate.id, // Map userItemId to itemId for compatibility
          statType: stat.statType,
          value: stat.value,
        })),
      };

      return (
        <SingleItemTemplate
          item={itemWithStats}
          sprite={row.original.itemTemplate.sprite}
          showEquipButton={false}
          showUnequipButton={false}
          showListButton={false}
        />
      );
    },
    enableSorting: false,
  },
  {
    accessorFn: (row) => row.itemTemplate.name,
    id: "name",
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
    cell: ({ row }) => (
      <span className="font-medium">{row.original.itemTemplate.name}</span>
    ),
  },
  {
    accessorFn: (row) => row.itemTemplate.equipTo,
    id: "equipTo",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="flex items-center gap-2"
      >
        Type
        {column.getIsSorted() === "asc" ? (
          <SortAsc className="h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <SortDesc className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-light capitalize text-white">
        {row.original.itemTemplate.equipTo || "Consumable"}
      </Badge>
    ),
  },
  {
    accessorKey: "rarity",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="flex items-center gap-2"
      >
        Rarity
        {column.getIsSorted() === "asc" ? (
          <SortAsc className="h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <SortDesc className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => <RarityBadge rarity={row.original.rarity} />,
  },
  {
    accessorFn: (row) => row.user.name,
    id: "seller",
    header: "Seller",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.user.name || "Unknown"}</span>
    ),
  },
  {
    accessorKey: "listedPrice",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "desc")}
        className="flex items-center gap-2"
      >
        Price
        {column.getIsSorted() === "asc" ? (
          <SortAsc className="h-4 w-4" />
        ) : column.getIsSorted() === "desc" ? (
          <SortDesc className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-semibold text-yellow-600">
        {row.original.listedPrice?.toLocaleString() || "0"} <CoinsIcon />
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row, table }) => {
      const isOwnListing =
        row.original.user.id === table.options.meta?.currentUserId;

      return (
        <Button
          size="sm"
          onClick={() => onBuyItem(row.original.id)}
          className="gap-2"
          disabled={isOwnListing}
          title={
            isOwnListing
              ? "You cannot buy your own items"
              : "Purchase this item"
          }
        >
          {isOwnListing ? (
            "Selling"
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" /> Buy
            </>
          )}
        </Button>
      );
    },
    enableSorting: false,
  },
];

export function MarketplaceDataTable({
  data,
  onBuyItem,
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

  // Use controlled values if provided, otherwise fall back to internal state
  const searchValue = controlledSearchValue ?? internalSearchValue;
  const equipToFilter = controlledEquipTo ?? internalEquipTo;
  const rarityFilter = controlledRarity ?? internalRarity;
  const priceRange = controlledPriceRange ?? internalPriceRange;

  const columns = useMemo(() => createColumns(onBuyItem), [onBuyItem]);

  // Advanced filtering logic
  const filteredData = useMemo(() => {
    let result = data;

    // Search filter
    if (searchValue) {
      result = result.filter(
        (item) =>
          item.itemTemplate.name
            .toLowerCase()
            .includes(searchValue.toLowerCase()) ||
          item.user.name?.toLowerCase().includes(searchValue.toLowerCase()),
      );
    }

    // EquipTo filter
    if (equipToFilter && equipToFilter !== "all") {
      result = result.filter(
        (item) => item.itemTemplate.equipTo === equipToFilter,
      );
    }

    // Rarity filter
    if (rarityFilter && rarityFilter !== "all") {
      result = result.filter((item) => item.rarity === rarityFilter);
    }

    // Price range filter
    result = result.filter(
      (item) =>
        (item.listedPrice || 0) >= priceRange.min &&
        (item.listedPrice || 0) <= priceRange.max,
    );

    return result;
  }, [data, searchValue, equipToFilter, rarityFilter, priceRange]);

  const table = useReactTable({
    data: filteredData,
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

  const equipToOptions = useMemo(() => {
    const unique = new Set(
      data.map((item) => item.itemTemplate.equipTo).filter(Boolean),
    );
    return Array.from(unique).sort();
  }, [data]);

  const rarities = useMemo(() => {
    const unique = new Set(data.map((item) => item.rarity));
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
    <div className="flex gap-6">

      {/* Table */}
      <div className="relative overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                // className="hover:bg-black"
              >
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
          <TableBody>
            {table.getRowModel().rows.length > 0
              ? table.getRowModel().rows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={`${idx % 2 === 0 ? "bg-muted/5" : "bg-transparent"} border-none text-white hover:bg-muted/10`}
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
                ))
              : null}
          </TableBody>
          {/* Loading skeleton rows */}
          {isLoading && (
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className={`${i % 2 === 0 ? "bg-muted/5" : "bg-transparent"} border-none`}
                >
                  {/* Image column - skeleton for SingleItemTemplate trigger */}
                  <TableCell className="w-16">
                    <Skeleton className="h-14 w-14 rounded" />
                  </TableCell>

                  {/* Item name column */}
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>

                  {/* Type column - badge skeleton */}
                  <TableCell>
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </TableCell>

                  {/* Rarity column - badge skeleton */}
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>

                  {/* Seller column */}
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>

                  {/* Price column */}
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>

                  {/* Actions column - button skeleton */}
                  <TableCell>
                    <Skeleton className="h-9 w-20 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          )}
        </Table>
      </div>

      <div className="max-w-md">
        {/* Search and Filter Controls */}
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              placeholder="Search items by name or seller..."
              value={searchValue}
              onChange={(e) =>
                onSearchChange
                  ? onSearchChange(e.target.value)
                  : setInternalSearchValue(e.target.value)
              }
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
              <SelectTrigger className="w-full bg-secondary/5 text-foreground md:w-[200px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {equipToOptions.map((equipTo) => (
                  <SelectItem key={equipTo} value={equipTo || "consumable"}>
                    {equipTo || "Consumable"}
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
              <SelectTrigger className="w-full bg-secondary/50 md:w-[200px]">
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

            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="gap-2 bg-transparent"
              >
                <X className="h-4 w-4" />
                Reset Filters
              </Button>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {table.getRowModel().rows.length} of {filteredData.length}{" "}
            items
          </span>
          {isLoading && (
            <span className="text-xs italic">Loading listings...</span>
          )}
        </div>
      </div>
    </div>
  );
}
