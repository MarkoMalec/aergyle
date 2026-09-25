"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ItemRarity } from "~/generated/prisma/enums";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { RarityBadge } from "~/utils/ui/rarity-badge";

// The Browse results layout, shared by every marketplace table: a flat panel
// with a titled header, a quiet column row and borderless tinted rows.

export function MarketTable({
  title,
  meta,
  action,
  className,
  children,
  ...props
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <section
      className={cn("game-panel-flat min-w-0 overflow-hidden", className)}
      {...props}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2 px-4 pb-1.5 pt-3.5">
        <h2 className="game-section-title text-base">{title}</h2>
        <div className="flex items-baseline gap-3">
          {meta != null && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {meta}
            </span>
          )}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

export function MarketTableHead({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-[2] bg-card px-2.5 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MarketTableRow({
  active = false,
  className,
  children,
}: {
  active?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] px-2.5 py-2 transition-colors",
        active ? "bg-sidebar-accent" : "hover:bg-secondary/45",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Artwork, name and rarity; `name` replaces the plain title (e.g. a row button), `children` sit beside the rarity. */
export function MarketItemCell({
  item,
  name,
  children,
}: {
  item: { id: number; name: string; sprite: string; rarity: ItemRarity };
  name?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ItemArtwork
        src={item.sprite}
        name={item.name}
        rarity={item.rarity}
        size={48}
        itemId={item.id}
      />
      <div className="min-w-0">
        {name ?? (
          <span className="block truncate font-semibold">{item.name}</span>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <RarityBadge
            rarity={item.rarity}
            className="border-0 px-1.5 py-0.5 text-[11px]"
          />
          {children}
        </div>
      </div>
    </div>
  );
}

export function MarketTableSkeleton({ rows = 8 }: { rows?: number }) {
  return Array.from({ length: rows }, (_, index) => (
    <div key={index} className="flex items-center gap-3 px-2.5 py-2">
      <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-12" />
    </div>
  ));
}

export function MarketTableEmpty({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="game-empty-state m-1 border-0 bg-surface-inset/60">
      {icon}
      <p className="font-medium text-foreground">{title}</p>
      {children}
    </div>
  );
}

export function MarketTablePagination({
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
}: {
  page: number;
  totalPages?: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}) {
  if (!hasPreviousPage && !hasNextPage) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="text-xs tabular-nums text-muted-foreground">
        Page {page}
        {totalPages ? ` of ${totalPages}` : ""}
      </span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPreviousPage}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
