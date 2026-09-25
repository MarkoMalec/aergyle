"use client";

import { useDeferredValue, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import type { SearchHit, SearchResults } from "~/app/api/search/route";
import type { NavigationGroup } from "./navigation-links";
import { searchQueryKeys } from "~/lib/query-keys";

const EMPTY: SearchResults = {
  items: [],
  creatures: [],
  npcs: [],
  settlements: [],
};

/**
 * One box for everything: the game's own pages plus items, beasts, NPCs and
 * settlements from the database. Opened from the rail or with Ctrl/Cmd + K.
 */
export function GameSearch({
  groups,
  open,
  onOpenChange,
}: {
  groups: NavigationGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim());

  // Reopening should never show the previous search.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useQuery({
    queryKey: searchQueryKeys.results(search),
    queryFn: async (): Promise<SearchResults> => {
      const response = await fetch(`/api/search?q=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error("Search failed");
      return (await response.json()) as SearchResults;
    },
    enabled: open && search.length >= 2,
    staleTime: 60_000,
  });

  const pages = groups.flatMap((group) =>
    group.links
      .filter((link) => link.label.toLowerCase().includes(search.toLowerCase()))
      .map((link) => ({
        key: `page-${link.href}`,
        label: link.label,
        detail: group.title,
        href: link.href,
        icon: link.icon,
      })),
  );

  const data = results.data ?? EMPTY;
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const hasResults =
    pages.length > 0 ||
    data.items.length > 0 ||
    data.creatures.length > 0 ||
    data.npcs.length > 0 ||
    data.settlements.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl gap-0 overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Search Aergyle</DialogTitle>
        <Command shouldFilter={false} className="bg-transparent">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search pages, items, beasts, NPCs…"
            className="pr-10"
          />
          <CommandList className="max-h-[min(420px,60dvh)]">
            {search.length < 2 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Type at least two letters to search the world.
              </p>
            ) : null}

            {search.length >= 2 && results.isFetching && !hasResults ? (
              <p className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Searching…
              </p>
            ) : null}

            {search.length >= 2 && !results.isFetching && !hasResults ? (
              <CommandEmpty>Nothing matches “{search}”.</CommandEmpty>
            ) : null}

            {pages.length > 0 ? (
              <CommandGroup heading="Pages">
                {pages.map((page) => (
                  <CommandItem
                    key={page.key}
                    value={page.key}
                    onSelect={() => go(page.href)}
                  >
                    <page.icon className="text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{page.label}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {page.detail}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            <HitGroup heading="Items" hits={data.items} onSelect={go} />
            <HitGroup heading="Beasts" hits={data.creatures} onSelect={go} />
            <HitGroup heading="NPCs" hits={data.npcs} onSelect={go} />
            <HitGroup
              heading="Settlements"
              hits={data.settlements}
              onSelect={go}
            />
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function HitGroup({
  heading,
  hits,
  onSelect,
}: {
  heading: string;
  hits: SearchHit[];
  onSelect: (href: string) => void;
}) {
  if (hits.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {hits.map((hit) => (
        <CommandItem
          key={hit.key}
          value={hit.key}
          onSelect={() => onSelect(hit.href)}
        >
          {hit.image ? (
            <Image
              src={hit.image}
              alt=""
              width={48}
              height={48}
              // Items and beasts are square; NPC portraits crop to the head.
              className="h-[22px] w-[22px] shrink-0 rounded object-cover object-top"
            />
          ) : (
            <span className="h-[22px] w-[22px] shrink-0 rounded bg-secondary/60" />
          )}
          <span className="truncate">{hit.label}</span>
          {hit.detail ? (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {hit.detail}
            </span>
          ) : null}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
