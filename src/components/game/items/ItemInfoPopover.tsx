"use client";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { ItemRarity } from "~/generated/prisma/enums";
import { itemQueryKeys } from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import {
  ItemDetails,
  ItemDetailsPopoverContent,
  type ItemDetailsData,
} from "./ItemDetails";

// Item templates only change through the admin panel, so a loaded card stays good.
const ITEM_DETAILS_STALE_MS = 10 * 60_000;

function itemDetailsQuery(itemId: number, rarity: ItemRarity) {
  return queryOptions({
    queryKey: itemQueryKeys.details(itemId, rarity),
    queryFn: async (): Promise<ItemDetailsData> => {
      const response = await fetch(`/api/items/${itemId}?rarity=${rarity}`);
      if (!response.ok) throw new Error("Could not load item details");
      return (await response.json()) as ItemDetailsData;
    },
    staleTime: ITEM_DETAILS_STALE_MS,
  });
}

// Mounted only while the popup is open, so closed triggers never fetch.
function LoadedItemDetails(props: { itemId: number; rarity: ItemRarity }) {
  const query = useQuery(itemDetailsQuery(props.itemId, props.rarity));

  if (query.data) return <ItemDetails item={query.data} />;
  if (query.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t load this item.
      </p>
    );
  }
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-6 w-40" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

/**
 * Makes an item image open its details card on click (the same card as the
 * inventory, without actions), leaving the image's look unchanged. Details load
 * when first opened, are prefetched on hover, and are cached per item and rarity.
 */
export function ItemInfoPopover({
  itemId,
  rarity,
  name,
  tooltip,
  className,
  children,
}: {
  /** Item template id. */
  itemId: number;
  rarity: ItemRarity;
  name: string;
  /** Hover hint kept alongside the popup (needs a TooltipProvider above). */
  tooltip?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const prefetch = () =>
    void queryClient.prefetchQuery(itemDetailsQuery(itemId, rarity));

  const trigger = (
    <PopoverTrigger asChild>
      <button
        type="button"
        className={cn("game-item-info-trigger", className)}
        aria-label={`${name}, ${rarity.toLowerCase()}. Item details`}
        onPointerEnter={prefetch}
        onFocus={prefetch}
      >
        {children}
      </button>
    </PopoverTrigger>
  );

  return (
    <Popover>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <ItemDetailsPopoverContent name={name} rarity={rarity}>
        <LoadedItemDetails itemId={itemId} rarity={rarity} />
      </ItemDetailsPopoverContent>
    </Popover>
  );
}
