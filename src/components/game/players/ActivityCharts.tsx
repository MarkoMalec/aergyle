"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ACTIVITY_RANGES, type ActivityRange } from "~/game/players";
import { cn } from "~/lib/utils";
import type { DailyActivityPoint } from "~/server/players";

const integer = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const weekdayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "UTC",
});
const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "45 min", "3.5 h", "120 h". */
export function formatActiveTime(seconds: number) {
  if (seconds < 3_600) return `${Math.max(1, Math.round(seconds / 60))} min`;
  const hours = seconds / 3_600;
  return `${hours >= 100 ? Math.round(hours) : hours.toFixed(1).replace(/\.0$/, "")} h`;
}

type Series = {
  title: string;
  value: (point: DailyActivityPoint) => number;
  format: (value: number) => string;
  /** Short scale label for the top gridline. */
  axis: (value: number) => string;
  barClass: string;
};

const SERIES: Series[] = [
  {
    title: "Time active",
    value: (point) => point.seconds,
    format: (value) => (value > 0 ? formatActiveTime(value) : "Idle"),
    axis: formatActiveTime,
    barClass: "bg-primary/75 group-hover:bg-primary",
  },
  {
    title: "Experience",
    value: (point) => point.xp,
    format: (value) => `${integer.format(value)} XP`,
    axis: (value) => `${compact.format(value)} XP`,
    barClass: "bg-xp/75 group-hover:bg-xp",
  },
];

function BarChart({
  series,
  points,
}: {
  series: Series;
  points: DailyActivityPoint[];
}) {
  const values = points.map(series.value);
  const max = Math.max(0, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const labelEvery = points.length > 7 ? 7 : 1;

  return (
    <figure className="min-w-0 rounded-xl bg-surface-inset/45 p-3 sm:p-4">
      <figcaption className="mb-5 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold text-foreground">
          {series.title}
        </span>
        <span className="truncate text-xs tabular-nums text-muted-foreground">
          {total > 0 ? `${series.format(total)} total` : null}
        </span>
      </figcaption>

      {total === 0 ? (
        <p className="grid h-[132px] place-items-center text-xs text-muted-foreground">
          Nothing in the last {points.length} days
        </p>
      ) : (
        <>
          <div className="relative h-[112px]">
            {/* The scale: one recessive gridline at the busiest day. */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 border-t border-dashed border-foreground/10"
            />
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 -translate-y-full pb-0.5 text-[10px] tabular-nums text-muted-foreground"
            >
              {series.axis(max)}
            </span>
            <div
              className="absolute inset-0 flex items-end gap-[2px] border-b border-foreground/15"
              aria-hidden="true"
            >
              {points.map((point, index) => {
                const value = values[index] ?? 0;
                return (
                  <Tooltip key={point.day}>
                    <TooltipTrigger asChild>
                      <div className="group flex h-full min-w-0 flex-1 items-end">
                        <div
                          className={cn(
                            "w-full rounded-t-[4px] transition-colors duration-150",
                            series.barClass,
                          )}
                          style={{
                            height:
                              value > 0
                                ? `max(2px, ${(value / max) * 100}%)`
                                : 0,
                          }}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span className="text-muted-foreground">
                        {dayFormat.format(new Date(point.day))}
                      </span>{" "}
                      <strong className="font-semibold tabular-nums text-foreground">
                        {series.format(value)}
                      </strong>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="mt-1.5 flex gap-[2px] text-[10px] text-muted-foreground"
          >
            {points.map((point, index) => (
              <span
                key={point.day}
                className="min-w-0 flex-1 whitespace-nowrap text-center"
              >
                {(points.length - 1 - index) % labelEvery === 0
                  ? labelEvery === 1
                    ? weekdayFormat.format(new Date(point.day))
                    : shortDateFormat.format(new Date(point.day))
                  : null}
              </span>
            ))}
          </div>
        </>
      )}

      <table className="sr-only">
        <caption>{series.title} per day</caption>
        <tbody>
          {points.map((point, index) => (
            <tr key={point.day}>
              <th scope="row">{dayFormat.format(new Date(point.day))}</th>
              <td>{series.format(values[index] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Time spent and XP gained per day, over the last week or month. */
export function ActivityCharts({
  history,
  className,
}: {
  /** The last 30 days, oldest first. */
  history: DailyActivityPoint[];
  className?: string;
}) {
  const [range, setRange] = useState<ActivityRange>(7);
  const points = history.slice(-range);

  return (
    <section
      aria-labelledby="activity-heading"
      className={cn(
        "game-panel-flat min-w-0 p-4 [container-type:inline-size] sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="activity-heading" className="game-section-title">
          Activity
        </h2>
        <div
          role="radiogroup"
          aria-label="Range"
          className="flex gap-1 rounded-[8px] bg-surface-inset/60 p-1"
        >
          {ACTIVITY_RANGES.map((days) => (
            <button
              key={days}
              type="button"
              role="radio"
              aria-checked={range === days}
              onClick={() => setRange(days)}
              className={cn(
                "h-7 rounded-md px-2.5 text-xs font-semibold transition-colors",
                range === days
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      <TooltipProvider delayDuration={0}>
        <div className="grid gap-3 [@container(min-width:560px)]:grid-cols-2">
          {SERIES.map((series) => (
            <BarChart key={series.title} series={series} points={points} />
          ))}
        </div>
      </TooltipProvider>
    </section>
  );
}
