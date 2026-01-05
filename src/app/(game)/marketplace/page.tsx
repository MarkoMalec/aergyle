"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketplaceDataTable } from "~/components/game/marketplace/marketplaceTableNew";
import type { MarketplaceGroupedResponse } from "~/types/marketplace";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import {
  userQueryKeys,
  marketplaceQueryKeys,
  inventoryQueryKeys,
} from "~/lib/query-keys";

function getErrorMessage(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const maybe = value as { message?: unknown; error?: unknown };
  if (typeof maybe.message === "string") return maybe.message;
  if (typeof maybe.error === "string") return maybe.error;
  return undefined;
}

type BuyMarketplaceResponse = {
  success: boolean;
  message: string;
  itemId: number | null;
  quantity: number;
  seller: string;
  totalPrice: number;
};

export default function MarketplacePage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // Dialog state
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{
    id: number;
    name: string;
    price: number;
  } | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filters (persisted to URL so they are global across pages)
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [equipToFilter, setEquipToFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 });

  // Initialize filters from URL on mount
  useEffect(() => {
    const search = searchParams.get("search");
    if (search) setSearchQuery(search);

    const equipTo = searchParams.get("equipTo");
    if (equipTo) setEquipToFilter(equipTo);

    const rarity = searchParams.get("rarity");
    if (rarity) setRarityFilter(rarity);

    const minPrice = searchParams.get("minPrice");
    if (minPrice) {
      const min = Number(minPrice);
      setPriceRange((r) => ({ ...r, min: Number.isFinite(min) ? min : 0 }));
    }

    const maxPrice = searchParams.get("maxPrice");
    if (maxPrice) {
      const max = Number(maxPrice);
      setPriceRange((r) => ({ ...r, max: Number.isFinite(max) ? max : 100000 }));
    }

    const pageParam = searchParams.get("page");
    if (pageParam) {
      const p = Number(pageParam);
      setPage(Number.isFinite(p) && p > 0 ? p : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters & page to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    if (equipToFilter && equipToFilter !== "all")
      params.set("equipTo", equipToFilter);
    if (rarityFilter && rarityFilter !== "all")
      params.set("rarity", rarityFilter);
    if (priceRange.min && priceRange.min > 0)
      params.set("minPrice", String(priceRange.min));
    if (priceRange.max && priceRange.max < 100000)
      params.set("maxPrice", String(priceRange.max));
    if (page && page > 1) params.set("page", String(page));

    const query = params.toString();
    const search = query ? `?${query}` : "";
    router.replace(`/marketplace${search}`);
  }, [searchQuery, equipToFilter, rarityFilter, priceRange, page, router]);

  // Fetch grouped marketplace rows (one row per item template)
  const { data, isLoading, error } = useQuery<MarketplaceGroupedResponse>({
    queryKey: marketplaceQueryKeys.listings({
      page,
      searchQuery,
      equipToFilter,
      rarityFilter,
      priceRange,
    }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: "price",
        sortOrder: "asc",
      });

      if (searchQuery) params.set("search", searchQuery);
      if (equipToFilter && equipToFilter !== "all")
        params.set("equipTo", equipToFilter);
      if (rarityFilter && rarityFilter !== "all")
        params.set("rarity", rarityFilter);
      if (priceRange.min && priceRange.min > 0)
        params.set("minPrice", String(priceRange.min));
      if (priceRange.max && priceRange.max < 100000)
        params.set("maxPrice", String(priceRange.max));

      const response = await fetch(`/api/marketplace/grouped?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch marketplace listings");
      }
      const json: unknown = await response.json();
      return json as MarketplaceGroupedResponse;
    },
    staleTime: 10000,
  });

  // Buy item mutation
  const buyItemMutation = useMutation<BuyMarketplaceResponse, Error, number>({
    mutationFn: async (userItemId: number) => {
      if (!session?.user?.id) {
        throw new Error("You must be logged in to purchase items");
      }

      const response = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userItemId,
        }),
      });

      if (!response.ok) {
        const errorBody: unknown = await response.json();
        throw new Error(getErrorMessage(errorBody) ?? "Failed to purchase item");
      }

      const json: unknown = await response.json();
      return json as BuyMarketplaceResponse;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: marketplaceQueryKeys.all() });
      void queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() });
      void queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() });

      toast.success(() => (
        <span>
          {data.message} ({data.totalPrice.toFixed(2)}){" "}
          <CoinsIcon />
        </span>
      ));
      setShowBuyDialog(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setShowBuyDialog(false);
      setSelectedItem(null);
    },
  });

  const handleBuyItem = (payload: { id: number; name: string; price: number }) => {
    setSelectedItem(payload);
    setShowBuyDialog(true);
  };

  const confirmBuyItem = () => {
    if (selectedItem) {
      buyItemMutation.mutate(selectedItem.id);
    }
  };

  // Fetch cursor-paginated listings for a specific item
  const handleFetchItemListings = async (
    itemTemplateId: number,
    cursor: string | null,
    rarity?: string,
  ) => {
    const params = new URLSearchParams({
      limit: "5",
    });
    
    if (rarity) params.append("rarity", rarity);

    if (cursor) {
      params.append("cursor", cursor);
    }
    
    const response = await fetch(
      `/api/marketplace/listings/${itemTemplateId}?${params.toString()}`
    );
    
    if (!response.ok) {
      throw new Error("Failed to fetch item listings");
    }
    
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null) {
      throw new Error("Invalid listings response");
    }

    const listings = (data as { listings?: unknown }).listings;
    const hasMore = (data as { hasMore?: unknown }).hasMore;
    const nextCursor = (data as { nextCursor?: unknown }).nextCursor;
    const availableRarities = (data as { availableRarities?: unknown }).availableRarities;

    if (!Array.isArray(listings) || typeof hasMore !== "boolean") {
      throw new Error("Invalid listings response");
    }

    return {
      listings,
      hasMore,
      nextCursor: typeof nextCursor === "string" ? nextCursor : null,
      availableRarities: Array.isArray(availableRarities)
        ? availableRarities.filter((r): r is string => typeof r === "string")
        : undefined,
    };
  };

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return (
      <div className="container mx-auto py-10">
        <div className="text-center text-red-500">
          <p className="text-xl font-semibold">Error loading marketplace</p>
          <p className="mt-2 text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Marketplace</h1>
        <p className="text-muted-foreground">
          Browse and purchase items from other players
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <MarketplaceDataTable
          data={data?.items ?? []}
          isLoading={isLoading}
          currentUserId={session?.user?.id}
          onBuyItem={handleBuyItem}
          onFetchItemListings={handleFetchItemListings}
          searchValue={searchQuery}
          onSearchChange={(v) => {
            setSearchQuery(v);
            setPage(1);
          }}
          equipToFilter={equipToFilter}
          onEquipToFilterChange={(v) => {
            setEquipToFilter(v);
            setPage(1);
          }}
          rarityFilter={rarityFilter}
          onRarityFilterChange={(v) => {
            setRarityFilter(v);
            setPage(1);
          }}
          priceRange={priceRange}
          onPriceRangeChange={(r) => {
            setPriceRange(r);
            setPage(1);
          }}
        />

        {/* Pagination */}
        {data?.pagination && (
          <div className="flex items-center justify-between px-2">
            <div className="text-sm text-muted-foreground">
              Showing page {data.pagination.page}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.pagination.hasPreviousPage}
              >
                Previous
              </Button>
              <Button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.pagination.hasNextPage}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Buy Confirmation Dialog */}
      <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              Are you sure you want to buy{" "}
              <span className="font-semibold">{selectedItem?.name}</span> for{" "}
              <span className="font-semibold text-yellow-600">
                {selectedItem?.price?.toLocaleString()} 🪙
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowBuyDialog(false);
                setSelectedItem(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmBuyItem}
              disabled={buyItemMutation.isPending}
            >
              {buyItemMutation.isPending ? "Purchasing..." : "Confirm Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
