"use client";

import React, { useMemo, useState } from "react";
import { ChevronRight, Repeat } from "lucide-react";
import { inputClass, NumberInput } from "~/components/admin/fields";
import { billOfMaterials, type BomRow } from "~/game/itemGraph/bom";
import type { ItemGraph } from "~/game/itemGraph/graph";
import { cn } from "~/lib/utils";
import { formatDuration, formatNumber, ItemArt, SkillLabel, SourceIcons } from "./parts";

const INDENT = 18;

/**
 * The same item as an indented bill of materials: what one branch needs,
 * with totals that craft shared intermediates once.
 */
export function TreeView(props: {
  graph: ItemGraph;
  itemId: number;
  selectedId: number | null;
  onSelect: (itemId: number) => void;
  onFocus: (itemId: number) => void;
}) {
  const { graph } = props;
  const [quantity, setQuantity] = useState(1);
  const bom = useMemo(() => billOfMaterials(graph, props.itemId, quantity), [graph, props.itemId, quantity]);
  const rowCount = useMemo(() => countRows(bom.root), [bom]);
  // Big trees open two levels deep; small ones open fully.
  const [collapsed, setCollapsed] = useState<Set<string> | null>(null);
  const closed = useMemo(
    () => collapsed ?? (rowCount > 120 ? new Set(keysDeeperThan(bom.root, 2)) : new Set<string>()),
    [collapsed, rowCount, bom],
  );
  const rows = useMemo(() => visibleRows(bom.root, closed), [bom, closed]);
  const { totals } = bom;
  const root = graph.items.get(props.itemId)!;

  const toggle = (key: string) => {
    const next = new Set(closed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
  };

  if (!bom.root.recipe) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-white/55">
        <div className="max-w-sm space-y-2">
          <ItemArt item={root} size={48} className="mx-auto" />
          <p>
            {root.name} isn&apos;t crafted, so it has no bill of materials. Its sources are listed in the inspector.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 pb-3 pt-4 text-xs text-white/60">
        <label className="flex items-center gap-2">
          Make
          <NumberInput
            className={cn(inputClass, "w-20 py-1 text-right")}
            min={1}
            max={100000}
            value={quantity}
            onValueChange={(v) => setQuantity(Math.min(100000, Math.max(1, Math.round(v ?? 1))))}
          />
          × {root.name}
        </label>
        <button type="button" className="hover:text-white" onClick={() => setCollapsed(new Set())}>
          Expand all
        </button>
        <button type="button" className="hover:text-white" onClick={() => setCollapsed(new Set(keysDeeperThan(bom.root, 0)))}>
          Collapse all
        </button>
        {totals.truncated ? <span className="text-amber-300">Tree cut at {formatNumber(rowCount)} rows; totals are complete.</span> : null}
      </div>

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4">
        <div className="min-w-0 flex-1 overflow-y-auto pr-1" role="tree" aria-label={`Bill of materials for ${root.name}`}>
          {rows.map((row) => (
            <TreeRow
              key={row.key}
              graph={graph}
              row={row}
              open={!closed.has(row.key)}
              shared={(totals.occurrences.get(row.itemId) ?? 0) > 1}
              selected={row.itemId === props.selectedId}
              onToggle={() => toggle(row.key)}
              onSelect={() => props.onSelect(row.itemId)}
              onFocus={() => props.onFocus(row.itemId)}
            />
          ))}
        </div>

        <aside className="w-72 shrink-0 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-1.5">
            <Tile label="Crafting steps" value={totals.steps} />
            <Tile label="Deepest branch" value={totals.depth} />
          </div>
          <TotalsBlock title="Raw materials">
            {totals.materials.map((material) => {
              const item = graph.items.get(material.itemId)!;
              return (
                <button
                  key={material.itemId}
                  type="button"
                  onClick={() => props.onSelect(material.itemId)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/[0.05]"
                >
                  <ItemArt item={item} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-white/85">{item.name}</span>
                    <SourceIcons graph={graph} itemId={item.id} />
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-white">×{formatNumber(material.quantity)}</span>
                </button>
              );
            })}
          </TotalsBlock>
          <TotalsBlock title="Work by skill" hint="Base time, before tool efficiency">
            {totals.skills.map((skill) => (
              <div key={skill.skill} className="flex items-center justify-between gap-2 px-1.5 py-1 text-xs">
                <SkillLabel skill={skill.skill} level={skill.highestLevel} className="text-white/80" />
                <span className="text-right tabular-nums text-white/55">
                  {formatNumber(skill.crafts)} crafts · {formatDuration(skill.seconds)}
                  <span className="block text-[11px] text-white/35">{formatNumber(skill.xp)} XP</span>
                </span>
              </div>
            ))}
          </TotalsBlock>
          {totals.unlocks.length > 0 ? (
            <TotalsBlock title="Recipes to learn">
              {totals.unlocks.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => props.onSelect(id)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs text-white/80 hover:bg-white/[0.05]"
                >
                  <ItemArt item={graph.items.get(id)!} size={22} />
                  {graph.items.get(id)?.name}
                </button>
              ))}
            </TotalsBlock>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function TreeRow(props: {
  graph: ItemGraph;
  row: BomRow;
  open: boolean;
  shared: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onFocus: () => void;
}) {
  const { row } = props;
  const item = props.graph.items.get(row.itemId)!;
  const hasChildren = row.children.length > 0;
  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? props.open : undefined}
      aria-selected={props.selected}
      onClick={props.onSelect}
      onDoubleClick={props.onFocus}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md py-1 pr-2 text-[13px] hover:bg-white/[0.05]",
        props.selected && "bg-white/[0.08]",
      )}
      style={{
        paddingLeft: row.depth * INDENT + 4,
        backgroundImage: row.depth > 0 ? "repeating-linear-gradient(to right, rgba(255,255,255,0.07) 0 1px, transparent 1px 18px)" : undefined,
        backgroundSize: `${row.depth * INDENT}px 100%`,
        backgroundPosition: "12px 0",
        backgroundRepeat: "no-repeat",
      }}
    >
      <button
        type="button"
        aria-label={props.open ? "Collapse" : "Expand"}
        onClick={(event) => {
          event.stopPropagation();
          props.onToggle();
        }}
        className={cn("grid h-5 w-5 shrink-0 place-items-center rounded text-white/50 hover:text-white", !hasChildren && "invisible")}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", props.open && "rotate-90")} />
      </button>
      <ItemArt item={item} size={24} />
      <span className="min-w-0 truncate text-white/90">{item.name}</span>
      {props.shared ? (
        <span className="shrink-0 rounded bg-sky-400/10 px-1 text-[10px] font-medium text-sky-200" title="Also needed by other branches">
          shared
        </span>
      ) : null}
      {row.cycle ? (
        <span className="flex shrink-0 items-center gap-0.5 rounded bg-red-400/15 px-1 text-[10px] font-medium text-red-300" title="Already needed further up: a circular dependency">
          <Repeat className="h-3 w-3" /> circular
        </span>
      ) : null}
      <span className="flex-1" />
      <span className="shrink-0 font-semibold tabular-nums text-white">×{formatNumber(row.quantity)}</span>
      <span className="w-40 shrink-0 truncate text-right text-[11px] text-white/45">
        {row.recipe ? (
          <>
            {row.crafts} × <SkillLabel skill={row.recipe.skill} level={row.recipe.requiredSkillLevel} />
          </>
        ) : (
          <SourceIcons graph={props.graph} itemId={row.itemId} />
        )}
      </span>
    </div>
  );
}

function TotalsBlock(props: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45" title={props.hint}>
        {props.title}
      </h3>
      <div className="rounded-lg bg-white/[0.03] p-1">{props.children}</div>
    </section>
  );
}

function Tile(props: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/[0.04] px-2.5 py-1.5">
      <div className="text-[11px] text-white/45">{props.label}</div>
      <div className="text-base font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

function countRows(row: BomRow): number {
  return 1 + row.children.reduce((sum, child) => sum + countRows(child), 0);
}

function keysDeeperThan(root: BomRow, depth: number) {
  const keys: string[] = [];
  const walk = (row: BomRow) => {
    if (row.depth >= depth && row.children.length > 0) keys.push(row.key);
    row.children.forEach(walk);
  };
  walk(root);
  return keys;
}

function visibleRows(root: BomRow, closed: Set<string>) {
  const rows: BomRow[] = [];
  const walk = (row: BomRow) => {
    rows.push(row);
    if (!closed.has(row.key)) row.children.forEach(walk);
  };
  walk(root);
  return rows;
}
