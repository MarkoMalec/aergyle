"use client";

import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Copy,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { ItemRarity } from "~/generated/prisma/enums";
import { cn } from "~/lib/utils";
import { rarityStyle } from "~/utils/rarity-colors";

export type ItemTableRow = {
  id: number;
  name: string;
  sprite: string;
  price: number;
  rarity: ItemRarity;
  itemType: string | null;
  equipTo: string | null;
  stackable: boolean;
  maxStackSize: number;
  requiredLevel: number | null;
};

type FilterOption = {
  value: string;
  label: string;
  count: number;
};

type NumberRange = [number | undefined, number | undefined];

const RARITY_ORDER: ItemRarity[] = [
  "WORTHLESS",
  "BROKEN",
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EXQUISITE",
  "EPIC",
  "ELITE",
  "UNIQUE",
  "LEGENDARY",
  "MYTHIC",
  "DIVINE",
];

const columnLabels: Record<string, string> = {
  name: "Item",
  rarity: "Rarity",
  itemType: "Type",
  equipTo: "Equip slot",
  requiredLevel: "Level",
  price: "Price",
  stack: "Stack",
  id: "ID",
};

const humanize = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (character) => character.toUpperCase());

const globalItemFilter: FilterFn<ItemTableRow> = (
  row,
  _columnId,
  filterValue,
) => {
  const query = String(filterValue).trim().toLowerCase();
  if (!query) return true;

  const item = row.original;
  const normalizedId = query.replace(/^#/, "");
  return (
    item.name.toLowerCase().includes(query) ||
    String(item.id).includes(normalizedId) ||
    item.rarity.toLowerCase().includes(query) ||
    item.itemType?.toLowerCase().includes(query) === true ||
    item.equipTo?.toLowerCase().includes(query) === true
  );
};

const multiSelectFilter: FilterFn<ItemTableRow> = (
  row,
  columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true;
  const value = String(row.getValue(columnId));
  return filterValue.includes(value);
};

const stackFilter: FilterFn<ItemTableRow> = (
  row,
  _columnId,
  filterValue: string[],
) => {
  if (!filterValue.length) return true;
  const value = row.original.stackable ? "stackable" : "single";
  return filterValue.includes(value);
};

const numberRangeFilter: FilterFn<ItemTableRow> = (
  row,
  columnId,
  filterValue: NumberRange,
) => {
  const [minimum, maximum] = filterValue;
  const value = Number(row.getValue(columnId));
  return (
    (minimum === undefined || value >= minimum) &&
    (maximum === undefined || value <= maximum)
  );
};

function SortableHeader({
  column,
  label,
  align = "left",
}: {
  column: Column<ItemTableRow, unknown>;
  label: string;
  align?: "left" | "right";
}) {
  const direction = column.getIsSorted();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-3 h-8 px-3 text-muted-foreground hover:text-foreground",
        align === "right" && "-mr-3 ml-auto",
      )}
      onClick={column.getToggleSortingHandler()}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      {direction === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : direction === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
      )}
    </Button>
  );
}

function FacetedFilter({
  column,
  title,
  options,
  searchable = true,
}: {
  column: Column<ItemTableRow, unknown> | undefined;
  title: string;
  options: FilterOption[];
  searchable?: boolean;
}) {
  const selected = new Set(
    (column?.getFilterValue() as string[] | undefined) ?? [],
  );

  const toggleOption = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    column?.setFilterValue(next.size ? Array.from(next) : undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9">
          <PlusCircle className="h-4 w-4 text-muted-foreground" />
          {title}
          {selected.size > 0 && (
            <>
              <span className="mx-0.5 h-4 w-px bg-border" />
              <Badge
                variant="secondary"
                className="h-5 min-w-5 justify-center px-1.5 tabular-nums"
              >
                {selected.size}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-0">
        <Command>
          {searchable && (
            <CommandInput placeholder={`Search ${title.toLowerCase()}…`} />
          )}
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggleOption(option.value)}
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 place-items-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "text-transparent",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {option.count}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selected.size > 0 && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full font-normal"
                onClick={() => column?.setFilterValue(undefined)}
              >
                Clear {title.toLowerCase()}
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <Input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? undefined : Number(event.target.value),
          )
        }
        className="h-9 text-foreground"
        placeholder="Any"
      />
    </label>
  );
}

function RangeFilters({
  levelColumn,
  priceColumn,
}: {
  levelColumn: Column<ItemTableRow, unknown> | undefined;
  priceColumn: Column<ItemTableRow, unknown> | undefined;
}) {
  const level =
    (levelColumn?.getFilterValue() as NumberRange | undefined) ?? [];
  const price =
    (priceColumn?.getFilterValue() as NumberRange | undefined) ?? [];
  const hasRanges = [...level, ...price].some((value) => value !== undefined);

  const setRange = (
    column: Column<ItemTableRow, unknown> | undefined,
    range: NumberRange,
  ) => {
    column?.setFilterValue(
      range.every((value) => value === undefined) ? undefined : range,
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Ranges
          {hasRanges && <span className="h-2 w-2 rounded-full bg-primary" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] space-y-4">
        <div>
          <p className="text-sm font-semibold">Level range</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <RangeInput
              label="Minimum"
              value={level[0]}
              onChange={(value) => setRange(levelColumn, [value, level[1]])}
            />
            <RangeInput
              label="Maximum"
              value={level[1]}
              onChange={(value) => setRange(levelColumn, [level[0], value])}
            />
          </div>
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-semibold">Price range</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <RangeInput
              label="Minimum"
              value={price[0]}
              onChange={(value) => setRange(priceColumn, [value, price[1]])}
            />
            <RangeInput
              label="Maximum"
              value={price[1]}
              onChange={(value) => setRange(priceColumn, [price[0], value])}
            />
          </div>
        </div>
        {hasRanges && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              levelColumn?.setFilterValue(undefined);
              priceColumn?.setFilterValue(undefined);
            }}
          >
            Clear ranges
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function makeOptions(
  values: Array<string | null>,
  emptyValue: string,
  emptyLabel: string,
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value ?? emptyValue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts, ([value, count]) => ({
    value,
    count,
    label: value === emptyValue ? emptyLabel : humanize(value),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

const formatNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

export function ItemsDataTable({ data }: { data: ItemTableRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "id", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const columns = React.useMemo<ColumnDef<ItemTableRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader column={column} label="Item" />,
        cell: ({ row }) => (
          <Link
            href={`/admin/items/${row.original.id}`}
            className="group flex min-w-[220px] items-center gap-3"
          >
            <span
              className="rarity-frame relative grid h-11 w-11 shrink-0 place-items-center rounded-lg p-1"
              data-rarity={row.original.rarity}
              style={rarityStyle(row.original.rarity)}
            >
              <Image
                src={row.original.sprite}
                alt=""
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-foreground group-hover:text-primary group-hover:underline">
                {row.original.name}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground lg:hidden">
                {row.original.itemType
                  ? humanize(row.original.itemType)
                  : "Uncategorized"}
              </span>
            </span>
          </Link>
        ),
      },
      {
        accessorKey: "rarity",
        header: ({ column }) => (
          <SortableHeader column={column} label="Rarity" />
        ),
        sortingFn: (rowA, rowB) =>
          RARITY_ORDER.indexOf(rowA.original.rarity) -
          RARITY_ORDER.indexOf(rowB.original.rarity),
        filterFn: multiSelectFilter,
        cell: ({ row }) => (
          <span
            className="rarity-badge inline-flex border font-semibold capitalize"
            style={rarityStyle(row.original.rarity)}
            data-rarity={row.original.rarity}
          >
            {row.original.rarity.toLowerCase()}
          </span>
        ),
      },
      {
        id: "itemType",
        accessorFn: (row) => row.itemType ?? "UNCATEGORIZED",
        header: ({ column }) => <SortableHeader column={column} label="Type" />,
        filterFn: multiSelectFilter,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-foreground/85">
            {row.original.itemType ? humanize(row.original.itemType) : "—"}
          </span>
        ),
      },
      {
        id: "equipTo",
        accessorFn: (row) => row.equipTo ?? "NOT_EQUIPPABLE",
        header: ({ column }) => (
          <SortableHeader column={column} label="Equip slot" />
        ),
        filterFn: multiSelectFilter,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-foreground/85">
            {row.original.equipTo ? humanize(row.original.equipTo) : "—"}
          </span>
        ),
      },
      {
        id: "requiredLevel",
        accessorFn: (row) => row.requiredLevel ?? 1,
        header: ({ column }) => (
          <SortableHeader column={column} label="Level" align="right" />
        ),
        filterFn: numberRangeFilter,
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-foreground/85">
            {row.original.requiredLevel ?? 1}
          </div>
        ),
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <SortableHeader column={column} label="Price" align="right" />
        ),
        filterFn: numberRangeFilter,
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-foreground/85">
            {formatNumber.format(row.original.price)}
          </div>
        ),
      },
      {
        id: "stack",
        accessorFn: (row) => (row.stackable ? row.maxStackSize : 1),
        header: ({ column }) => (
          <SortableHeader column={column} label="Stack" align="right" />
        ),
        filterFn: stackFilter,
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-foreground/85">
            {row.original.stackable
              ? formatNumber.format(row.original.maxStackSize)
              : "—"}
          </div>
        ),
      },
      {
        accessorKey: "id",
        header: ({ column }) => (
          <SortableHeader column={column} label="ID" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono text-xs text-muted-foreground">
            #{row.original.id}
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Actions for ${row.original.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/items/${row.original.id}`}>
                    <Pencil className="h-4 w-4" />
                    Edit item
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    void navigator.clipboard.writeText(String(row.original.id))
                  }
                >
                  <Copy className="h-4 w-4" />
                  Copy item ID
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: globalItemFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 25 },
    },
  });

  const typeOptions = React.useMemo(
    () =>
      makeOptions(
        data.map((item) => item.itemType),
        "UNCATEGORIZED",
        "Uncategorized",
      ),
    [data],
  );
  const equipOptions = React.useMemo(
    () =>
      makeOptions(
        data.map((item) => item.equipTo),
        "NOT_EQUIPPABLE",
        "Not equippable",
      ),
    [data],
  );
  const rarityOptions = React.useMemo(() => {
    const counts = new Map<ItemRarity, number>();
    for (const item of data) {
      counts.set(item.rarity, (counts.get(item.rarity) ?? 0) + 1);
    }
    return RARITY_ORDER.filter((rarity) => counts.has(rarity)).map(
      (rarity) => ({
        value: rarity,
        label: humanize(rarity),
        count: counts.get(rarity) ?? 0,
      }),
    );
  }, [data]);
  const stackOptions = React.useMemo<FilterOption[]>(() => {
    const stackable = data.filter((item) => item.stackable).length;
    return [
      { value: "stackable", label: "Stackable", count: stackable },
      { value: "single", label: "Single item", count: data.length - stackable },
    ];
  }, [data]);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const activeFilterCount = columnFilters.length;
  const pageCount = Math.max(table.getPageCount(), 1);
  const pageIndex = table.getState().pagination.pageIndex;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card/35 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative w-full xl:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              placeholder="Search name, ID, type, slot, or rarity…"
              className="h-9 pl-9 pr-9"
              aria-label="Search items"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setGlobalFilter("")}
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            <FacetedFilter
              column={table.getColumn("itemType")}
              title="Type"
              options={typeOptions}
            />
            <FacetedFilter
              column={table.getColumn("rarity")}
              title="Rarity"
              options={rarityOptions}
              searchable={false}
            />
            <FacetedFilter
              column={table.getColumn("equipTo")}
              title="Equip slot"
              options={equipOptions}
            />
            <FacetedFilter
              column={table.getColumn("stack")}
              title="Stacking"
              options={stackOptions}
              searchable={false}
            />
            <RangeFilters
              levelColumn={table.getColumn("requiredLevel")}
              priceColumn={table.getColumn("price")}
            />

            {(activeFilterCount > 0 || globalFilter) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={() => {
                  setColumnFilters([]);
                  setGlobalFilter("");
                }}
              >
                Clear all
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 self-start xl:self-auto"
              >
                <Columns3 className="h-4 w-4 text-muted-foreground" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(Boolean(value))
                    }
                  >
                    {columnLabels[column.id] ?? humanize(column.id)}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span>
            <strong className="font-semibold text-foreground">
              {filteredCount.toLocaleString()}
            </strong>{" "}
            of {data.length.toLocaleString()} items
          </span>
          {activeFilterCount > 0 && (
            <span>
              {activeFilterCount} active filter
              {activeFilterCount === 1 ? "" : "s"}
            </span>
          )}
          <span className="hidden sm:inline">
            Click any column heading to sort.
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card/20">
        <Table className="min-w-[980px]">
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap px-4",
                      [
                        "requiredLevel",
                        "price",
                        "stack",
                        "id",
                        "actions",
                      ].includes(header.column.id) && "text-right",
                    )}
                  >
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-52 text-center"
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Search className="h-4 w-4" />
                    </span>
                    <p className="font-medium text-foreground">
                      No items found
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try a different search or clear some filters.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1"
                      onClick={() => {
                        setColumnFilters([]);
                        setGlobalFilter("");
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[72px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <span className="min-w-[100px] text-center text-sm text-muted-foreground">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="hidden h-8 w-8 sm:inline-flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="hidden h-8 w-8 sm:inline-flex"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
