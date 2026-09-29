"use client";

import React, { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Field, inputClass, NumberInput } from "~/components/admin/fields";
import { Segmented } from "~/components/admin/balance/ui";
import {
  ISSUE_TYPES,
  type DiagnosticOptions,
  type Issue,
  type IssueCode,
  type IssueSeverity,
} from "~/game/itemGraph/diagnostics";
import type { ItemGraph } from "~/game/itemGraph/graph";
import { cn } from "~/lib/utils";
import { ItemArt, SEVERITY_COLORS } from "./parts";

const GROUP_LIMIT = 60;

/** Structural checks, grouped by kind. Select a row to inspect and fix it. */
export function IssuesView(props: {
  graph: ItemGraph;
  issues: Issue[];
  options: DiagnosticOptions;
  onOptionsChange: (options: DiagnosticOptions) => void;
  selectedId: number | null;
  onSelect: (itemId: number) => void;
  onFocus: (itemId: number) => void;
}) {
  const { graph } = props;
  const [severity, setSeverity] = useState<IssueSeverity | "all">("all");
  const [closed, setClosed] = useState<Set<IssueCode>>(new Set());
  const [expanded, setExpanded] = useState<Set<IssueCode>>(new Set());

  const counts = useMemo(() => {
    const result: Record<IssueSeverity, number> = { error: 0, warning: 0, info: 0 };
    for (const issue of props.issues) result[issue.severity] += 1;
    return result;
  }, [props.issues]);

  const groups = useMemo(() => {
    const byCode = new Map<IssueCode, Issue[]>();
    for (const issue of props.issues) {
      if (severity !== "all" && issue.severity !== severity) continue;
      byCode.set(issue.code, [...(byCode.get(issue.code) ?? []), issue]);
    }
    return [...byCode];
  }, [props.issues, severity]);

  const name = (id: number) => graph.items.get(id)?.name ?? `#${id}`;
  const setOption = (patch: Partial<DiagnosticOptions>) => props.onOptionsChange({ ...props.options, ...patch });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-end gap-4 px-4 pb-3 pt-4">
        <Segmented
          label="Severity"
          value={severity}
          onChange={setSeverity}
          options={[
            { value: "all", label: `All ${props.issues.length}` },
            { value: "error", label: `Errors ${counts.error}` },
            { value: "warning", label: `Warnings ${counts.warning}` },
            { value: "info", label: `Notes ${counts.info}` },
          ]}
        />
        <div className="ml-auto flex items-end gap-3">
          <Field label="Deep chain above" className="w-28">
            <NumberInput className={cn(inputClass, "py-1")} min={1} value={props.options.maxTier} onValueChange={(v) => setOption({ maxTier: Math.max(1, v ?? 1) })} />
          </Field>
          <Field label="Similar at %" className="w-24">
            <NumberInput
              className={cn(inputClass, "py-1")}
              min={10}
              max={99}
              value={Math.round(props.options.similarity * 100)}
              onValueChange={(v) => setOption({ similarity: Math.min(0.99, Math.max(0.1, (v ?? 75) / 100)) })}
            />
          </Field>
          <Field label="Bottleneck reach" className="w-28">
            <NumberInput className={cn(inputClass, "py-1")} min={1} value={props.options.bottleneckReach} onValueChange={(v) => setOption({ bottleneckReach: Math.max(1, v ?? 1) })} />
          </Field>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {groups.length === 0 ? <p className="py-10 text-center text-sm text-white/45">Nothing to report.</p> : null}
        {groups.map(([code, list]) => {
          const open = !closed.has(code);
          const shown = expanded.has(code) ? list : list.slice(0, GROUP_LIMIT);
          const worst = list[0]!.severity;
          return (
            <section key={code} className="rounded-lg bg-white/[0.025]">
              <button
                type="button"
                onClick={() => {
                  const next = new Set(closed);
                  if (open) next.add(code);
                  else next.delete(code);
                  setClosed(next);
                }}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
              >
                <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0 text-white/40 transition-transform", open && "rotate-90")} />
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLORS[worst] }} />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-white/90">
                    {ISSUE_TYPES[code].title}
                    <span className="ml-2 tabular-nums text-white/40">{list.length}</span>
                  </span>
                  <span className="block text-xs text-white/45">{ISSUE_TYPES[code].description}</span>
                </span>
              </button>
              {open ? (
                <div className="space-y-0.5 px-2 pb-2">
                  {shown.map((issue, i) => {
                    const item = graph.items.get(issue.itemId);
                    return (
                      <div
                        key={`${issue.itemId}-${i}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => props.onSelect(issue.itemId)}
                        onDoubleClick={() => props.onFocus(issue.itemId)}
                        onKeyDown={(event) => event.key === "Enter" && props.onSelect(issue.itemId)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white/[0.05]",
                          props.selectedId === issue.itemId && "bg-white/[0.08]",
                        )}
                      >
                        {item ? <ItemArt item={item} size={26} /> : <span className="h-[26px] w-[26px]" />}
                        <span className="w-64 shrink-0 truncate text-[13px] text-white/90">{name(issue.itemId)}</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-white/55" title={issue.message}>
                          {issue.message}
                        </span>
                        {issue.severity !== worst ? (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide" style={{ color: SEVERITY_COLORS[issue.severity] }}>
                            {issue.severity}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {list.length > shown.length ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(new Set(expanded).add(code))}
                      className="w-full rounded-md py-1.5 text-xs text-white/50 hover:bg-white/[0.05] hover:text-white"
                    >
                      Show all {list.length}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
