"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import type { ItemRarity } from "~/generated/prisma/enums";
import { MarketplaceNav } from "~/components/game/marketplace/MarketplaceNav";
import {
  MarketItemCell,
  MarketTable,
  MarketTableEmpty,
  MarketTableHead,
  MarketTablePagination,
  MarketTableRow,
  MarketTableSkeleton,
} from "~/components/game/marketplace/MarketTable";
import PageHeading from "~/components/game/ui/PageHeading";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { marketplaceQueryKeys } from "~/lib/query-keys";
import { cn } from "~/lib/utils";

const columns =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_56px_80px_112px_88px]";
const wideCell = "hidden text-right tabular-nums sm:block";

interface HistoryTransaction {
  id: number;
  side: "PURCHASE" | "SALE";
  rarity: ItemRarity;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
  source: "BUY_NOW" | "SELL_NOW";
  executedAt: string;
  item: { id: number; name: string; sprite: string };
  buyer: { name: string | null } | null;
  seller: { name: string | null } | null;
}

interface HistoryResponse {
  transactions: HistoryTransaction[];
  pagination: {
    page: number;
    count: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export default function MarketplaceHistoryPage() {
  const [page, setPage] = useState(1);
  const [side, setSide] = useState<"ALL" | "PURCHASE" | "SALE">("ALL");
  const query = useQuery<HistoryResponse>({
    queryKey: marketplaceQueryKeys.history(page, side),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page) });
      if (side !== "ALL") params.set("side", side);
      const response = await fetch(
        `/api/marketplace/history?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Could not load transaction history");
      return response.json() as Promise<HistoryResponse>;
    },
    staleTime: 10_000,
  });
  const visible = query.data?.transactions ?? [];

  return (
    <div className="min-w-0 space-y-4">
      <PageHeading
        eyebrow="The exchange"
        title="Transaction history"
        description="A permanent record of completed purchases and sales. Open offers are not included."
      />
      <MarketplaceNav />

      <MarketTable
        title={
          <span className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Completed trades
          </span>
        }
        meta={`${query.data?.pagination.count.toLocaleString() ?? 0} records`}
        action={
          <div className="flex rounded-md bg-surface-inset p-1">
            {(["ALL", "PURCHASE", "SALE"] as const).map((value) => (
              <button
                key={value}
                onClick={() => {
                  setSide(value);
                  setPage(1);
                }}
                className={`rounded px-3 py-1 text-xs font-semibold ${side === value ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                {value === "ALL"
                  ? "All"
                  : value === "PURCHASE"
                    ? "Bought"
                    : "Sold"}
              </button>
            ))}
          </div>
        }
      >
        <div className="px-1.5 pb-1.5">
          <MarketTableHead className={cn(columns, "hidden sm:grid")}>
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price each</span>
            <span className="text-right">Total</span>
            <span className="text-right">When</span>
          </MarketTableHead>

          {query.isLoading ? (
            <MarketTableSkeleton />
          ) : query.error ? (
            <MarketTableEmpty title={query.error.message} />
          ) : visible.length > 0 ? (
            visible.map((transaction) => {
              const bought = transaction.side === "PURCHASE";
              const executedAt = new Date(transaction.executedAt);
              return (
                <MarketTableRow key={transaction.id} className={columns}>
                  <MarketItemCell
                    item={{ ...transaction.item, rarity: transaction.rarity }}
                  >
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] ${bought ? "text-currency" : "text-success"}`}
                    >
                      {bought ? (
                        <ArrowDownLeft className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {bought ? "Bought" : "Sold"}
                    </span>
                  </MarketItemCell>
                  <span className={cn(wideCell, "text-sm")}>
                    {transaction.quantity.toLocaleString()}
                  </span>
                  <span className={cn(wideCell, "text-sm")}>
                    {transaction.unitPrice.toLocaleString()}
                  </span>
                  <span
                    className={`text-right font-semibold tabular-nums ${bought ? "text-currency" : "text-success"}`}
                  >
                    <CoinsIcon size={14} />{" "}
                    {(bought
                      ? transaction.grossAmount
                      : transaction.netAmount
                    ).toLocaleString()}
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {bought
                        ? "paid"
                        : transaction.taxAmount > 0
                          ? `after ${transaction.taxAmount.toLocaleString()} tax`
                          : "received"}
                    </span>
                  </span>
                  <span className={cn(wideCell, "text-xs")}>
                    {executedAt.toLocaleDateString()}
                    <span className="block text-[10px] text-muted-foreground">
                      {executedAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </MarketTableRow>
              );
            })
          ) : (
            <MarketTableEmpty
              title={`No completed ${side === "ALL" ? "trades" : side === "PURCHASE" ? "purchases" : "sales"}.`}
            />
          )}
        </div>

        {query.data && (
          <MarketTablePagination
            page={page}
            totalPages={query.data.pagination.totalPages}
            hasPreviousPage={query.data.pagination.hasPreviousPage}
            hasNextPage={query.data.pagination.hasNextPage}
            onPageChange={(next) => setPage(Math.max(1, next))}
          />
        )}
      </MarketTable>
    </div>
  );
}
