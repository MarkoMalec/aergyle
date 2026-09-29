"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus } from "lucide-react";
import type { IssueSeverity } from "~/game/itemGraph/diagnostics";
import type { GraphLink, ItemGraph } from "~/game/itemGraph/graph";
import {
  COLUMN_PITCH,
  lensLineage,
  NODE_WIDTH,
  PORT_SPACING,
  type Lens,
  type LensEdge,
  type LensNode,
  type LensSide,
} from "~/game/itemGraph/lens";
import { ROLE_LABELS, SKILL_COLORS } from "~/game/itemGraph/taxonomy";
import { getSkillLabel } from "~/game/crafting";
import { cn } from "~/lib/utils";
import { ItemArt, ROLE_COLORS, SEVERITY_COLORS, SourceIcons, productionLabel } from "./parts";

type View = { x: number; y: number; k: number };
type Point = { x: number; y: number };

const PILL_WIDTH = 34;
const PILL_GAP = 4;
const TWEEN_MS = 280;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.6;

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function portY(node: LensNode, edge: LensEdge, y: number) {
  return y + (node.height - edge.ports * PORT_SPACING) / 2 + PORT_SPACING / 2 + edge.port * PORT_SPACING;
}

function edgePath(from: Point, to: Point, backward: boolean, drop: number) {
  if (backward) {
    // A circular link runs back under both items.
    return `M ${from.x} ${from.y} C ${from.x + 70} ${from.y}, ${from.x + 70} ${drop}, ${from.x} ${drop} L ${to.x} ${drop} C ${to.x - 70} ${drop}, ${to.x - 70} ${to.y}, ${to.x} ${to.y}`;
  }
  const dx = Math.max(36, (to.x - from.x) / 2);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

function pillText(link: GraphLink) {
  if (link.kind === "UNLOCK") return "learn";
  if (link.kind === "SEED") return "seed";
  return `×${link.quantity}`;
}

export function LensCanvas(props: {
  graph: ItemGraph;
  lens: Lens;
  /** Re-fits the view when it changes (a new focus). */
  fitKey: string | number;
  selectedKey: string | null;
  onSelect: (itemId: number | null) => void;
  onFocus?: (itemId: number) => void;
  onBranch?: (side: LensSide, itemId: number, open: boolean) => void;
  onShowAll?: (side: LensSide, parentId: number) => void;
  /** Items outside the active filters. */
  isDimmed?: (itemId: number) => boolean;
  isEdgeDimmed?: (link: GraphLink) => boolean;
  /** Worst issue per item, marked on its node. */
  severity?: Map<number, IssueSeverity>;
  /** Embedded on another page: no minimap, and plain scrolling scrolls the page. */
  compact?: boolean;
  className?: string;
}) {
  const { graph, lens, compact } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const targets = useMemo(() => new Map(lens.nodes.map((node) => [node.key, { x: node.x, y: node.y }])), [lens]);

  const fitView = useCallback(
    (bounds: Lens["bounds"]): View => {
      const pad = compact ? 28 : 56;
      const top = 30;
      const k = Math.min(
        compact ? 0.85 : 1,
        Math.max(
          MIN_ZOOM,
          Math.min((size.w - pad * 2) / bounds.width, (size.h - pad * 2 - top) / (bounds.height + top)),
        ),
      );
      return {
        k,
        x: size.w / 2 - (bounds.x + bounds.width / 2) * k,
        y: (size.h + top * k) / 2 - (bounds.y + bounds.height / 2) * k,
      };
    },
    [size.w, size.h, compact],
  );

  // Re-layouts glide instead of jumping: node positions and the view tween
  // together. A new focus re-fits; anything else keeps the item the admin
  // touched (or the focus) still on screen.
  const shown = useRef(new Map<string, Point>());
  const pivot = useRef<string | null>(null);
  const tween = useRef<{ start: number; from: Map<string, Point>; to: Map<string, Point>; fromView: View; toView: View | null } | null>(null);
  const lastFit = useRef<string | number | null>(null);
  const [, setFrame] = useState(0);

  useLayoutEffect(() => {
    if (size.w === 0) return;
    const current = viewRef.current;
    let toView: View | null;
    if (lastFit.current !== props.fitKey) {
      toView = fitView(lens.bounds);
      if (lastFit.current === null) {
        // First paint: no motion.
        lastFit.current = props.fitKey;
        shown.current = new Map(targets);
        setView(toView);
        return;
      }
      lastFit.current = props.fitKey;
    } else {
      const key = pivot.current && targets.has(pivot.current) ? pivot.current : lens.focusKey;
      const before = shown.current.get(key);
      const after = targets.get(key);
      toView =
        before && after
          ? { ...current, x: current.x - (after.x - before.x) * current.k, y: current.y - (after.y - before.y) * current.k }
          : current;
    }
    tween.current = { start: performance.now(), from: new Map(shown.current), to: targets, fromView: current, toView };
    let raf = 0;
    const step = (now: number) => {
      const t = tween.current;
      if (!t) return;
      const p = ease(Math.min(1, (now - t.start) / TWEEN_MS));
      const positions = new Map<string, Point>();
      for (const [key, to] of t.to) {
        const from = t.from.get(key) ?? to;
        positions.set(key, { x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) });
      }
      shown.current = positions;
      if (t.toView) {
        setView({
          x: lerp(t.fromView.x, t.toView.x, p),
          y: lerp(t.fromView.y, t.toView.y, p),
          k: lerp(t.fromView.k, t.toView.k, p),
        });
      }
      setFrame((n) => n + 1);
      if (p < 1) raf = requestAnimationFrame(step);
      else tween.current = null;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, props.fitKey, size.w > 0]);

  const setViewByHand = useCallback((update: (v: View) => View) => {
    // The admin took over: stop steering the view, let nodes finish.
    if (tween.current) tween.current.toView = null;
    setView((v) => update(v));
  }, []);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      setViewByHand((v) => {
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
        return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
      });
    },
    [setViewByHand],
  );

  const zoomCentre = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  const fit = useCallback(() => {
    if (tween.current) tween.current.toView = null;
    setView(fitView(lens.bounds));
  }, [fitView, lens.bounds]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      // Pinch gestures arrive with ctrlKey; a mouse wheel moves in big whole
      // steps. Both zoom. Two-finger trackpad scrolling pans.
      const mouseWheel =
        event.deltaMode !== 0 || (event.deltaX === 0 && Number.isInteger(event.deltaY) && Math.abs(event.deltaY) >= 50);
      if (event.ctrlKey || event.metaKey || (mouseWheel && !compact)) {
        event.preventDefault();
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        zoomAt(event.clientX, event.clientY, Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015)));
      } else if (!compact) {
        event.preventDefault();
        setViewByHand((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [compact, zoomAt, setViewByHand]);

  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("[data-node],[data-ui]")) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    d.moved = true;
    d.x = event.clientX;
    d.y = event.clientY;
    setViewByHand((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
  };
  const onPointerUp = () => {
    if (drag.current && !drag.current.moved) props.onSelect(null);
    drag.current = null;
  };

  const nodes = new Map(lens.nodes.map((node) => [node.key, node]));
  const position = (key: string) => shown.current.get(key) ?? targets.get(key)!;

  const lineage = useMemo(
    () => (props.selectedKey && nodes.has(props.selectedKey) ? lensLineage(lens, props.selectedKey) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lens, props.selectedKey],
  );
  const itemDimmed = (node: LensNode) =>
    node.type === "item" && node.key !== lens.focusKey && (props.isDimmed?.(node.itemId) ?? false);
  const nodeFaded = (node: LensNode) => (lineage ? !lineage.nodes.has(node.key) : false) || itemDimmed(node);

  const skillsShown = useMemo(
    () => [...new Set(lens.edges.flatMap((edge) => (edge.link ? [edge.link.skill] : [])))],
    [lens],
  );

  const columnLabel = (c: number) =>
    c === 0 ? "Focus" : c < 0 ? (c === -1 ? "Needs" : `${-c} steps before`) : c === 1 ? "Used in" : `${c} steps after`;

  const bottom = lens.bounds.y + lens.bounds.height;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label="Item dependency graph"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "f") fit();
        else if (event.key === "+" || event.key === "=") zoomCentre(1.2);
        else if (event.key === "-") zoomCentre(1 / 1.2);
        else if (event.key === "Escape") props.onSelect(null);
      }}
      className={cn(
        "relative h-full w-full cursor-grab touch-none select-none overflow-hidden outline-none active:cursor-grabbing",
        props.className,
      )}
      style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: `${22 * view.k}px ${22 * view.k}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        {Array.from({ length: lens.maxColumn - lens.minColumn + 1 }, (_, i) => lens.minColumn + i).map((c) => (
          <div
            key={c}
            className={cn(
              "pointer-events-none absolute text-[11px] font-semibold uppercase tracking-wider",
              c === 0 ? "text-amber-200/70" : "text-white/30",
            )}
            style={{ left: c * COLUMN_PITCH, top: lens.bounds.y - 30, width: NODE_WIDTH }}
          >
            {columnLabel(c)}
          </div>
        ))}

        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
          {lens.edges.map((edge) => {
            const fromNode = nodes.get(edge.from)!;
            const toNode = nodes.get(edge.to)!;
            const a = position(edge.from);
            const b = position(edge.to);
            const from = { x: a.x + fromNode.width, y: a.y + fromNode.height / 2 };
            const to = edge.link
              ? { x: b.x - PILL_WIDTH - PILL_GAP, y: portY(toNode, edge, b.y) }
              : { x: b.x, y: b.y + toNode.height / 2 };
            const lit = lineage?.edges.has(edge.key) ?? false;
            const touched = hovered !== null && (edge.from === hovered || edge.to === hovered);
            const faded =
              (lineage !== null && !lit) ||
              nodeFaded(fromNode) ||
              nodeFaded(toNode) ||
              (edge.link ? props.isEdgeDimmed?.(edge.link) ?? false : false);
            const color = edge.backward ? "#f87171" : edge.link ? SKILL_COLORS[edge.link.skill] : "#94a3b8";
            return (
              <path
                key={edge.key}
                d={edgePath(from, to, edge.backward, Math.max(a.y + fromNode.height, b.y + toNode.height) + 28)}
                fill="none"
                stroke={color}
                strokeWidth={lit || touched ? 2.4 : 1.6}
                strokeOpacity={faded ? 0.08 : lit || touched ? 0.95 : 0.5}
                strokeDasharray={
                  !edge.link ? "3 5" : edge.link.kind === "UNLOCK" ? "6 4" : edge.link.kind === "SEED" ? "2 4" : undefined
                }
              />
            );
          })}
        </svg>

        {lens.edges.map((edge) => {
          if (!edge.link) return null;
          const toNode = nodes.get(edge.to)!;
          const b = position(edge.to);
          const faded =
            (lineage !== null && !lineage.edges.has(edge.key)) ||
            nodeFaded(nodes.get(edge.from)!) ||
            nodeFaded(toNode) ||
            (props.isEdgeDimmed?.(edge.link) ?? false);
          const color = edge.backward ? "#f87171" : SKILL_COLORS[edge.link.skill];
          return (
            <div
              key={`pill-${edge.key}`}
              title={`${graph.items.get(edge.link.from)?.name} → ${graph.items.get(edge.link.to)?.name} · ${getSkillLabel(edge.link.skill)}${edge.link.kind === "INGREDIENT" ? ` · ${edge.link.quantity} per craft` : ""}`}
              className="absolute grid h-4 place-items-center rounded-full text-[10px] font-semibold tabular-nums leading-none transition-opacity"
              style={{
                left: b.x - PILL_WIDTH - PILL_GAP,
                top: portY(toNode, edge, b.y) - 8,
                width: PILL_WIDTH,
                background: `color-mix(in srgb, ${color} 22%, #0b1116)`,
                color,
                opacity: faded ? 0.15 : 1,
              }}
            >
              {pillText(edge.link)}
            </div>
          );
        })}

        {lens.nodes.map((node) => {
          const p = position(node.key);
          if (node.type === "more") {
            return (
              <button
                key={node.key}
                type="button"
                data-node
                onClick={() => props.onShowAll?.(node.side, node.parentId)}
                disabled={!props.onShowAll}
                className="absolute left-0 top-0 flex items-center justify-center gap-1 rounded-lg bg-white/[0.04] text-xs font-medium text-white/60 outline-dashed outline-1 outline-white/15 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none"
                style={{ transform: `translate(${p.x}px, ${p.y}px)`, width: node.width, height: node.height, opacity: nodeFaded(node) ? 0.3 : 1 }}
              >
                +{node.count} more {node.side === "up" ? "needs" : "uses"}
              </button>
            );
          }
          const item = graph.items.get(node.itemId)!;
          const facts = graph.facts.get(node.itemId)!;
          const isFocus = node.key === lens.focusKey;
          const selected = node.key === props.selectedKey;
          const sev = props.severity?.get(node.itemId);
          return (
            <div
              key={node.key}
              data-node
              role="button"
              tabIndex={-1}
              aria-label={item.name}
              onPointerEnter={() => setHovered(node.key)}
              onPointerLeave={() => setHovered((h) => (h === node.key ? null : h))}
              onClick={() => {
                pivot.current = node.key;
                props.onSelect(node.itemId);
              }}
              onDoubleClick={() => props.onFocus?.(node.itemId)}
              className={cn(
                "group absolute left-0 top-0 cursor-pointer rounded-lg bg-[#141c22] shadow-[0_4px_14px_rgba(0,0,0,0.35)] transition-[opacity,box-shadow]",
                isFocus && "bg-[#1d2229] ring-2 ring-amber-300/80",
                selected && !isFocus && "ring-2 ring-white/70",
                !selected && !isFocus && "hover:ring-1 hover:ring-white/25",
              )}
              style={{
                transform: `translate(${p.x}px, ${p.y}px)`,
                width: node.width,
                height: node.height,
                opacity: nodeFaded(node) ? 0.22 : 1,
              }}
            >
              <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-[3px] rounded-r"
                style={{ background: ROLE_COLORS[facts.role] }}
                title={ROLE_LABELS[facts.role]}
              />
              <div className="flex h-full items-center gap-2.5 py-2 pl-3 pr-2.5">
                <ItemArt item={item} size={38} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className={cn("truncate text-[13px] font-medium leading-tight", facts.obtainable ? "text-white" : "text-red-200")}>
                    {item.name}
                  </div>
                  <div className="flex items-center gap-1.5 truncate text-[11px] leading-tight text-white/55">
                    <span className="shrink-0 font-semibold tabular-nums text-white/70" title={`Crafting tier ${facts.tier} · ${ROLE_LABELS[facts.role]}`}>
                      T{facts.tier}
                    </span>
                    <span className="truncate">{productionLabel(graph, node.itemId)}</span>
                  </div>
                  <SourceIcons graph={graph} itemId={node.itemId} />
                </div>
              </div>
              {sev === "error" || sev === "warning" ? (
                <span
                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                  style={{ background: SEVERITY_COLORS[sev] }}
                  title={sev === "error" ? "Has errors" : "Has warnings"}
                />
              ) : null}
              {props.onBranch && node.side !== "down" ? (
                <BranchHandle
                  side="up"
                  hidden={node.hiddenUp}
                  open={node.openUp}
                  isFocus={isFocus}
                  onToggle={(open) => {
                    pivot.current = node.key;
                    props.onBranch!("up", node.itemId, open);
                  }}
                />
              ) : null}
              {props.onBranch && node.side !== "up" ? (
                <BranchHandle
                  side="down"
                  hidden={node.hiddenDown}
                  open={node.openDown}
                  isFocus={isFocus}
                  onToggle={(open) => {
                    pivot.current = node.key;
                    props.onBranch!("down", node.itemId, open);
                  }}
                />
              ) : null}
            </div>
          );
        })}
        {lens.edges.some((edge) => edge.backward) ? (
          <div className="pointer-events-none absolute text-[11px] text-red-300/80" style={{ left: lens.bounds.x, top: bottom + 34 }}>
            Red links run backwards: a circular dependency.
          </div>
        ) : null}
      </div>

      <div data-ui className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-black/50 p-1 text-white/70 backdrop-blur">
        {!compact ? (
          <>
            <CanvasButton label="Zoom out" onClick={() => zoomCentre(1 / 1.25)}>
              <Minus className="h-3.5 w-3.5" />
            </CanvasButton>
            <span className="w-10 text-center text-[11px] tabular-nums">{Math.round(view.k * 100)}%</span>
            <CanvasButton label="Zoom in" onClick={() => zoomCentre(1.25)}>
              <Plus className="h-3.5 w-3.5" />
            </CanvasButton>
          </>
        ) : null}
        <CanvasButton label="Fit to screen (F)" onClick={fit}>
          <Maximize2 className="h-3.5 w-3.5" />
        </CanvasButton>
      </div>

      {!compact ? (
        <div data-ui className="absolute right-3 top-3 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setLegend((v) => !v)}
            className="rounded-md bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white/70 backdrop-blur hover:text-white"
          >
            {legend ? "Hide legend" : "Legend"}
          </button>
          {legend ? <Legend skills={skillsShown} /> : null}
        </div>
      ) : null}

      {!compact && size.w > 0 && (lens.bounds.width * view.k > size.w || lens.bounds.height * view.k > size.h) ? (
        <Minimap lens={lens} view={view} size={size} onCenter={(x, y) => setViewByHand((v) => ({ ...v, x: size.w / 2 - x * v.k, y: size.h / 2 - y * v.k }))} />
      ) : null}
    </div>
  );
}

function CanvasButton(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      onClick={props.onClick}
      className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/10 hover:text-white"
    >
      {props.children}
    </button>
  );
}

/** +N to open a branch one more level; − to close it (on hover). */
function BranchHandle(props: {
  side: LensSide;
  hidden: number;
  open: boolean;
  isFocus: boolean;
  onToggle: (open: boolean) => void;
}) {
  const Icon = props.side === "up" ? ChevronLeft : ChevronRight;
  const place = props.side === "up" ? "-left-2.5" : "-right-2.5";
  if (!props.open && props.hidden > 0) {
    return (
      <button
        type="button"
        data-ui
        title={props.side === "up" ? `Show ${props.hidden} more needs` : `Show ${props.hidden} more uses`}
        onClick={(event) => {
          event.stopPropagation();
          props.onToggle(true);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        className={cn(
          "absolute -top-2 flex h-5 items-center gap-0.5 rounded-full bg-[#27313a] px-1.5 text-[10px] font-semibold text-white/80 shadow hover:bg-amber-300 hover:text-black",
          place,
          props.side === "down" && "flex-row-reverse",
        )}
      >
        <Icon className="h-3 w-3" />
        {props.hidden}
      </button>
    );
  }
  if (props.open && !props.isFocus) {
    return (
      <button
        type="button"
        data-ui
        title={props.side === "up" ? "Hide what this needs" : "Hide what this leads to"}
        onClick={(event) => {
          event.stopPropagation();
          props.onToggle(false);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        className={cn(
          "absolute -top-2 hidden h-5 w-5 place-items-center rounded-full bg-[#27313a] text-white/70 shadow hover:bg-white hover:text-black group-hover:grid",
          place,
        )}
      >
        <Minus className="h-3 w-3" />
      </button>
    );
  }
  return null;
}

function Legend(props: { skills: Array<keyof typeof SKILL_COLORS> }) {
  return (
    <div className="w-56 space-y-3 rounded-lg bg-black/70 p-3 text-[11px] text-white/70 backdrop-blur">
      <div className="space-y-1">
        <div className="font-semibold text-white/85">Items</div>
        {(Object.keys(ROLE_COLORS) as Array<keyof typeof ROLE_COLORS>).map((role) => (
          <div key={role} className="flex items-center gap-2">
            <span className="h-3 w-1 rounded-sm" style={{ background: ROLE_COLORS[role] }} />
            {ROLE_LABELS[role]}
          </div>
        ))}
        <div className="text-white/45">T = crafting tier (0 = not crafted)</div>
      </div>
      <div className="space-y-1">
        <div className="font-semibold text-white/85">Links</div>
        <LegendLine dash={undefined} label="Consumed per craft (×qty)" />
        <LegendLine dash="6 4" label="Recipe to learn once" />
        <LegendLine dash="2 4" label="Seed grows it" />
        <LegendLine dash={undefined} color="#f87171" label="Circular dependency" />
      </div>
      {props.skills.length > 0 ? (
        <div className="space-y-1">
          <div className="font-semibold text-white/85">Skill doing the step</div>
          {props.skills.map((skill) => (
            <div key={skill} className="flex items-center gap-2">
              <span className="h-0.5 w-5 rounded" style={{ background: SKILL_COLORS[skill] }} />
              {getSkillLabel(skill)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegendLine(props: { dash: string | undefined; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="6" aria-hidden>
        <line x1="0" y1="3" x2="22" y2="3" stroke={props.color ?? "#cbd5e1"} strokeWidth="1.6" strokeDasharray={props.dash} />
      </svg>
      {props.label}
    </div>
  );
}

function Minimap(props: {
  lens: Lens;
  view: View;
  size: { w: number; h: number };
  onCenter: (x: number, y: number) => void;
}) {
  const { bounds } = props.lens;
  const W = 184;
  const H = 120;
  const pad = 40;
  const vb = { x: bounds.x - pad, y: bounds.y - pad, w: bounds.width + pad * 2, h: bounds.height + pad * 2 };
  const scale = Math.min(W / vb.w, H / vb.h);
  const toCanvas = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = (event.clientX - rect.left - (W - vb.w * scale) / 2) / scale + vb.x;
    const sy = (event.clientY - rect.top - (H - vb.h * scale) / 2) / scale + vb.y;
    props.onCenter(sx, sy);
  };
  const viewport = {
    x: -props.view.x / props.view.k,
    y: -props.view.y / props.view.k,
    w: props.size.w / props.view.k,
    h: props.size.h / props.view.k,
  };
  return (
    <svg
      data-ui
      width={W}
      height={H}
      viewBox={`${vb.x - (W / scale - vb.w) / 2} ${vb.y - (H / scale - vb.h) / 2} ${W / scale} ${H / scale}`}
      className="absolute bottom-3 right-3 cursor-crosshair rounded-lg bg-black/60 backdrop-blur"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        toCanvas(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) toCanvas(event);
      }}
    >
      {props.lens.nodes.map((node) => (
        <rect
          key={node.key}
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={10}
          fill={node.key === props.lens.focusKey ? "#fcd34d" : "rgba(255,255,255,0.28)"}
        />
      ))}
      <rect
        x={viewport.x}
        y={viewport.y}
        width={viewport.w}
        height={viewport.h}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth={2 / scale}
      />
    </svg>
  );
}
