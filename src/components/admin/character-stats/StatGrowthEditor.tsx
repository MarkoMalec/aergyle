"use client";

import React, { useMemo, useState } from "react";
import { RotateCcw, Save, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import {
  adminRequest,
  inputClass,
  NumberField,
  NumberInput,
} from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { STAT_METADATA, StatCategory, type StatType } from "~/types/stats";
import {
  calculateLevelBaseStats,
  getDefaultStatGrowthRules,
  LEVEL_SCALED_STAT_TYPES,
  type StatGrowthRule,
} from "~/utils/stats";

type Rules = Record<StatType, StatGrowthRule>;

const CATEGORIES = [
  { category: StatCategory.CHARACTER, label: "Vitals" },
  { category: StatCategory.OFFENSIVE, label: "Offense" },
  { category: StatCategory.DEFENSIVE, label: "Defense" },
  { category: StatCategory.RESISTANCE, label: "Resistances" },
  { category: StatCategory.SPECIAL, label: "Utility & vocations" },
] as const;

const cellInputClass = cn(inputClass, "w-24 py-1.5 text-right");

// Six significant digits show small rules such as 0.001 while hiding float
// noise such as 1.1960000000000002.
function tidy(value: number) {
  return Number(value.toPrecision(6));
}

function formatValue(value: number, statType: StatType) {
  const suffix = STAT_METADATA[statType].formatType === "percentage" ? "%" : "";
  return `${tidy(value)}${suffix}`;
}

function formatChange(from: number, to: number, statType: StatType) {
  const delta = tidy(to - from);
  if (Math.abs(delta) < 1e-9) return "—";
  const sign = delta > 0 ? "+" : "−";
  const absolute = `${sign}${formatValue(Math.abs(delta), statType)}`;
  // A relative change of a percentage stat reads as a second percentage.
  if (STAT_METADATA[statType].formatType === "percentage" || from <= 0) {
    return absolute;
  }
  return `${absolute} (${sign}${Math.abs((delta / from) * 100).toFixed(1)}%)`;
}

function capReachedAt(rule: StatGrowthRule) {
  if (rule.perLevel <= 0) return "No growth";
  if (rule.maxBonus === null) return "Never";
  // The epsilon keeps float noise (e.g. 100.00000000000001) from adding a level.
  return `Level ${1 + Math.ceil(rule.maxBonus / rule.perLevel - 1e-9)}`;
}

function sameRule(a: StatGrowthRule, b: StatGrowthRule) {
  return (
    a.baseValue === b.baseValue &&
    a.perLevel === b.perLevel &&
    a.maxBonus === b.maxBonus
  );
}

export function StatGrowthEditor(props: {
  initial: Rules;
  highestLevel: number;
}) {
  const [saved, setSaved] = useState(props.initial);
  const [draft, setDraft] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  const [levelA, setLevelA] = useState(48);
  const [levelB, setLevelB] = useState(50);

  const statsA = useMemo(
    () => calculateLevelBaseStats(levelA, draft),
    [levelA, draft],
  );
  const statsB = useMemo(
    () => calculateLevelBaseStats(levelB, draft),
    [levelB, draft],
  );
  const groups = useMemo(
    () =>
      CATEGORIES.map(({ category, label }) => ({
        label,
        stats: LEVEL_SCALED_STAT_TYPES.filter(
          (statType) => STAT_METADATA[statType].category === category,
        ).sort((a, b) => STAT_METADATA[a].priority - STAT_METADATA[b].priority),
      })).filter((group) => group.stats.length > 0),
    [],
  );
  const dirtyCount = LEVEL_SCALED_STAT_TYPES.filter(
    (statType) => !sameRule(draft[statType], saved[statType]),
  ).length;

  const update = (statType: StatType, patch: Partial<StatGrowthRule>) =>
    setDraft((rules) => ({
      ...rules,
      [statType]: { ...rules[statType], ...patch },
    }));

  const save = async () => {
    setSaving(true);
    try {
      await adminRequest("/api/admin/character-stats", "PATCH", {
        rules: LEVEL_SCALED_STAT_TYPES.map((statType) => ({
          statType,
          ...draft[statType],
        })),
      });
      setSaved(draft);
      toast.success("Stat growth saved for every character");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-xl bg-gray-950/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4 text-amber-300" aria-hidden="true" />
            Base stats by level
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            A character&apos;s base stat is its{" "}
            <strong className="text-white/70">level 1 value</strong> plus{" "}
            <strong className="text-white/70">per level</strong> for every level
            above 1, until the bonus reaches its{" "}
            <strong className="text-white/70">cap</strong>. Gear and effects are
            added on top. Because each level adds the same amount, it is a
            smaller share of the total at higher levels, which keeps nearby
            levels close. Cap chance-based stats so gear stays their main
            source.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => setDraft(getDefaultStatGrowthRules())}
            disabled={saving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Load defaults
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || dirtyCount === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving
              ? "Saving…"
              : dirtyCount > 0
                ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`
                : "Saved"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl bg-white/[0.03] p-4">
        <NumberField
          label="Compare level"
          className="w-36"
          value={levelA}
          min={1}
          onChange={(value) => setLevelA(Math.max(1, Math.floor(value) || 1))}
        />
        <NumberField
          label="With level"
          className="w-36"
          value={levelB}
          min={1}
          onChange={(value) => setLevelB(Math.max(1, Math.floor(value) || 1))}
        />
        <p className="max-w-xl pb-2 text-xs text-white/45">
          The preview uses unsaved values and base stats only (no gear). Try 1
          and 50 for the long-term gain, or two nearby levels for the
          step-by-step gain.{" "}
          {`The highest character is level ${props.highestLevel}.`} Saving
          applies at once to every existing character at their current level.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white/[0.02]">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="text-left text-xs text-white/45">
            <tr>
              <th className="px-3 py-2 font-medium">Stat</th>
              <th className="px-3 py-2 text-right font-medium">Level 1</th>
              <th className="px-3 py-2 text-right font-medium">Per level</th>
              <th className="px-3 py-2 text-right font-medium">Bonus cap</th>
              <th className="px-3 py-2 font-medium">Cap reached</th>
              <th className="px-3 py-2 text-right font-medium">
                Level {levelA}
              </th>
              <th className="px-3 py-2 text-right font-medium">
                Level {levelB}
              </th>
              <th className="px-3 py-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.label}>
              <tr>
                <th
                  colSpan={8}
                  className="border-t border-white/10 px-3 pb-1 pt-4 text-left text-xs font-semibold uppercase tracking-wide text-amber-300/80"
                >
                  {group.label}
                </th>
              </tr>
              {group.stats.map((statType) => {
                const rule = draft[statType];
                const dirty = !sameRule(rule, saved[statType]);
                return (
                  <tr
                    key={statType}
                    className={cn(dirty && "bg-amber-400/[0.06]")}
                  >
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        {STAT_METADATA[statType].label}
                        {dirty ? (
                          <span className="text-[10px] uppercase text-amber-300">
                            unsaved
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        aria-label={`${STAT_METADATA[statType].label} at level 1`}
                        className={cn(cellInputClass, "ml-auto block")}
                        step="any"
                        value={rule.baseValue}
                        onValueChange={(value) => {
                          if (value !== null) {
                            update(statType, { baseValue: value });
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        aria-label={`${STAT_METADATA[statType].label} per level`}
                        className={cn(cellInputClass, "ml-auto block")}
                        step="any"
                        min={0}
                        value={rule.perLevel}
                        onValueChange={(value) => {
                          if (value !== null) {
                            update(statType, { perLevel: Math.max(0, value) });
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <NumberInput
                        aria-label={`${STAT_METADATA[statType].label} level bonus cap`}
                        className={cn(cellInputClass, "ml-auto block")}
                        step="any"
                        min={0}
                        placeholder="None"
                        value={rule.maxBonus}
                        onValueChange={(value) =>
                          update(statType, {
                            maxBonus:
                              value === null ? null : Math.max(0, value),
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-1.5 text-xs text-white/45">
                      {capReachedAt(rule)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-white/70">
                      {formatValue(statsA[statType], statType)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-white/70">
                      {formatValue(statsB[statType], statType)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-white/55">
                      {formatChange(
                        statsA[statType],
                        statsB[statType],
                        statType,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="text-xs text-white/40">
        Carrying capacity is not listed: it comes from backpacks and is stored
        on the inventory when equipment changes, so it cannot follow level.
      </p>
    </section>
  );
}
