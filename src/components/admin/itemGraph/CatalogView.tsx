"use client";

import React, { useMemo, useState } from "react";
import { ArrowDown, Crosshair, Search } from "lucide-react";
import { inputClass } from "~/components/admin/fields";
import type { IssueSeverity } from "~/game/itemGraph/diagnostics";
import { matchesFilters, type GraphFilters } from "~/game/itemGraph/filters";
import type { ItemGraph } from "~/game/itemGraph/graph";
import { CATEGORY_LABELS, ROLE_LABELS } from "~/game/itemGraph/taxonomy";
import { cn } from "~/lib/utils";
import { ItemArt, productionLabel, ROLE_COLORS, SEVERITY_COLORS, SourceIcons } from "./parts";

type SortKey = "reach" | "upstream" | "tier" | "uses" | "name";

const SORTS: Array<{ key: SortKey; label: string; title: string }> = [
  { key: "reach", label: "Leads to", title: "Items it eventually helps make: the hubs come first" },
  { key: "upstream", label: "Needs", title: "Distinct items somewhere upstream" },
  { key: "tier", label: "Tier", title: "Crafting depth" },
  { key: "uses", label: "Used by", title: "Direct recipes, quests and projects" },
  { key: "name", label: "Name", title: "A to Z" },
];

const PAGE = 150;

/** Every item with its place in the economy; sorted by reach, the hubs lead. */
export function CatalogView(props: {
  graph: ItemGraph;
  filters: GraphFilters;
  severity: Map<number, IssueSeverity>;
  issueCount: Map<number, number>;
  selectedId: number | null;
  onSelect: (itemId: number) => void;
  onFocus: (itemId: number) => void;
}) {
  const { graph } = props;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("reach");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...graph.items.values()].filter(
      (item) =>
        (!q || item.name.toLowerCase().includes(q) || String(item.id) === q) &&
        matchesFilters(graph, item.id, props.filters) &&
        (!onlyIssues || (props.issueCount.get(item.id) ?? 0) > 0),
    );
    const value = (id: number) => {
      const f = graph.facts.get(id)!;
      return sort === "reach" ? f.reach : sort === "upstream" ? f.upstream : sort === "tier" ? f.tier : f.usedBy + f.otherUses;
    };
    return list.sort((a, b) =>
      sort === "name" ? a.name.localeCompare(b.name) : value(b.id) - value(a.id) || a.name.localeCompare(b.name),
    );
  }, [graph, query, sort, onlyIssues, props.filters, props.issueCount]);

  const maxReach = Math.max(1, ...rows.map((item) => graph.facts.get(item.id)!.reach));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-4 text-xs text-white/60">
        <label className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            className={cn(inputClass, "py-1.5 pl-8")}
            placeholder="Filter by name or #id"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-amber-400" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
          With issues only
        </label>
        <span className="ml-auto tabular-nums">
          {rows.length} of {graph.items.size} items
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        <table className="w-full border-separate border-spacing-y-0.5 text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#0d1216] text-white/45">
            <tr>
              <th className="py-2 pl-2 font-medium">Item</th>
              <th className="font-medium">Made by</th>
              <th className="font-medium">Sources</th>
              {SORTS.filter((s) => s.key !== "name").map((s) => (
                <th key={s.key} className="pr-3 text-right font-medium">
                  <button
                    type="button"
                    title={s.title}
                    onClick={() => setSort(s.key)}
                    className={cn("inline-flex items-center gap-0.5 hover:text-white", sort === s.key && "text-amber-200")}
                  >
                    {s.label}
                    {sort === s.key ? <ArrowDown className="h-3 w-3" /> : null}
                  </button>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((item) => {
              const f = graph.facts.get(item.id)!;
              const sev = props.severity.get(item.id);
              return (
                <tr
                  key={item.id}
                  onClick={() => props.onSelect(item.id)}
                  onDoubleClick={() => props.onFocus(item.id)}
                  className={cn(
                    "group cursor-pointer bg-white/[0.025] hover:bg-white/[0.06]",
                    props.selectedId === item.id && "bg-white/[0.09]",
                  )}
                >
                  <td className="rounded-l-md py-1.5 pl-2">
                    <span className="flex items-center gap-2.5">
                      <ItemArt item={item} size={28} />
                      <span className="min-w-0">
                        <span className="block max-w-[220px] truncate text-[13px] text-white/90">{item.name}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-white/40">
                          <span className="h-2 w-2 rounded-sm" style={{ background: ROLE_COLORS[f.role] }} />
                          {ROLE_LABELS[f.role]} · {CATEGORY_LABELS[f.category]}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="text-white/60">{productionLabel(graph, item.id)}</td>
                  <td>
                    <SourceIcons graph={graph} itemId={item.id} />
                  </td>
                  <td className="pr-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                        <span className="block h-full rounded-full bg-amber-300/70" style={{ width: `${(f.reach / maxReach) * 100}%` }} />
                      </span>
                      <span className="w-7 tabular-nums text-white/85">{f.reach}</span>
                    </span>
                  </td>
                  <td className="pr-3 text-right tabular-nums text-white/70">{f.upstream}</td>
                  <td className="pr-3 text-right tabular-nums text-white/70">T{f.tier}</td>
                  <td className="pr-3 text-right tabular-nums text-white/70">{f.usedBy + f.otherUses}</td>
                  <td className="rounded-r-md pr-2 text-right">
                    <span className="inline-flex items-center gap-1.5">
                      {sev && sev !== "info" ? (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: SEVERITY_COLORS[sev] }}
                          title={`${props.issueCount.get(item.id)} issue(s)`}
                        />
                      ) : null}
                      <button
                        type="button"
                        title="Focus in the graph"
                        aria-label="Focus in the graph"
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onFocus(item.id);
                        }}
                        className="grid h-6 w-6 place-items-center rounded text-white/40 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100"
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > limit ? (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="mt-2 w-full rounded-md bg-white/[0.04] py-2 text-xs text-white/60 hover:bg-white/[0.08] hover:text-white"
          >
            Show {Math.min(PAGE, rows.length - limit)} more
          </button>
        ) : null}
      </div>
    </div>
  );
}
