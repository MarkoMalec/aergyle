"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { ItemGraph } from "~/game/itemGraph/graph";
import { ROLE_LABELS } from "~/game/itemGraph/taxonomy";
import { ItemArt, productionLabel } from "./parts";

const RESULTS = 60;

/** Find any item and focus it. ⌘K or / opens it from anywhere on the page. */
export function ItemSearch(props: { graph: ItemGraph; onPick: (itemId: number) => void }) {
  const { graph } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]");
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // cmdk would score every item on each keystroke; a plain prefix-first
  // match over names stays instant with thousands of them.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = [...graph.items.values()];
    if (!q) {
      return items
        .sort((a, b) => (graph.facts.get(b.id)?.reach ?? 0) - (graph.facts.get(a.id)?.reach ?? 0))
        .slice(0, 12);
    }
    const scored: Array<[number, (typeof items)[number]]> = [];
    for (const item of items) {
      const name = item.name.toLowerCase();
      const at = name.indexOf(q);
      if (at >= 0) scored.push([at === 0 ? 0 : name.includes(` ${q}`) ? 1 : 2, item]);
      else if (String(item.id) === q) scored.push([0, item]);
    }
    return scored
      .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
      .slice(0, RESULTS)
      .map(([, item]) => item);
  }, [graph, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-72 items-center gap-2 rounded-md bg-black/25 px-3 text-sm text-white/45 ring-1 ring-white/10 hover:text-white/70"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Find an item…</span>
          <kbd className="rounded bg-white/10 px-1.5 text-[10px] text-white/50">⌘K</kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Item name or #id" value={query} onValueChange={setQuery} className="h-10" />
          <CommandList className="max-h-[420px]">
            <CommandEmpty>No item matches.</CommandEmpty>
            <CommandGroup heading={query.trim() ? undefined : "Biggest hubs"}>
              {results.map((item) => {
                const facts = graph.facts.get(item.id)!;
                return (
                  <CommandItem
                    key={item.id}
                    value={String(item.id)}
                    onSelect={() => {
                      props.onPick(item.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="gap-2.5"
                  >
                    <ItemArt item={item} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.name}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-white/45">
                        T{facts.tier} · {ROLE_LABELS[facts.role]} · {productionLabel(graph, item.id)}
                      </span>
                    </span>
                    <span className="text-[11px] tabular-nums text-white/40" title="Leads to">
                      {facts.reach}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
