"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  type Column,
  type ColumnDef,
  type SortingState,
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
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { timeAgo } from "~/game/communication";
import { cn } from "~/lib/utils";
import type { AdminPlayerRow } from "~/server/admin/players";

const gold = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function PlayerAvatar(props: {
  name: string | null;
  image: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-9 w-9", props.className)}>
      {/* Only this site's images pass the CSP; Discord pictures fall back. */}
      {props.image?.startsWith("/") ? (
        <AvatarImage src={props.image} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback className="bg-white/10 text-xs font-semibold text-white/70">
        {(props.name ?? "?").slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function SortableHeader({
  column,
  label,
  align = "left",
}: {
  column: Column<AdminPlayerRow, unknown>;
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

const RIGHT = new Set(["level", "gold", "items"]);

export function PlayersDataTable({ data }: { data: AdminPlayerRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const columns = React.useMemo<ColumnDef<AdminPlayerRow>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name ?? "",
        header: ({ column }) => <SortableHeader column={column} label="Player" />,
        cell: ({ row }) => (
          <Link
            href={`/admin/players/${row.original.id}`}
            className="group flex min-w-[220px] items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <PlayerAvatar name={row.original.name} image={row.original.image} />
            <span className="min-w-0">
              <span className="block truncate font-semibold group-hover:text-primary group-hover:underline">
                {row.original.name ?? "Unnamed"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {row.original.email ?? "No email"}
              </span>
            </span>
          </Link>
        ),
      },
      {
        accessorKey: "level",
        header: ({ column }) => (
          <SortableHeader column={column} label="Level" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.original.level}</div>
        ),
      },
      {
        accessorKey: "gold",
        header: ({ column }) => (
          <SortableHeader column={column} label="Gold" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-amber-200">
            {gold.format(row.original.gold)}
          </div>
        ),
      },
      {
        id: "location",
        accessorFn: (row) => row.location ?? "",
        header: ({ column }) => (
          <SortableHeader column={column} label="Location" />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-foreground/85">
            {row.original.location ?? "—"}
          </span>
        ),
      },
      {
        id: "activity",
        accessorFn: (row) => row.activity ?? "",
        header: ({ column }) => (
          <SortableHeader column={column} label="Doing" />
        ),
        cell: ({ row }) =>
          row.original.activity ? (
            <span className="whitespace-nowrap rounded bg-sky-400/10 px-1.5 py-0.5 text-xs text-sky-200">
              {row.original.activity}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Idle</span>
          ),
      },
      {
        accessorKey: "items",
        header: ({ column }) => (
          <SortableHeader column={column} label="Stacks" align="right" />
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums">{row.original.items}</div>
        ),
      },
      {
        id: "signIn",
        accessorFn: (row) => row.signIn.join(", "),
        header: () => (
          <span className="text-xs font-semibold text-muted-foreground">
            Sign-in
          </span>
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs capitalize text-foreground/75">
            {row.original.signIn.join(" · ") || "None"}
          </span>
        ),
      },
      {
        accessorKey: "lastOnline",
        header: ({ column }) => (
          <SortableHeader column={column} label="Last online" />
        ),
        cell: ({ row }) => (
          <span
            className="whitespace-nowrap text-xs text-foreground/75"
            title={new Date(row.original.lastOnline).toLocaleString()}
          >
            {timeAgo(row.original.lastOnline)}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, value) => {
      const query = String(value).trim().toLowerCase();
      if (!query) return true;
      const player = row.original;
      return [player.name, player.email, player.id, player.location]
        .filter(Boolean)
        .some((text) => text!.toLowerCase().includes(query));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 50 } },
  });

  const filtered = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search name, email, ID or location…"
            className="h-9 pl-9 pr-9"
            aria-label="Search players"
          />
          {globalFilter ? (
            <button
              type="button"
              onClick={() => setGlobalFilter("")}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          <strong className="font-semibold text-foreground">
            {filtered.toLocaleString()}
          </strong>{" "}
          of {data.length.toLocaleString()} players
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg bg-card/20">
        <Table className="min-w-[980px]">
          <TableHeader className="bg-card">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap px-4",
                      RIGHT.has(header.column.id) && "text-right",
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
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/players/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center text-sm text-muted-foreground"
                >
                  No players match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {pageCount}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
