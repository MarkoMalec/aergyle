"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

/** Categorical series colours for the dark admin surface, in fixed order. */
export const SERIES_COLORS = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
] as const;
/** A recessive line for "what is saved now" beside a draft. */
export const REFERENCE_COLOR = "#898781";
const SURFACE = "#141a24";

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  /** Sorted by x. */
  points: ReadonlyArray<readonly [number, number]>;
};

export type ChartMarker = { x: number; y: number; label: string };
/** A labelled vertical line, e.g. the max level. */
export type ChartRule = { x: number; label: string };

type Scale = {
  toPx: (value: number) => number;
  ticks: number[];
  min: number;
  max: number;
};

function linearScale(min: number, max: number, from: number, to: number, count: number): Scale {
  const span = max - min || Math.abs(max) || 1;
  const rough = span / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normal = rough / magnitude;
  const step = (normal < 1.5 ? 1 : normal < 3 ? 2 : normal < 7 ? 5 : 10) * magnitude;
  const low = Math.floor(min / step) * step;
  const high = Math.max(low + step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let tick = low; tick <= high + step / 2; tick += step) ticks.push(Number(tick.toPrecision(12)));
  return {
    min: low,
    max: high,
    ticks,
    toPx: (value) => from + ((value - low) / (high - low)) * (to - from),
  };
}

function logScale(
  min: number,
  max: number,
  from: number,
  to: number,
  preferred?: readonly number[],
): Scale {
  const low = Math.floor(Math.log10(min));
  const high = Math.max(low + 1, Math.ceil(Math.log10(max)));
  let ticks: number[] = [];
  for (let power = low; power <= high; power += 1) {
    ticks.push(10 ** power);
    if (high - low <= 2 && power < high) ticks.push(2 * 10 ** power, 5 * 10 ** power);
  }
  const inRange = preferred?.filter((tick) => tick >= 10 ** low && tick <= 10 ** high);
  if (inRange && inRange.length >= 2) ticks = [...inRange];
  ticks.sort((a, b) => a - b);
  return {
    min: 10 ** low,
    max: 10 ** high,
    ticks,
    toPx: (value) => from + ((Math.log10(value) - low) / (high - low)) * (to - from),
  };
}

/** Keeps a line's shape while drawing at most ~`limit` points. */
function thin<T>(points: ReadonlyArray<T>, limit: number): ReadonlyArray<T> {
  if (points.length <= limit) return points;
  const every = Math.ceil(points.length / limit);
  const kept = points.filter((_, index) => index % every === 0);
  if (kept.at(-1) !== points.at(-1)) kept.push(points.at(-1)!);
  return kept;
}

function nearest(points: ChartSeries["points"], x: number) {
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (points[mid]![0] < x) low = mid;
    else high = mid;
  }
  const a = points[low];
  const b = points[high];
  if (!a) return b;
  if (!b) return a;
  return Math.abs(a[0] - x) <= Math.abs(b[0] - x) ? a : b;
}

export function LineChart(props: {
  series: ChartSeries[];
  markers?: ChartMarker[];
  logY?: boolean;
  height?: number;
  xLabel: string;
  yLabel: string;
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  /** Log-scale ticks to use instead of powers of ten, e.g. hour/day/week. */
  logTicks?: readonly number[];
  /** Stretch the x axis to at least this value (data may end earlier). */
  xMax?: number;
  rules?: ChartRule[];
  /** Small multiples: fewer ticks and no axis titles. */
  compact?: boolean;
  label: string;
}) {
  const { series, markers = [], rules = [], logY = false, compact = false } = props;
  const height = props.height ?? (compact ? 150 : 300);
  const formatX = props.formatX ?? ((x: number) => String(x));
  const formatY = props.formatY ?? ((y: number) => String(y));
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const margin = compact
    ? { left: 44, right: 10, top: 8, bottom: 22 }
    : { left: 76, right: 16, top: 12, bottom: 40 };
  const plotRight = Math.max(margin.left + 10, width - margin.right);
  const plotBottom = height - margin.bottom;

  const geometry = useMemo(() => {
    const valid = (y: number) => Number.isFinite(y) && (!logY || y > 0);
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const line of series) {
      for (const [x, y] of line.points) {
        if (!valid(y) || !Number.isFinite(x)) continue;
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    }
    for (const marker of markers) {
      if (!valid(marker.y)) continue;
      yMin = Math.min(yMin, marker.y);
      yMax = Math.max(yMax, marker.y);
    }
    if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) return null;
    for (const rule of rules) xMax = Math.max(xMax, rule.x);
    if (props.xMax !== undefined) xMax = Math.max(xMax, props.xMax);
    const x = linearScale(xMin, xMax, margin.left, plotRight, compact ? 4 : 8);
    const y = logY
      ? logScale(yMin, yMax, plotBottom, margin.top, props.logTicks)
      : linearScale(Math.min(0, yMin), yMax, plotBottom, margin.top, compact ? 3 : 5);
    const limit = Math.max(120, Math.round(width));
    const paths = series.map((line) => {
      let d = "";
      let open = false;
      for (const [px, py] of thin(line.points, limit)) {
        if (!valid(py)) {
          open = false;
          continue;
        }
        d += `${open ? "L" : "M"}${x.toPx(px).toFixed(1)} ${y.toPx(py).toFixed(1)}`;
        open = true;
      }
      return { id: line.id, color: line.color, d };
    });
    return { x, y, paths, valid };
  }, [series, markers, rules, logY, compact, width, margin.left, margin.top, plotRight, plotBottom, props.logTicks, props.xMax]);

  const hover =
    geometry && hoverX !== null
      ? series.flatMap((line) => {
          const point = nearest(line.points, hoverX);
          return point && geometry.valid(point[1]) ? [{ line, point }] : [];
        })
      : [];
  const hoverPx = hover[0] && geometry ? geometry.x.toPx(hover[0].point[0]) : null;

  return (
    <figure className="space-y-2" aria-label={props.label}>
      {series.length > 1 ? (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
          {series.map((line) => (
            <span key={line.id} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: line.color }} />
              {line.label}
            </span>
          ))}
          {markers.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-white/85" />
              Targets
            </span>
          ) : null}
        </figcaption>
      ) : null}
      <div ref={box} className="relative w-full" style={{ height }}>
        {geometry && width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={props.label}
            className="touch-none select-none"
            onPointerMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const px = event.clientX - rect.left;
              const { x } = geometry;
              const value = x.min + ((px - margin.left) / (plotRight - margin.left)) * (x.max - x.min);
              setHoverX(value);
            }}
            onPointerLeave={() => setHoverX(null)}
          >
            {geometry.y.ticks.map((tick) => (
              <g key={`y${tick}`}>
                <line
                  x1={margin.left}
                  x2={plotRight}
                  y1={geometry.y.toPx(tick)}
                  y2={geometry.y.toPx(tick)}
                  stroke="rgba(255,255,255,0.07)"
                />
                <text
                  x={margin.left - 8}
                  y={geometry.y.toPx(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-white/45 text-[11px] tabular-nums"
                >
                  {formatY(tick)}
                </text>
              </g>
            ))}
            {geometry.x.ticks.map((tick) => (
              <text
                key={`x${tick}`}
                x={geometry.x.toPx(tick)}
                y={plotBottom + 15}
                textAnchor="middle"
                className="fill-white/45 text-[11px] tabular-nums"
              >
                {formatX(tick)}
              </text>
            ))}
            <line x1={margin.left} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke="rgba(255,255,255,0.18)" />
            {!logY && geometry.y.min < 0 && geometry.y.max > 0 ? (
              <line
                x1={margin.left}
                x2={plotRight}
                y1={geometry.y.toPx(0)}
                y2={geometry.y.toPx(0)}
                stroke="rgba(255,255,255,0.35)"
              />
            ) : null}
            {rules.map((rule) => (
              <g key={`${rule.label}${rule.x}`}>
                <line
                  x1={geometry.x.toPx(rule.x)}
                  x2={geometry.x.toPx(rule.x)}
                  y1={margin.top}
                  y2={plotBottom}
                  stroke="rgba(255,255,255,0.3)"
                  strokeDasharray="3 4"
                />
                <text
                  x={geometry.x.toPx(rule.x) - 4}
                  y={margin.top + 10}
                  textAnchor="end"
                  className="fill-white/55 text-[11px]"
                >
                  {rule.label}
                </text>
              </g>
            ))}
            {!compact ? (
              <>
                <text x={(margin.left + plotRight) / 2} y={height - 4} textAnchor="middle" className="fill-white/55 text-[11px]">
                  {props.xLabel}
                </text>
                <text
                  transform={`translate(12 ${(margin.top + plotBottom) / 2}) rotate(-90)`}
                  textAnchor="middle"
                  className="fill-white/55 text-[11px]"
                >
                  {props.yLabel}
                </text>
              </>
            ) : null}
            {geometry.paths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                fill="none"
                stroke={path.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {markers.filter((marker) => geometry.valid(marker.y)).map((marker, index) => (
              <circle
                key={index}
                cx={geometry.x.toPx(marker.x)}
                cy={geometry.y.toPx(marker.y)}
                r={5}
                fill="rgba(255,255,255,0.9)"
                stroke={SURFACE}
                strokeWidth={2}
              >
                <title>{marker.label}</title>
              </circle>
            ))}
            {hoverPx !== null ? (
              <g pointerEvents="none">
                <line x1={hoverPx} x2={hoverPx} y1={margin.top} y2={plotBottom} stroke="rgba(255,255,255,0.25)" />
                {hover.map(({ line, point }) => (
                  <circle
                    key={line.id}
                    cx={geometry.x.toPx(point[0])}
                    cy={geometry.y.toPx(point[1])}
                    r={4}
                    fill={line.color}
                    stroke={SURFACE}
                    strokeWidth={2}
                  />
                ))}
              </g>
            ) : null}
          </svg>
        ) : (
          <div className="grid h-full place-items-center text-xs text-white/40">No data to draw</div>
        )}
        {hover.length > 0 && hoverPx !== null ? (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-md bg-gray-950/95 px-2.5 py-2 text-xs shadow-lg"
            style={
              hoverPx > width * 0.6
                ? { right: width - hoverPx + 12 }
                : { left: hoverPx + 12 }
            }
          >
            <div className="mb-1 font-medium text-white/80">
              {props.xLabel} {formatX(hover[0]!.point[0])}
            </div>
            {hover.map(({ line, point }) => (
              <div key={line.id} className="flex items-center justify-between gap-3 text-white/65">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-3 rounded" style={{ background: line.color }} />
                  {line.label}
                </span>
                <span className="tabular-nums text-white/90">{formatY(point[1])}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </figure>
  );
}
