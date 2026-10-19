"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { StatType, STAT_METADATA } from "~/types/stats";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import {
  useCharacterSheet,
  type CharacterSheet,
} from "./CharacterSheetContext";
import {
  StatChange,
  StatIcon,
  formatStat,
  formatStatChange,
  roundStat,
} from "./stat-display";

/** One line of the sheet: a single stat, or a damage range (minimum, maximum). */
export type SheetEntry = {
  key: string;
  label: string;
  description: string;
  stats: readonly [StatType] | readonly [StatType, StatType];
};

function sentenceCase(label: string) {
  return label.charAt(0) + label.slice(1).toLowerCase();
}

function single(stat: StatType, label?: string): SheetEntry {
  return {
    key: stat,
    label: label ?? sentenceCase(STAT_METADATA[stat].label),
    description: STAT_METADATA[stat].description,
    stats: [stat],
  };
}

const PHYSICAL_DAMAGE: SheetEntry = {
  key: "physical-damage",
  label: "Physical damage",
  description: "Minimum to maximum physical damage per hit",
  stats: [StatType.PHYSICAL_DAMAGE_MIN, StatType.PHYSICAL_DAMAGE_MAX],
};

const MAGIC_DAMAGE: SheetEntry = {
  key: "magic-damage",
  label: "Magic damage",
  description: "Minimum to maximum magic damage per hit",
  stats: [StatType.MAGIC_DAMAGE_MIN, StatType.MAGIC_DAMAGE_MAX],
};

/** The six numbers in the character banner, with their short tile labels. */
export const HEADLINE_ENTRIES: Array<{ entry: SheetEntry; short: string }> = [
  { entry: PHYSICAL_DAMAGE, short: "Physical" },
  { entry: MAGIC_DAMAGE, short: "Magic" },
  { entry: single(StatType.ARMOR), short: "Armor" },
  { entry: single(StatType.ATTACK_SPEED), short: "Attack speed" },
  { entry: single(StatType.CRITICAL_CHANCE), short: "Critical" },
  { entry: single(StatType.ACCURACY), short: "Accuracy" },
];

/** Two columns of roughly equal height on wide panels. */
const SHEET_COLUMNS: Array<Array<{ title: string; entries: SheetEntry[] }>> = [
  [
    {
      title: "Vitals",
      entries: [
        single(StatType.HEALTH),
        single(StatType.HEALTH_REGEN),
        single(StatType.MANA),
        single(StatType.MANA_REGEN),
      ],
    },
    {
      title: "Offense",
      entries: [
        PHYSICAL_DAMAGE,
        MAGIC_DAMAGE,
        single(StatType.CRITICAL_CHANCE),
        single(StatType.CRITICAL_DAMAGE),
        single(StatType.ATTACK_SPEED),
        single(StatType.ACCURACY),
      ],
    },
    {
      title: "Defense",
      entries: [
        single(StatType.ARMOR),
        single(StatType.MAGIC_RESIST),
        single(StatType.BLOCK_CHANCE),
        single(StatType.EVASION_MELEE),
        single(StatType.EVASION_RANGED),
        single(StatType.EVASION_MAGIC),
      ],
    },
  ],
  [
    {
      title: "Resistances",
      entries: [
        single(StatType.FIRE_RESIST),
        single(StatType.COLD_RESIST),
        single(StatType.LIGHTNING_RESIST),
        single(StatType.POISON_RESIST),
      ],
    },
    {
      title: "Utility",
      entries: [
        single(StatType.CARRYING_CAPACITY),
        single(StatType.MOVEMENT_SPEED),
        single(StatType.LUCK),
        single(StatType.GOLD_FIND),
        single(StatType.EXPERIENCE_GAIN),
        single(StatType.LIFESTEAL),
        single(StatType.THORNS),
        single(StatType.PRAYER_POINTS),
      ],
    },
    {
      title: "Efficiency",
      entries: [
        single(StatType.WOODCUTTING_EFFICIENCY, "Woodcutting"),
        single(StatType.MINING_EFFICIENCY, "Mining"),
        single(StatType.FISHING_EFFICIENCY, "Fishing"),
        single(StatType.GATHERING_EFFICIENCY, "Gathering"),
        single(StatType.HUNTING_EFFICIENCY, "Hunting"),
      ],
    },
  ],
];

/** The entry's value from one source, e.g. "12–18" or "7.0%". */
export function formatEntry(
  entry: SheetEntry,
  values: Partial<Record<StatType, number>>,
) {
  const [first, second] = entry.stats;
  if (second) {
    const min = roundStat(first, values[first] ?? 0);
    const max = roundStat(second, values[second] ?? 0);
    return `${min}–${max}`;
  }
  return formatStat(first, values[first] ?? 0);
}

function isZero(entry: SheetEntry, values: Record<StatType, number>) {
  return entry.stats.every((stat) => roundStat(stat, values[stat]) === 0);
}

/** A source's contribution, signed: "+8–12", "−0.45". Null when it adds nothing. */
function formatContribution(
  entry: SheetEntry,
  values: Partial<Record<StatType, number>>,
) {
  const [first, second] = entry.stats;
  const a = values[first] ?? 0;
  const b = second ? values[second] ?? 0 : 0;
  if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) return null;
  if (second) {
    return `${formatStatChange(first, a)}–${formatStatChange(second, b).slice(1)}`;
  }
  return formatStatChange(first, a);
}

function isBoosted(entry: SheetEntry, sheet: CharacterSheet) {
  return entry.stats.some((stat) => (sheet.meal[stat] ?? 0) !== 0);
}

/** Where a value comes from: base, gear and meal, and any cap that applies. */
export function StatTooltip({
  entry,
  children,
}: {
  entry: SheetEntry;
  children: ReactNode;
}) {
  const sheet = useCharacterSheet();
  const gear = formatContribution(entry, sheet.gear);
  const meal = formatContribution(entry, sheet.meal);
  const capped = entry.stats.some(
    (stat) =>
      roundStat(stat, sheet.totals[stat]) !==
      roundStat(stat, sheet.final[stat]),
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="w-60 space-y-2 py-2.5">
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            {entry.label}
          </p>
          <p className="mt-0.5 text-muted-foreground">{entry.description}</p>
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
          <dt className="text-muted-foreground">Base</dt>
          <dd className="text-right text-text-secondary">
            {formatEntry(entry, sheet.base)}
          </dd>
          {gear ? (
            <>
              <dt className="text-muted-foreground">Gear</dt>
              <dd className="text-right text-text-secondary">{gear}</dd>
            </>
          ) : null}
          {meal ? (
            <>
              <dt className="text-muted-foreground">Meal</dt>
              <dd className="text-right text-primary">{meal}</dd>
            </>
          ) : null}
          <dt className="font-semibold text-foreground">Total</dt>
          <dd className="text-right font-semibold text-foreground">
            {formatEntry(entry, sheet.final)}
          </dd>
        </dl>
        {capped ? (
          <p className="text-warning">
            Capped from {formatEntry(entry, sheet.totals)}
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function SheetRow({ entry }: { entry: SheetEntry }) {
  const sheet = useCharacterSheet();
  const zero = isZero(entry, sheet.final);
  const boosted = isBoosted(entry, sheet);

  return (
    <StatTooltip entry={entry}>
      <div
        tabIndex={0}
        className="flex min-h-[34px] items-center gap-2.5 rounded-lg px-1.5 outline-none transition-colors duration-150 hover:bg-secondary/45 focus-visible:bg-secondary/45 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-md bg-background/45",
            zero && "opacity-45",
          )}
        >
          <StatIcon stat={entry.stats[0]} size={20} />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px]",
            zero ? "text-muted-foreground/80" : "text-text-secondary",
          )}
        >
          {entry.label}
        </span>
        <StatChange stats={entry.stats} changes={sheet.changes} />
        <strong
          className={cn(
            "shrink-0 text-[13px] font-semibold tabular-nums",
            boosted
              ? "text-primary"
              : zero
                ? "text-muted-foreground"
                : "text-foreground",
          )}
        >
          {formatEntry(entry, sheet.final)}
        </strong>
      </div>
    </StatTooltip>
  );
}

export function AttributeSheet({ className }: { className?: string }) {
  const { mealEffect } = useCharacterSheet();

  return (
    <section
      id="attributes"
      aria-labelledby="attributes-heading"
      className={cn(
        "game-panel-flat min-w-0 scroll-mt-24 p-4 [container-type:inline-size] sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="attributes-heading" className="game-section-title">
            Attributes
          </h2>
          <p className="text-xs text-muted-foreground">
            {mealEffect ? "Gear and meal included" : "Gear included"}
          </p>
        </div>
        {mealEffect ? (
          <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary/10 py-1 pl-1 pr-3 text-xs font-medium text-primary">
            <Image
              src={mealEffect.item.sprite}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            {mealEffect.item.name}
          </span>
        ) : null}
      </div>

      <TooltipProvider delayDuration={150}>
        <div className="grid gap-3 [@container(min-width:456px)]:grid-cols-2">
          {SHEET_COLUMNS.map((column, index) => (
            <div key={index} className="grid min-w-0 content-start gap-3">
              {column.map((group) => (
                <section
                  key={group.title}
                  aria-label={group.title}
                  className="min-w-0 rounded-xl bg-surface-inset/55 p-1.5"
                >
                  <h3 className="px-1.5 pb-1 pt-1 text-[11px] font-semibold text-muted-foreground">
                    {group.title}
                  </h3>
                  {group.entries.map((entry) => (
                    <SheetRow key={entry.key} entry={entry} />
                  ))}
                </section>
              ))}
            </div>
          ))}
        </div>
      </TooltipProvider>
    </section>
  );
}
