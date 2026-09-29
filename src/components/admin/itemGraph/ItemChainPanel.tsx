"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo } from "react";
import { Network } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useConfirmLeave } from "~/components/admin/leaveGuard";
import { getSkillLabel } from "~/game/crafting";
import type { ItemGraphContent } from "~/game/itemGraph/content";
import {
  defaultDiagnosticOptions,
  describeSource,
  diagnose,
  ISSUE_TYPES,
} from "~/game/itemGraph/diagnostics";
import { buildItemGraph, sourcesOf } from "~/game/itemGraph/graph";
import { buildLens } from "~/game/itemGraph/lens";
import { ROLE_LABELS } from "~/game/itemGraph/taxonomy";
import { cn } from "~/lib/utils";
import { LensCanvas } from "./LensCanvas";
import { ROLE_COLORS, SEVERITY_COLORS, SOURCE_ICONS } from "./parts";

const NONE = new Set<string>();

/** The item's place in the crafting chains, on its admin page. */
export function ItemChainPanel(props: { content: ItemGraphContent; itemId: number }) {
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const graph = useMemo(() => buildItemGraph(props.content), [props.content]);
  const lens = useMemo(
    () => buildLens(graph, props.itemId, { up: 2, down: 1, fanOut: 6, expanded: NONE, collapsed: NONE, showAll: NONE }),
    [graph, props.itemId],
  );
  const issues = useMemo(
    () =>
      diagnose(graph, defaultDiagnosticOptions(graph.items.size)).filter(
        (issue) => issue.itemId === props.itemId || (issue.code === "CYCLE" && issue.related.includes(props.itemId)),
      ),
    [graph, props.itemId],
  );
  const facts = graph.facts.get(props.itemId);
  if (!facts) return null;

  const recipe = graph.recipeByItem.get(props.itemId);
  const sources = sourcesOf(graph, props.itemId);
  const summary = [
    `Tier ${facts.tier}`,
    recipe && recipe.inputs.length > 0
      ? `${getSkillLabel(recipe.skill)} from ${recipe.inputs.length} ingredient${recipe.inputs.length === 1 ? "" : "s"}`
      : null,
    facts.upstream > 0 ? `needs ${facts.upstream} item${facts.upstream === 1 ? "" : "s"} upstream` : null,
    facts.reach > 0 ? `leads to ${facts.reach} item${facts.reach === 1 ? "" : "s"}` : "used by nothing",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="space-y-4 rounded-xl bg-gray-950/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            Crafting chain
            <span
              className="rounded px-1.5 py-0.5 text-[11px] font-medium"
              style={{ background: `color-mix(in srgb, ${ROLE_COLORS[facts.role]} 16%, transparent)`, color: ROLE_COLORS[facts.role] }}
            >
              {ROLE_LABELS[facts.role]}
            </span>
          </h2>
          <p className="mt-1 text-sm text-white/55">{summary}</p>
        </div>
        <Button size="sm" variant="secondary" asChild>
          <Link href={`/admin/item-graph?item=${props.itemId}`}>
            <Network className="h-3.5 w-3.5" /> Open in item graph
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sources.length === 0 ? (
          <span className="rounded-md bg-red-400/10 px-2 py-1 text-xs text-red-300">No source: nothing produces it</span>
        ) : (
          sources.map((source, i) => {
            const Icon = SOURCE_ICONS[source.kind];
            return (
              <span
                key={i}
                className={cn(
                  "flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1 text-xs text-white/75",
                  !source.available && "text-white/40 line-through",
                )}
                title={source.available ? undefined : "Switched off or offered nowhere"}
              >
                <Icon className="h-3.5 w-3.5 text-white/50" />
                {describeSource(graph, source)}
              </span>
            );
          })
        )}
      </div>

      {issues.length > 0 ? (
        <ul className="space-y-1">
          {issues.map((issue, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLORS[issue.severity] }} />
              <span>
                <span className="font-medium text-white/85">{ISSUE_TYPES[issue.code].title}:</span>{" "}
                <span className="text-white/55">{issue.message}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="h-[300px] overflow-hidden rounded-lg bg-black/25">
        <LensCanvas
          compact
          graph={graph}
          lens={lens}
          fitKey={props.itemId}
          selectedKey={null}
          onSelect={(id) => {
            if (id !== null && id !== props.itemId && confirmLeave()) router.push(`/admin/items/${id}`);
          }}
        />
      </div>
      <p className="text-[11px] text-white/40">
        Two steps of what it needs, one of what uses it. Click an item to open it; drag to pan, ⌘ + scroll to zoom.
      </p>
    </section>
  );
}
