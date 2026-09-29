"use client";

import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { Chip, Segmented } from "~/components/admin/balance/ui";
import { inputClass, NumberInput } from "~/components/admin/fields";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import type { VocationalActionType } from "~/generated/prisma/enums";
import { getSkillLabel } from "~/game/crafting";
import type { ItemGraphContent } from "~/game/itemGraph/content";
import {
  defaultDiagnosticOptions,
  diagnose,
  type DiagnosticOptions,
  type Issue,
  type IssueSeverity,
} from "~/game/itemGraph/diagnostics";
import {
  activeFilterCount,
  linkMatchesFilters,
  matchesFilters,
  NO_FILTERS,
  type GraphFilters,
} from "~/game/itemGraph/filters";
import { buildItemGraph } from "~/game/itemGraph/graph";
import { branchKey, buildLens, itemKey, LENS_DEFAULTS, MAX_LENS_DEPTH, type LensSide } from "~/game/itemGraph/lens";
import {
  CATEGORY_LABELS,
  ROLE_LABELS,
  SKILL_COLORS,
  SOURCE_KINDS,
  type ItemCategory,
  type ItemRole,
} from "~/game/itemGraph/taxonomy";
import { cn } from "~/lib/utils";
import { CatalogView } from "./CatalogView";
import { Inspector } from "./Inspector";
import { IssuesView } from "./IssuesView";
import { ItemSearch } from "./ItemSearch";
import { LensCanvas } from "./LensCanvas";
import { ItemArt } from "./parts";
import { TreeView } from "./TreeView";

const VIEWS = ["graph", "tree", "catalog", "issues"] as const;
type ViewId = (typeof VIEWS)[number];

const SEVERITY_RANK: Record<IssueSeverity, number> = { error: 3, warning: 2, info: 1 };
/** Issues that concern every item they name, not only the first. */
const SHARED_ISSUES = new Set(["CYCLE", "DUPLICATE_RECIPE", "SIMILAR_RECIPE"]);

function readDepth(value: string | null, fallback: number) {
  const n = Number(value);
  return value !== null && Number.isInteger(n) ? Math.min(MAX_LENS_DEPTH, Math.max(0, n)) : fallback;
}

/**
 * /admin/item-graph: the whole item economy explored one item at a time.
 * The URL holds the focus, view and depths, so Back and shared links work;
 * it changes through history.pushState, without a server round trip.
 */
export function ItemGraphExplorer(props: { content: ItemGraphContent }) {
  const graph = useMemo(() => buildItemGraph(props.content), [props.content]);
  const searchParams = useSearchParams();
  const focusParam = Number(searchParams.get("item"));
  const focusId = searchParams.get("item") !== null && graph.items.has(focusParam) ? focusParam : null;
  const view: ViewId = VIEWS.find((id) => id === searchParams.get("view")) ?? "graph";
  const up = readDepth(searchParams.get("up"), LENS_DEFAULTS.up);
  const down = readDepth(searchParams.get("down"), LENS_DEFAULTS.down);

  const writeUrl = useCallback((patch: Record<string, string | number | null>, push: boolean) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, String(value));
    }
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [fanOut, setFanOut] = useState<number>(LENS_DEFAULTS.fanOut);
  const [filters, setFilters] = useState<GraphFilters>(NO_FILTERS);
  const [diagOptions, setDiagOptions] = useState<DiagnosticOptions>(() =>
    defaultDiagnosticOptions(props.content.items.length),
  );
  const [trail, setTrail] = useState<number[]>([]);

  // A new focus starts a fresh lens and joins the breadcrumbs.
  useEffect(() => {
    setSelectedId(null);
    setExpanded(new Set());
    setCollapsed(new Set());
    setShowAll(new Set());
    if (focusId === null) return;
    setTrail((current) => {
      const at = current.indexOf(focusId);
      return at >= 0 ? current.slice(0, at + 1) : [...current, focusId].slice(-8);
    });
  }, [focusId]);

  const issues = useMemo(() => diagnose(graph, diagOptions), [graph, diagOptions]);
  const { issuesByItem, severity, issueCount } = useMemo(() => {
    const byItem = new Map<number, Issue[]>();
    for (const issue of issues) {
      const ids = SHARED_ISSUES.has(issue.code) ? [issue.itemId, ...issue.related] : [issue.itemId];
      for (const id of ids) byItem.set(id, [...(byItem.get(id) ?? []), issue]);
    }
    const worst = new Map<number, IssueSeverity>();
    const count = new Map<number, number>();
    for (const [id, list] of byItem) {
      count.set(id, list.length);
      worst.set(id, list.reduce<IssueSeverity>((w, i) => (SEVERITY_RANK[i.severity] > SEVERITY_RANK[w] ? i.severity : w), "info"));
    }
    return { issuesByItem: byItem, severity: worst, issueCount: count };
  }, [issues]);

  const filtering = activeFilterCount(filters) > 0;
  const hidden = useMemo(
    () => (filtering && filters.mode === "hide" ? (id: number) => !matchesFilters(graph, id, filters) : undefined),
    [graph, filters, filtering],
  );
  const lens = useMemo(
    () =>
      focusId === null
        ? null
        : buildLens(graph, focusId, { up, down, expanded, collapsed, showAll, fanOut, hidden }),
    [graph, focusId, up, down, expanded, collapsed, showAll, fanOut, hidden],
  );

  const focus = useCallback(
    (itemId: number) => {
      writeUrl({ item: itemId, view: view === "tree" ? "tree" : null }, true);
    },
    [view, writeUrl],
  );
  const setDepth = (side: LensSide, value: number) =>
    writeUrl({ [side]: Math.min(MAX_LENS_DEPTH, Math.max(0, value)) }, false);

  const onBranch = (side: LensSide, itemId: number, open: boolean) => {
    if (itemId === focusId) {
      if (open) setDepth(side, (side === "up" ? up : down) + 1);
      return;
    }
    const key = branchKey(side, itemId);
    const without = (set: Set<string>) => {
      const next = new Set(set);
      next.delete(key);
      return next;
    };
    if (open) {
      setCollapsed(without);
      setExpanded((set) => new Set(set).add(key));
    } else {
      setExpanded(without);
      setCollapsed((set) => new Set(set).add(key));
    }
  };

  const inspectedId = selectedId ?? focusId;
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const graphSkills = useMemo(
    () => [...new Set([...graph.facts.values()].flatMap((f) => f.skills))].sort(),
    [graph],
  );

  const viewOptions = [
    { value: "graph" as const, label: "Graph" },
    { value: "tree" as const, label: "Bill of materials" },
    { value: "catalog" as const, label: "Catalog" },
    { value: "issues" as const, label: `Issues${errorCount ? ` · ${errorCount}` : ""}`, title: `${issues.length} findings, ${errorCount} errors` },
  ];

  return (
    <div className="flex h-[calc(100svh-6.5rem)] min-h-[620px] flex-col gap-3">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Item graph</h1>
          <p className="text-sm text-white/55">
            {graph.items.size} items · {graph.recipes.size} recipes · {graph.links.length} links. Where each item comes
            from, what it needs and what it leads to.
          </p>
        </div>
        <ItemSearch
          graph={graph}
          onPick={(id) => writeUrl({ item: id, view: view === "tree" ? "tree" : null }, true)}
        />
        <Segmented
          label="View"
          value={view}
          options={viewOptions}
          onChange={(next) => writeUrl({ view: next === "graph" ? null : next }, false)}
        />
      </header>

      {view === "graph" || view === "tree" || view === "catalog" ? (
        <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
          {view !== "catalog" ? (
            <nav aria-label="Focus history" className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
              {trail.map((id, i) => {
                const item = graph.items.get(id);
                if (!item) return null;
                const current = id === focusId;
                return (
                  <React.Fragment key={id}>
                    {i > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25" /> : null}
                    <button
                      type="button"
                      onClick={() => !current && focus(id)}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-w-0 shrink items-center gap-1.5 rounded-md px-1.5 py-1 text-xs",
                        current ? "bg-white/[0.07] font-semibold text-white" : "text-white/50 hover:text-white",
                      )}
                    >
                      <ItemArt item={item} size={18} className="p-0" />
                      <span className="truncate">{item.name}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>
          ) : (
            <div className="flex-1" />
          )}
          {view === "graph" && focusId !== null ? (
            <>
              <DepthStepper label="Needs" value={up} onChange={(v) => setDepth("up", v)} />
              <DepthStepper label="Leads to" value={down} onChange={(v) => setDepth("down", v)} />
            </>
          ) : null}
          {view !== "tree" ? (
            <FilterPopover
              filters={filters}
              onChange={setFilters}
              skills={graphSkills}
              fanOut={view === "graph" ? fanOut : null}
              onFanOut={setFanOut}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3">
        <main className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-gray-950/45">
          {view === "catalog" ? (
            <CatalogView
              graph={graph}
              filters={filters}
              severity={severity}
              issueCount={issueCount}
              selectedId={inspectedId}
              onSelect={setSelectedId}
              onFocus={(id) => writeUrl({ item: id, view: null }, true)}
            />
          ) : view === "issues" ? (
            <IssuesView
              graph={graph}
              issues={issues}
              options={diagOptions}
              onOptionsChange={setDiagOptions}
              selectedId={inspectedId}
              onSelect={setSelectedId}
              onFocus={(id) => writeUrl({ item: id, view: null }, true)}
            />
          ) : focusId === null || !lens ? (
            <StartHere graph={graph} errors={errorCount} onPick={focus} onIssues={() => writeUrl({ view: "issues" }, false)} />
          ) : view === "tree" ? (
            <TreeView key={focusId} graph={graph} itemId={focusId} selectedId={selectedId} onSelect={setSelectedId} onFocus={focus} />
          ) : (
            <LensCanvas
              graph={graph}
              lens={lens}
              fitKey={focusId}
              selectedKey={selectedId !== null ? itemKey(selectedId) : null}
              onSelect={setSelectedId}
              onFocus={focus}
              onBranch={onBranch}
              onShowAll={(side, parentId) => setShowAll((set) => new Set(set).add(branchKey(side, parentId)))}
              isDimmed={filtering && filters.mode === "dim" ? (id) => !matchesFilters(graph, id, filters) : undefined}
              isEdgeDimmed={
                filters.skills.length > 0 && filters.mode === "dim" ? (link) => !linkMatchesFilters(link, filters) : undefined
              }
              severity={severity}
            />
          )}
        </main>
        {inspectedId !== null ? (
          <aside className="w-[380px] shrink-0 overflow-y-auto rounded-xl bg-gray-950/45 p-4">
            <Inspector
              key={inspectedId}
              graph={graph}
              itemId={inspectedId}
              focusId={focusId}
              issues={issuesByItem.get(inspectedId) ?? []}
              onSelect={setSelectedId}
              onFocus={(id) => writeUrl({ item: id, view: view === "tree" ? "tree" : null }, true)}
              onShowTree={(id) => writeUrl({ item: id, view: "tree" }, true)}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function DepthStepper(props: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-white/55" title={`How many steps of "${props.label.toLowerCase()}" to show`}>
      {props.label}
      <span className="flex items-center rounded-md bg-black/25">
        <button
          type="button"
          aria-label={`Fewer steps: ${props.label}`}
          disabled={props.value <= 0}
          onClick={() => props.onChange(props.value - 1)}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/10 disabled:opacity-30"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-4 text-center font-semibold tabular-nums text-white">{props.value}</span>
        <button
          type="button"
          aria-label={`More steps: ${props.label}`}
          disabled={props.value >= MAX_LENS_DEPTH}
          onClick={() => props.onChange(props.value + 1)}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/10 disabled:opacity-30"
        >
          <Plus className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterPopover(props: {
  filters: GraphFilters;
  onChange: (filters: GraphFilters) => void;
  skills: VocationalActionType[];
  /** Neighbours shown per branch before "+N more"; null outside the graph. */
  fanOut: number | null;
  onFanOut: (value: number) => void;
}) {
  const f = props.filters;
  const set = (patch: Partial<GraphFilters>) => props.onChange({ ...f, ...patch });
  const count = activeFilterCount(f);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
            count > 0 ? "bg-amber-400/15 text-amber-100" : "bg-black/25 text-white/60 hover:text-white",
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters{count > 0 ? ` · ${count}` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <Segmented
            label="Filter mode"
            value={f.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: "dim", label: "Dim others", title: "Keep the whole chain, fade what doesn't match" },
              { value: "hide", label: "Hide others", title: "Stop the graph at items that don't match" },
            ]}
          />
          <button type="button" onClick={() => props.onChange({ ...NO_FILTERS, mode: f.mode })} className="text-xs text-white/50 hover:text-white">
            Clear
          </button>
        </div>
        <FilterGroup label="Skill">
          {props.skills.map((skill) => (
            <Chip key={skill} on={f.skills.includes(skill)} onChange={() => set({ skills: toggle(f.skills, skill) })}>
              <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: SKILL_COLORS[skill] }} />
              {getSkillLabel(skill)}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="How it's obtained">
          {SOURCE_KINDS.map(({ kind, label }) => (
            <Chip key={kind} on={f.sources.includes(kind)} onChange={() => set({ sources: toggle(f.sources, kind) })}>
              {label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="Category">
          {(Object.keys(CATEGORY_LABELS) as ItemCategory[]).map((category) => (
            <Chip key={category} on={f.categories.includes(category)} onChange={() => set({ categories: toggle(f.categories, category) })}>
              {CATEGORY_LABELS[category]}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="Role">
          {(Object.keys(ROLE_LABELS) as ItemRole[]).map((role) => (
            <Chip key={role} on={f.roles.includes(role)} onChange={() => set({ roles: toggle(f.roles, role) })}>
              {ROLE_LABELS[role]}
            </Chip>
          ))}
        </FilterGroup>
        <div className="flex items-end gap-3">
          <label className="space-y-1 text-xs text-white/55">
            <span className="block">Tier from</span>
            <NumberInput className={cn(inputClass, "w-20 py-1")} min={0} value={f.tierMin} onValueChange={(v) => set({ tierMin: Math.max(0, v ?? 0) })} />
          </label>
          <label className="space-y-1 text-xs text-white/55">
            <span className="block">to</span>
            <NumberInput className={cn(inputClass, "w-20 py-1")} min={0} value={f.tierMax} placeholder="any" onValueChange={(v) => set({ tierMax: v === null ? null : Math.max(0, v) })} />
          </label>
          {props.fanOut !== null ? (
            <label className="ml-auto space-y-1 text-xs text-white/55" title='Neighbours per item before a "+N more" node'>
              <span className="block">Per branch</span>
              <select className={cn(inputClass, "w-20 py-1")} value={props.fanOut} onChange={(e) => props.onFanOut(Number(e.target.value))}>
                {[4, 6, 8, 12, 20, 40].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterGroup(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-white/55">{props.label}</div>
      <div className="flex flex-wrap gap-1.5">{props.children}</div>
    </div>
  );
}

/** No focus yet: good places to start. */
function StartHere(props: {
  graph: ReturnType<typeof buildItemGraph>;
  errors: number;
  onPick: (itemId: number) => void;
  onIssues: () => void;
}) {
  const { graph } = props;
  const facts = [...graph.facts];
  const hubs = [...facts].sort((a, b) => b[1].reach - a[1].reach).slice(0, 8);
  const complex = [...facts].sort((a, b) => b[1].upstream - a[1].upstream || b[1].tier - a[1].tier).slice(0, 8);
  const group = (title: string, hint: string, list: typeof facts) => (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/40" title={hint}>
        {title}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {list.map(([id, f]) => {
          const item = graph.items.get(id)!;
          return (
            <button
              key={id}
              type="button"
              onClick={() => props.onPick(id)}
              className="flex items-center gap-2 rounded-lg bg-white/[0.04] py-1 pl-1 pr-2.5 text-xs text-white/80 hover:bg-white/[0.09] hover:text-white"
            >
              <ItemArt item={item} size={24} />
              {item.name}
              <span className="tabular-nums text-white/35">{title === "Biggest hubs" ? f.reach : f.upstream}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-8">
      <div className="max-w-2xl space-y-7 text-center">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Pick an item to explore</h2>
          <p className="text-sm text-white/50">
            Search with ⌘K, or start from one of these. Needs spread to the left, uses to the right.
          </p>
        </div>
        {group("Biggest hubs", "Items that the most other items eventually depend on", hubs)}
        {group("Longest chains", "Items needing the most distinct items upstream", complex)}
        {props.errors > 0 ? (
          <button type="button" onClick={props.onIssues} className="text-sm text-red-300 hover:text-red-200">
            {props.errors} structural errors found → review issues
          </button>
        ) : null}
      </div>
    </div>
  );
}
