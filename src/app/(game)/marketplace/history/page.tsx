"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, History } from "lucide-react";
import type { ItemRarity } from "~/generated/prisma/enums";
import { MarketplaceNav } from "~/components/game/marketplace/MarketplaceNav";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import PageHeading from "~/components/game/ui/PageHeading";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { RarityBadge } from "~/utils/ui/rarity-badge";

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
    queryKey: ["marketplace", "history", page, side],
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
    <div className="min-w-0 space-y-6">
      <PageHeading
        eyebrow="The exchange"
        title="Transaction history"
        description="A permanent record of completed purchases and sales. Open offers are not included."
      />
      <MarketplaceNav />

      <section className="game-panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="game-section-title flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Completed trades
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {query.data?.pagination.count.toLocaleString() ?? 0} lifetime
              records
            </p>
          </div>
          <div className="flex rounded-md bg-surface-inset p-1">
            {(["ALL", "PURCHASE", "SALE"] as const).map((value) => (
              <button
                key={value}
                onClick={() => {
                  setSide(value);
                  setPage(1);
                }}
                className={`rounded px-3 py-1.5 text-xs font-semibold ${side === value ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                {value === "ALL"
                  ? "All"
                  : value === "PURCHASE"
                    ? "Bought"
                    : "Sold"}
              </button>
            ))}
          </div>
        </header>

        {query.isLoading ? (
          <div className="game-empty-state m-4">Loading completed trades…</div>
        ) : query.error ? (
          <div className="game-empty-state m-4 text-danger">
            {query.error.message}
          </div>
        ) : visible.length > 0 ? (
          <div className="divide-y divide-border">
            {visible.map((transaction) => {
              const bought = transaction.side === "PURCHASE";
              return (
                <div
                  key={transaction.id}
                  className="grid gap-3 p-4 sm:grid-cols-[minmax(220px,1fr)_110px_110px_minmax(140px,auto)] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ItemArtwork
                      src={transaction.item.sprite}
                      name={transaction.item.name}
                      rarity={transaction.rarity}
                      size={48}
                      itemId={transaction.item.id}
                    />
                    <div className="min-w-0">
                      <span className="block truncate font-semibold">
                        {transaction.item.name}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <RarityBadge rarity={transaction.rarity} />
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${bought ? "text-currency" : "text-success"}`}
                        >
                          {bought ? (
                            <ArrowDownLeft className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {bought ? "Bought" : "Sold"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-xs text-muted-foreground">
                      Quantity
                    </span>
                    <span className="block font-semibold tabular-nums">
                      {transaction.quantity}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-xs text-muted-foreground">
                      Unit price
                    </span>
                    <span className="block font-semibold tabular-nums">
                      {transaction.unitPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-xs text-muted-foreground">
                      {bought ? "Paid" : "Received after tax"}
                    </span>
                    <span
                      className={`block font-semibold tabular-nums ${bought ? "text-currency" : "text-success"}`}
                    >
                      <CoinsIcon size={14} />{" "}
                      {(bought
                        ? transaction.grossAmount
                        : transaction.netAmount
                      ).toLocaleString()}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {new Date(transaction.executedAt).toLocaleString()}
                      {!bought && transaction.taxAmount > 0
                        ? ` · ${transaction.taxAmount.toLocaleString()} tax`
                        : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="game-empty-state m-4">
            {`No completed ${side === "ALL" ? "trades" : side === "PURCHASE" ? "purchases" : "sales"}.`}
          </div>
        )}
      </section>

      {query.data && query.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {query.data.pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!query.data.pagination.hasPreviousPage}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!query.data.pagination.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
