"use client";

import React, { useState } from "react";
import {
  type ItemEquipTo,
  type ItemRarity,
  ItemStatRarityOverrideKind,
  type StatType,
} from "~/generated/prisma/enums";
import { Segmented } from "~/components/admin/balance/ui";
import { NumberInput } from "~/components/admin/fields";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { resolveRarityTextColor } from "~/utils/rarity-colors";
import { controlClass, numberClass } from "./ItemFormControls";
import {
  formatPreviewValue,
  previewCell,
  type PreviewCell,
  type PreviewRow,
  type RarityConfigPreview,
} from "./itemFormModel";
import { isPercentStat, rarityLabel, statLabel } from "./itemFormOptions";

export type OverrideChange = {
  kind: ItemStatRarityOverrideKind;
  value: number;
} | null;

type CellContext = Parameters<typeof previewCell>[2];

// The section surface (gray-950/45 over the admin background), opaque so the
// pinned stat column hides the cells scrolling under it.
const SECTION_SURFACE = "bg-[#101521]";

type Mode = "SCALED" | ItemStatRarityOverrideKind;

const MODE_OPTIONS: ReadonlyArray<{
  value: Mode;
  label: string;
  title: string;
}> = [
  { value: "SCALED", label: "Scaled", title: "Use the global multiplier" },
  {
    value: ItemStatRarityOverrideKind.MULTIPLIER,
    label: "Multiplier",
    title: "Replace the global multiplier for this item",
  },
  {
    value: ItemStatRarityOverrideKind.ABSOLUTE,
    label: "Exact",
    title: "Set the final value; skips scaling",
  },
];

function explain(
  cell: PreviewCell,
  flipNegatives: boolean,
  locked: string | null,
) {
  if (cell.value === null) return locked ?? "None at this rarity";
  const value = formatPreviewValue(cell.value);
  if (cell.override?.kind === ItemStatRarityOverrideKind.ABSOLUTE) {
    return `Set to ${value} for this rarity`;
  }
  const base = formatPreviewValue(cell.baseTotal);
  const multiplier = formatPreviewValue(cell.multiplier);
  const math =
    !cell.scales && !cell.override
      ? `${base} (doesn't scale with rarity)`
      : flipNegatives && cell.baseTotal < 0
        ? `${base} improved by ×${multiplier}`
        : `${base} × ${multiplier}`;
  const capped =
    cell.uncapped !== null
      ? `, capped from ${formatPreviewValue(cell.uncapped)}`
      : "";
  const own = cell.override ? " (this item's multiplier)" : "";
  return `${math}${own} = ${value}${capped}`;
}

/** Where a stat that is missing at this rarity first appears. */
function unlockNote(
  row: PreviewRow,
  rarity: ItemRarity,
  context: CellContext,
  configs: readonly RarityConfigPreview[] | null,
) {
  const here = context.rarityIndex.get(rarity) ?? 0;
  const later = row.progressions
    .map((p) => p.unlocksAtRarity)
    .filter((unlock) => (context.rarityIndex.get(unlock) ?? -1) > here)
    .sort(
      (a, b) =>
        (context.rarityIndex.get(a) ?? 0) - (context.rarityIndex.get(b) ?? 0),
    )[0];
  return later ? `Unlocks at ${rarityLabel(later, configs)}` : null;
}

function OverrideEditor(props: {
  statType: StatType;
  rarityName: string;
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
      next === ItemStatRarityOverrideKind.MULTIPLIER
        ? { kind: next, value: scaled.multiplier }
        : { kind: next, value: Math.round(current * 100) / 100 },
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium text-white">
          {statLabel(props.statType)}{" "}
          <span className="text-white/45">at {props.rarityName}</span>
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
        label="How this rarity gets its value"
        value={mode}
        options={MODE_OPTIONS}
        onChange={setMode}
        className="w-full bg-white/[0.05] p-0.5 [&>button]:flex-1 [&>button]:px-2"
      />
      {cell.override ? (
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium text-white/60">
            {cell.override.kind === ItemStatRarityOverrideKind.MULTIPLIER
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
          ? "Follows the rarity's global multiplier."
          : mode === ItemStatRarityOverrideKind.MULTIPLIER
            ? `Result: ${cell.value === null ? "none" : formatPreviewValue(cell.value)}. Replaces the global ×${formatPreviewValue(scaled.globalMultiplier)} for this item and stat only.`
            : "Skips scaling. Other items are not affected."}
      </p>
    </div>
  );
}

function GridCell(props: {
  row: PreviewRow;
  rarity: ItemRarity;
  rarityName: string;
  context: CellContext;
  configs: readonly RarityConfigPreview[] | null;
  onOverride: ((next: OverrideChange) => void) | null;
}) {
  const [open, setOpen] = useState(false);
  const cell = previewCell(props.row, props.rarity, props.context);
  const kind = cell.override?.kind;
  const title = explain(
    cell,
    props.context.flipNegatives,
    unlockNote(props.row, props.rarity, props.context, props.configs),
  );

  const button = (
    <button
      type="button"
      disabled={!props.onOverride}
      title={title}
      aria-label={`${statLabel(props.row.statType)} at ${props.rarityName}: ${title}`}
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
          {kind === ItemStatRarityOverrideKind.ABSOLUTE ? "=" : "×"}
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
      overrides: props.row.overrides.filter((o) => o.rarity !== props.rarity),
    },
    props.rarity,
    props.context,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{button}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-0 p-4">
        <OverrideEditor
          statType={props.row.statType}
          rarityName={props.rarityName}
          cell={cell}
          scaled={scaled}
          onChange={onOverride}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Every stat at every rarity, computed like the game does. A cell can be
 * overridden for this item: its own multiplier or an exact value.
 */
export function RarityScalingGrid(props: {
  rows: PreviewRow[];
  rarities: readonly ItemRarity[];
  configs: readonly RarityConfigPreview[] | null;
  multipliers: ReadonlyMap<ItemRarity, number>;
  rarityIndex: ReadonlyMap<ItemRarity, number>;
  equipTo: ItemEquipTo | null;
  flipNegatives: boolean;
  /** The template's rarity, which new copies start at. */
  itemRarity: ItemRarity;
  /** Null while the overrides are edited as CSV. */
  onOverride:
    | ((statType: StatType, rarity: ItemRarity, next: OverrideChange) => void)
    | null;
}) {
  const context: CellContext = {
    rarityIndex: props.rarityIndex,
    multipliers: props.multipliers,
    equipTo: props.equipTo,
    flipNegatives: props.flipNegatives,
  };
  const onOverride = props.onOverride;

  if (props.rows.length === 0) {
    return (
      <p className="rounded-lg bg-white/[0.03] px-3 py-3 text-sm text-white/40">
        Nothing to scale yet. Add damage, armor or stats and they show up here
        for every rarity.
      </p>
    );
  }

  return (
    // Zero width with a full-width minimum: the grid fills the section and
    // scrolls inside it, without its table widening the page on small screens.
    <div className="w-0 min-w-full overflow-x-auto">
      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
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
            {props.rarities.map((rarity) => {
              const config = props.configs?.find((c) => c.rarity === rarity);
              const isItemRarity = rarity === props.itemRarity;
              return (
                <th
                  key={rarity}
                  scope="col"
                  title={isItemRarity ? "This item's rarity" : undefined}
                  className={cn(
                    "px-1 pb-2 pt-2 text-right align-bottom font-normal",
                    isItemRarity && "rounded-t-lg bg-white/[0.05]",
                  )}
                >
                  <div
                    className="truncate text-xs font-semibold"
                    style={{
                      color: resolveRarityTextColor(rarity, config?.color),
                    }}
                  >
                    {rarityLabel(rarity, props.configs)}
                  </div>
                  <div className="text-[10px] tabular-nums text-white/35">
                    ×{formatPreviewValue(props.multipliers.get(rarity) ?? 1)}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, rowIndex) => {
            const scales = previewCell(row, props.itemRarity, context).scales;
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
                {props.rarities.map((rarity) => (
                  <td
                    key={rarity}
                    className={cn(
                      "px-0.5 py-0.5",
                      rarity === props.itemRarity && "bg-white/[0.05]",
                      rarity === props.itemRarity && last && "rounded-b-lg",
                    )}
                  >
                    <GridCell
                      row={row}
                      rarity={rarity}
                      rarityName={rarityLabel(rarity, props.configs)}
                      context={context}
                      configs={props.configs}
                      onOverride={
                        onOverride
                          ? (next) => onOverride(row.statType, rarity, next)
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
