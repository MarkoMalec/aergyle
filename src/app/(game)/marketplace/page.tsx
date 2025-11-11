"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketplaceDataTable } from "~/components/game/marketplace/marketplaceTable";
import type { MarketplaceResponse } from "~/types/marketplace";
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
    const sp = Object.fromEntries(Array.from(searchParams.entries()));
    if (sp.search) setSearchQuery(sp.search);
    if (sp.equipTo) setEquipToFilter(sp.equipTo);
    if (sp.rarity) setRarityFilter(sp.rarity);
    if (sp.minPrice)
      setPriceRange((r) => ({ ...r, min: Number(sp.minPrice) || 0 }));
    if (sp.maxPrice)
      setPriceRange((r) => ({ ...r, max: Number(sp.maxPrice) || 100000 }));
    if (sp.page) setPage(Number(sp.page) || 1);
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

  // Fetch marketplace listings
  const { data, isLoading, error } = useQuery<MarketplaceResponse>({
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

      const response = await fetch(`/api/marketplace?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch marketplace listings");
      }
      return response.json();
    },
    staleTime: 10000,
  });

  // Buy item mutation
  const buyItemMutation = useMutation({
    mutationFn: async (userItemId: number) => {
      if (!session?.user?.id) {
        throw new Error("You must be logged in to purchase items");
      }

      const response = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: session.user.id,
          userItemId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to purchase item");
      }

      return response.json();
    },
    onSuccess: (data: {
      item: { itemTemplate: { name: string } };
      price: number;
    }) => {
      queryClient.invalidateQueries({ queryKey: marketplaceQueryKeys.all() });
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() });

      toast.success((t) => (
        <span>
          You bought {data.item.itemTemplate.name} for {data.price}{" "}
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

  const handleBuyItem = (userItemId: number) => {
    const item = data?.listings.find((listing) => listing.id === userItemId);
    if (item) {
      setSelectedItem({
        id: item.id,
        name: item.itemTemplate.name,
        price: item.listedPrice || 0,
      });
      setShowBuyDialog(true);
    }
  };

  const confirmBuyItem = () => {
    if (selectedItem) {
      buyItemMutation.mutate(selectedItem.id);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="text-center text-red-500">
          <p className="text-xl font-semibold">Error loading marketplace</p>
          <p className="mt-2 text-sm">{(error as Error).message}</p>
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
          data={data?.listings ?? []}
          isLoading={isLoading}
          currentUserId={session?.user?.id}
          onBuyItem={(itemId) => handleBuyItem(itemId)}
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
              Showing page {data.pagination.page} of{" "}
              {data.pagination.totalPages}({data.pagination.totalCount} total
              items)
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
