"use client";

import React, { useState } from "react";
import {
  type ItemEquipTo,
  ItemStatOverrideKind,
  type StatType,
} from "~/generated/prisma/enums";
import { enchantBadge, enchantLabel } from "~/game/enchanting";
import { Segmented } from "~/components/admin/balance/ui";
import { NumberInput } from "~/components/admin/fields";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { controlClass, numberClass } from "./ItemFormControls";
import {
  formatPreviewValue,
  previewCell,
  type PreviewCell,
  type PreviewRow,
} from "./itemFormModel";
import { isPercentStat, statLabel } from "./itemFormOptions";

export type OverrideChange = {
  kind: ItemStatOverrideKind;
  value: number;
} | null;

// The section surface (gray-950/45 over the admin background), opaque so the
// pinned stat column hides the cells scrolling under it.
const SECTION_SURFACE = "bg-[#101521]";

type Mode = "SCALED" | ItemStatOverrideKind;

const MODE_OPTIONS: ReadonlyArray<{
  value: Mode;
  label: string;
  title: string;
}> = [
  { value: "SCALED", label: "Scaled", title: "Use the level's global bonus" },
  {
    value: ItemStatOverrideKind.MULTIPLIER,
    label: "Multiplier",
    title: "Replace the level's global bonus for this item",
  },
  {
    value: ItemStatOverrideKind.ABSOLUTE,
    label: "Exact",
    title: "Set the final value; skips scaling",
  },
];

function explain(cell: PreviewCell, locked: string | null) {
  if (cell.value === null) return locked ?? "None at this level";
  const value = formatPreviewValue(cell.value);
  if (cell.override?.kind === ItemStatOverrideKind.ABSOLUTE) {
    return `Set to ${value} for this level`;
  }
  const base = formatPreviewValue(cell.baseTotal);
  const multiplier = formatPreviewValue(cell.multiplier);
  const math =
    !cell.scales && !cell.override
      ? `${base} (doesn't scale with enchanting)`
      : `${base} × ${multiplier}`;
  const capped =
    cell.uncapped !== null
      ? `, capped from ${formatPreviewValue(cell.uncapped)}`
      : "";
  const own = cell.override ? " (this item's multiplier)" : "";
  return `${math}${own} = ${value}${capped}`;
}

/** Where a stat that is missing at this level first appears. */
function unlockNote(row: PreviewRow, level: number) {
  const later = row.unlocks
    .map((u) => u.level)
    .filter((unlock) => unlock > level)
    .sort((a, b) => a - b)[0];
  return later ? `Unlocks at ${enchantLabel(later)}` : null;
}

function OverrideEditor(props: {
  statType: StatType;
  levelName: string;
  cell: PreviewCell;
  scaled: PreviewCell;
  onChange: (next: OverrideChange) => void;
}) {
  const { cell, scaled } = props;
  const mode: Mode = cell.override?.kind ?? "SCALED";
  const current = cell.value ?? 0;

  const setMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "SCALED") return props.onChange(null);
    // Start from what the cell shows now, so switching doesn't jump.
    props.onChange(
      next === ItemStatOverrideKind.MULTIPLIER
        ? { kind: next, value: scaled.multiplier }
        : { kind: next, value: Math.round(current * 100) / 100 },
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium text-white">
          {statLabel(props.statType)}{" "}
          <span className="text-white/45">at {props.levelName}</span>
        </div>
        <div className="mt-0.5 text-xs text-white/45">
          Scaled value:{" "}
          <span className="tabular-nums text-white/70">
            {scaled.value === null ? "none" : formatPreviewValue(scaled.value)}
          </span>
          {scaled.value !== null && scaled.scales
            ? ` (${formatPreviewValue(scaled.baseTotal)} × ${formatPreviewValue(scaled.globalMultiplier)})`
            : null}
        </div>
      </div>
      <Segmented
        label="How this level gets its value"
        value={mode}
        options={MODE_OPTIONS}
        onChange={setMode}
        className="w-full bg-white/[0.05] p-0.5 [&>button]:flex-1 [&>button]:px-2"
      />
      {cell.override ? (
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-white/60">
            {cell.override.kind === ItemStatOverrideKind.MULTIPLIER
              ? "Multiplier for this item"
              : "Final value"}
          </span>
          <NumberInput
            autoFocus
            step="0.01"
            className={cn(controlClass, numberClass)}
            value={cell.override.value}
            onValueChange={(value) => {
              if (value === null || !cell.override) return;
              props.onChange({ kind: cell.override.kind, value });
            }}
          />
        </label>
      ) : null}
      <p className="text-[11px] leading-snug text-white/40">
        {mode === "SCALED"
          ? "Follows the level's global bonus from /admin/enchanting."
          : mode === ItemStatOverrideKind.MULTIPLIER
            ? `Result: ${cell.value === null ? "none" : formatPreviewValue(cell.value)}. Replaces the global ×${formatPreviewValue(scaled.globalMultiplier)} for this item and stat only.`
            : "Skips scaling. Other items are not affected."}
      </p>
    </div>
  );
}

function GridCell(props: {
  row: PreviewRow;
  level: number;
  levelName: string;
  context: CellContext;
  onOverride: ((next: OverrideChange) => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const cell = previewCell(props.row, props.level, props.context);
  const kind = cell.override?.kind;
  const title = explain(cell, unlockNote(props.row, props.level));

  const button = (
    <button
      type="button"
      disabled={!props.onOverride}
      title={title}
      aria-label={`${statLabel(props.row.statType)} at ${props.levelName}: ${title}`}
      className={cn(
        "flex h-8 w-full items-center justify-end gap-1 rounded-md px-1.5 text-right text-[13px] tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:cursor-default",
        cell.override
          ? "bg-amber-400/[0.14] font-medium text-amber-100 enabled:hover:bg-amber-400/25"
          : cell.value === null
            ? "text-white/20 enabled:hover:bg-white/[0.06]"
            : "text-white/80 enabled:hover:bg-white/[0.07]",
        open && "ring-2 ring-amber-400/50",
      )}
    >
      {kind ? (
        <span
          aria-hidden
          className="text-[10px] font-semibold text-amber-300/80"
        >
          {kind === ItemStatOverrideKind.ABSOLUTE ? "=" : "×"}
        </span>
      ) : null}
      {cell.value === null ? "–" : formatPreviewValue(cell.value)}
    </button>
  );

  if (!props.onOverride) return button;
  const onOverride = props.onOverride;
  const scaled = previewCell(
    {
      ...props.row,
      overrides: props.row.overrides.filter((o) => o.level !== props.level),
    },
    props.level,
    props.context,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-0 p-4">
        <OverrideEditor
          statType={props.row.statType}
          levelName={props.levelName}
          cell={cell}
          scaled={scaled}
          onChange={onOverride}
        />
      </PopoverContent>
    </Popover>
  );
}

type CellContext = Parameters<typeof previewCell>[2];

/**
 * Every stat at every enchant level, computed like the game does. A cell can
 * be overridden for this item: its own multiplier or an exact value.
 */
export function EnchantScalingGrid(props: {
  rows: PreviewRow[];
  /** The levels this item's ladder reaches, in order. */
  levels: readonly number[];
  /** Global stat bonus (percent) per level. */
  bonuses: Readonly<Record<number, number>>;
  equipTo: ItemEquipTo | null;
  /** Null while the overrides are edited as CSV. */
  onOverride:
    | ((statType: StatType, level: number, next: OverrideChange) => void)
    | null;
}) {
  const onOverride = props.onOverride;
  const columns = [0, ...props.levels];
  const contextFor = (level: number): CellContext => ({
    equipTo: props.equipTo,
    bonusPercent: props.bonuses[level] ?? 0,
  });

  if (props.rows.length === 0) {
    return (
      <p className="rounded-lg bg-white/[0.03] px-3 py-3 text-sm text-white/40">
        Nothing to scale yet. Add damage, armor or stats and they show up here
        for every enchant level.
      </p>
    );
  }

  return (
    // Zero width with a full-width minimum: the grid fills the section and
    // scrolls inside it, without its table widening the page on small screens.
    <div className="w-0 min-w-full overflow-x-auto">
      <table
        className="w-full border-separate border-spacing-0 text-sm"
        style={{ minWidth: `${11 + columns.length * 4.25}rem` }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(
                "sticky left-0 z-10 w-44 pb-2 pr-3 text-left align-bottom text-[11px] font-medium uppercase tracking-wide text-white/35",
                SECTION_SURFACE,
              )}
            >
              Stat
            </th>
            {columns.map((level) => (
              <th
                key={level}
                scope="col"
                title={level === 0 ? "Not enchanted" : enchantLabel(level)}
                className={cn(
                  "px-1 pb-2 pt-2 text-right align-bottom font-normal",
                  level === 0 && "rounded-t-lg bg-white/[0.05]",
                )}
              >
                <div className="truncate text-xs font-semibold text-white/80">
                  {level === 0 ? "Base" : enchantBadge(level)}
                </div>
                <div className="text-[10px] tabular-nums text-white/35">
                  {level === 0
                    ? "\u00a0"
                    : `+${formatPreviewValue(props.bonuses[level] ?? 0)}%`}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, rowIndex) => {
            const scales = previewCell(row, 0, contextFor(0)).scales;
            const last = rowIndex === props.rows.length - 1;
            return (
              <tr key={row.statType}>
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 py-0.5 pr-3 text-left font-normal",
                    SECTION_SURFACE,
                  )}
                >
                  <div
                    className="truncate text-[13px] text-white/80"
                    title={row.statType}
                  >
                    {statLabel(row.statType)}
                    {isPercentStat(row.statType) ? (
                      <span className="text-white/35"> %</span>
                    ) : null}
                  </div>
                  {!scales ? (
                    <div className="text-[10px] leading-tight text-white/35">
                      Doesn&apos;t scale on weapons
                    </div>
                  ) : null}
                </th>
                {columns.map((level) => (
                  <td
                    key={level}
                    className={cn(
                      "px-0.5 py-0.5",
                      level === 0 && "bg-white/[0.05]",
                      level === 0 && last && "rounded-b-lg",
                    )}
                  >
                    <GridCell
                      row={row}
                      level={level}
                      levelName={level === 0 ? "Base" : enchantLabel(level)}
                      context={contextFor(level)}
                      // The base column is the base stats themselves.
                      onOverride={
                        onOverride && level > 0
                          ? (next) => onOverride(row.statType, level, next)
                          : null
                      }
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
