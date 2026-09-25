"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketplaceNav } from "~/components/game/marketplace/MarketplaceNav";
import { MarketplaceDataTable } from "~/components/game/marketplace/marketplaceTable";
import PageHeading from "~/components/game/ui/PageHeading";
import { Button } from "~/components/ui/button";
import { MARKET_DEFAULT_MAX_PRICE } from "~/lib/marketplace";
import { marketplaceQueryKeys } from "~/lib/query-keys";
import type { MarketplaceGroupedResponse } from "~/types/marketplace";

export default function MarketplacePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(() =>
    Math.max(1, Number(searchParams.get("page")) || 1),
  );
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [itemType, setItemType] = useState(
    searchParams.get("itemType") ?? "all",
  );
  const [rarity, setRarity] = useState(searchParams.get("rarity") ?? "all");
  const [priceRange, setPriceRange] = useState({
    min: Math.max(0, Number(searchParams.get("minPrice")) || 0),
    max:
      Math.max(0, Number(searchParams.get("maxPrice"))) ||
      MARKET_DEFAULT_MAX_PRICE,
  });
  const [sort, setSort] = useState(searchParams.get("sort") ?? "price-asc");
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (itemType !== "all") params.set("itemType", itemType);
    if (rarity !== "all") params.set("rarity", rarity);
    if (priceRange.min > 0) params.set("minPrice", String(priceRange.min));
    if (priceRange.max < MARKET_DEFAULT_MAX_PRICE) {
      params.set("maxPrice", String(priceRange.max));
    }
    if (sort !== "price-asc") params.set("sort", sort);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    router.replace(query ? `/marketplace?${query}` : "/marketplace", {
      scroll: false,
    });
  }, [itemType, page, priceRange, rarity, router, search, sort]);

  const [sortBy, sortOrder] = sort.split("-") as [string, "asc" | "desc"];
  const query = useQuery<MarketplaceGroupedResponse>({
    queryKey: marketplaceQueryKeys.listings({
      page,
      search: deferredSearch,
      itemType,
      rarity,
      priceRange,
      sort,
    }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "40",
        sortBy,
        sortOrder,
      });
      if (deferredSearch) params.set("search", deferredSearch);
      if (itemType !== "all") params.set("itemType", itemType);
      if (rarity !== "all") params.set("rarity", rarity);
      if (priceRange.min > 0) params.set("minPrice", String(priceRange.min));
      if (priceRange.max < MARKET_DEFAULT_MAX_PRICE) {
        params.set("maxPrice", String(priceRange.max));
      }

      const response = await fetch(
        `/api/marketplace/grouped?${params.toString()}`,
      );
      if (!response.ok) throw new Error("The exchange could not be loaded");
      return response.json() as Promise<MarketplaceGroupedResponse>;
    },
    staleTime: 10_000,
  });

  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <div className="min-w-0 space-y-4">
      <PageHeading
        eyebrow="The exchange"
        title="Marketplace"
        description="Trade directly with other wayfarers. Compare exact offers, place patient bids, and make decisions from completed sales—not advertised prices."
      />
      <MarketplaceNav />

      {query.error ? (
        <div className="game-empty-state game-panel-flat border-0 text-danger">
          <p className="font-semibold">Could not load the marketplace</p>
          <p className="mt-1 text-sm">{query.error.message}</p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <MarketplaceDataTable
          data={query.data?.items ?? []}
          isLoading={query.isLoading}
          currentUserId={session?.user?.id}
          pagination={query.data?.pagination}
          onPageChange={(next) => setPage(Math.max(1, next))}
          filterOptions={query.data?.filterOptions}
          searchValue={search}
          onSearchChange={resetPage(setSearch)}
          itemTypeFilter={itemType}
          onItemTypeFilterChange={resetPage(setItemType)}
          rarityFilter={rarity}
          onRarityFilterChange={resetPage(setRarity)}
          priceRange={priceRange}
          onPriceRangeChange={resetPage(setPriceRange)}
          sortValue={sort}
          onSortChange={resetPage(setSort)}
        />
      )}
    </div>
  );
}
