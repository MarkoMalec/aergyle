"use client";

import { BarChart3, Clock, Package, Zap } from "lucide-react";
import type { SkillMetrics } from "~/server/skills/metrics";

function formatInt(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.floor(value)));
}

/** "1d 0h 5m", the way a player reads time spent on a skill. */
function formatSpan(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Lifetime totals for the skill the player is looking at. */
export function SkillMetricsPanel({
  metrics,
  loading,
}: {
  metrics: SkillMetrics | null;
  loading: boolean;
}) {
  const rows = [
    {
      icon: Package,
      label: "Items Gathered",
      value: metrics ? formatInt(metrics.itemsGathered) : "—",
    },
    {
      icon: Zap,
      label: "Total Experience",
      value: metrics ? formatInt(metrics.totalExperience) : "—",
    },
    {
      icon: Clock,
      label: "Time Spent",
      value: metrics ? formatSpan(metrics.secondsSpent) : "—",
    },
  ];

  return (
    <div className="game-panel-flat p-3">
      <p className="flex items-center gap-2 px-1 pb-2 pt-1 text-sm font-semibold text-foreground">
        <BarChart3 size={16} className="text-primary" aria-hidden="true" />
        Metrics
      </p>
      <div className="grid gap-1.5">
        {rows.map((row) => (
          <div className="game-metric-row" key={row.label}>
            <row.icon
              size={16}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate text-[13px] text-text-secondary">
              {row.label}
            </span>
            <span className="ml-auto shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
              {loading && !metrics ? "…" : row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
