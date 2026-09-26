"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FlaskConical, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { adminRequest, inputClass, NumberInput, Panel } from "~/components/admin/fields";
import { Tag } from "~/components/admin/players/shared";
import { Button } from "~/components/ui/button";
import type { LevelCurve } from "~/generated/prisma/enums";
import {
  applyPreset,
  bandMultiplier,
  buildCurve,
  CURVE_LABELS,
  CURVE_PRESETS,
  curveFromTotals,
  curveProblems,
  DEFAULT_CURVE_DESIGNS,
  largestFitting,
  levelForXp,
  presetAnchorLevel,
  scaleDesignToTotal,
  totalXpForLevel,
  type CurveDesign,
  type CurveTable,
} from "~/game/balance/curve";
import {
  SKILL_LABELS,
  type BalanceContent,
  type Skill,
} from "~/game/balance/content";
import { PLAYER_PROFILES, simulateJourney, type JourneyPlan } from "~/game/balance/journey";
import { DEFAULT_SOURCE_OPTIONS, groupsWithContent } from "~/game/balance/sources";
import { cn } from "~/lib/utils";
import type { SavedCurve } from "~/server/balance/leveling";
import { formatChange, formatDays, formatTimeAxis, formatXp, TIME_TICKS_DAYS } from "./format";
import { LineChart, REFERENCE_COLOR, SERIES_COLORS, type ChartSeries } from "./LineChart";
import { Segmented, SliderField, StatTile } from "./ui";

type View = "time" | "step" | "total";
type ProfileId = (typeof PLAYER_PROFILES)[number]["id"];

const HORIZON_DAYS = 3_650;
const CURVES: LevelCurve[] = ["CHARACTER", "SKILL"];
const TABLE_STEPS = [1, 5, 10, 25, 50, 100] as const;

function sameDesign(a: CurveDesign, b: CurveDesign) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function daysAt(days: Float64Array | null, level: number) {
  const value = days?.[level];
  return value === undefined || Number.isNaN(value) ? null : value;
}

/** Days to reach every level of `curveKey` for one profile and focus. */
function pacing(
  content: BalanceContent,
  curves: { character: CurveTable; skill: CurveTable },
  curveKey: LevelCurve,
  profileId: ProfileId,
  plan: JourneyPlan,
  skill: Skill,
) {
  const profile = PLAYER_PROFILES.find((entry) => entry.id === profileId)!.profile;
  const result = simulateJourney({
    content,
    curves,
    profile,
    plan,
    options: DEFAULT_SOURCE_OPTIONS,
    days: HORIZON_DAYS,
  });
  return curveKey === "CHARACTER" ? result.reachedDay.CHARACTER : result.reachedDay[skill];
}

export function LevelingDesigner(props: {
  curves: Record<LevelCurve, SavedCurve>;
  content: BalanceContent;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const curveKey: LevelCurve = searchParams.get("curve") === "skill" ? "SKILL" : "CHARACTER";
  const saved = props.curves[curveKey];

  const [drafts, setDrafts] = useState<Record<LevelCurve, CurveDesign>>(() => ({
    CHARACTER: props.curves.CHARACTER.design,
    SKILL: props.curves.SKILL.design,
  }));
  const [view, setView] = useState<View>("time");
  const [logY, setLogY] = useState(true);
  const [profileId, setProfileId] = useState<ProfileId>("regular");
  const [strategy, setStrategy] = useState<JourneyPlan["strategy"]>("split");
  const [tableStep, setTableStep] = useState<(typeof TABLE_STEPS)[number]>(10);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => groupsWithContent(props.content), [props.content]);
  const skills = useMemo(() => {
    const list = groups.filter((group): group is Skill => group !== "DUNGEONS");
    if (props.content.seeds.length > 0 && !list.includes("GARDENING")) list.push("GARDENING");
    return list;
  }, [groups, props.content.seeds.length]);
  const [skill, setSkill] = useState<Skill>(skills[0] ?? "WOODCUTTING");

  const draft = drafts[curveKey];
  const setDraft = (next: CurveDesign) => setDrafts((all) => ({ ...all, [curveKey]: next }));
  const patch = (changes: Partial<CurveDesign>) => setDraft({ ...draft, ...changes });

  const problems = useMemo(() => curveProblems(draft), [draft]);
  const draftCurve = useMemo(() => buildCurve(draft), [draft]);
  const savedCurve = useMemo(() => curveFromTotals(saved.totals), [saved.totals]);
  const dirty = !saved.designSaved || !sameDesign(draft, saved.design);

  // A table generated before designs were stored may not match its default.
  const unsavedTableDiff = useMemo(() => {
    if (saved.designSaved) return { levels: 0, largest: 0 };
    const generated = buildCurve(saved.design).totals;
    let levels = 0;
    let largest = 0;
    for (let level = 2; level < Math.max(generated.length, saved.totals.length); level += 1) {
      const a = generated[level];
      const b = saved.totals[level];
      if (a === b) continue;
      levels += 1;
      largest = a && b ? Math.max(largest, Math.abs(a / b - 1)) : Infinity;
    }
    return { levels, largest };
  }, [saved]);

  const impact = useMemo(() => {
    let up = 0;
    let down = 0;
    let total = 0;
    for (const [xp, count] of saved.playerXp) {
      total += count;
      const before = levelForXp(savedCurve, xp);
      const after = levelForXp(draftCurve, xp);
      if (after > before) up += count;
      if (after < before) down += count;
    }
    return { up, down, total };
  }, [saved.playerXp, savedCurve, draftCurve]);

  const plan: JourneyPlan = useMemo(
    () =>
      curveKey === "CHARACTER"
        ? { groups, strategy, garden: props.content.seeds.length > 0, quests: true }
        : skill === "GARDENING"
          ? { groups: [], strategy: "split", garden: true, quests: false }
          : { groups: [skill], strategy: "split", garden: false, quests: false },
    [curveKey, groups, strategy, skill, props.content.seeds.length],
  );
  // The other curve is simulated as saved unless it has been edited too.
  const otherKey: LevelCurve = curveKey === "CHARACTER" ? "SKILL" : "CHARACTER";
  const otherDraft = drafts[otherKey];
  const otherSaved = props.curves[otherKey];
  const otherDraftCurve = useMemo(
    () =>
      sameDesign(otherDraft, otherSaved.design)
        ? curveFromTotals(otherSaved.totals)
        : buildCurve(otherDraft),
    [otherDraft, otherSaved],
  );
  // A simulated decade takes ~20 ms, so the chart follows a dragged slider
  // directly. A design that overflows is simulated on the levels it has.
  const draftDays = useMemo(
    () =>
      pacing(
        props.content,
        curveKey === "CHARACTER"
          ? { character: draftCurve, skill: otherDraftCurve }
          : { character: otherDraftCurve, skill: draftCurve },
        curveKey,
        profileId,
        plan,
        skill,
      ),
    [props.content, draftCurve, otherDraftCurve, curveKey, profileId, plan, skill],
  );
  const savedDays = useMemo(
    () =>
      pacing(
        props.content,
        {
          character: curveFromTotals(props.curves.CHARACTER.totals),
          skill: curveFromTotals(props.curves.SKILL.totals),
        },
        curveKey,
        profileId,
        plan,
        skill,
      ),
    [props.content, props.curves, curveKey, profileId, plan, skill],
  );

  const series = useMemo((): ChartSeries[] => {
    const make = (id: string, label: string, color: string, curve: CurveTable, days: Float64Array | null) => {
      const points: Array<[number, number]> = [];
      for (let level = 2; level <= curve.maxLevel; level += 1) {
        const y =
          view === "time"
            ? daysAt(days, level) ?? Number.NaN
            : view === "step"
              ? curve.totals[level]! - curve.totals[level - 1]!
              : curve.totals[level]!;
        points.push([level, y]);
      }
      return { id, label, color, points };
    };
    // The draft is drawn last so it stays visible where the curves agree.
    return [
      make("saved", "Saved", REFERENCE_COLOR, savedCurve, savedDays),
      make("draft", "Draft", SERIES_COLORS[0], draftCurve, draftDays),
    ];
  }, [view, draftCurve, savedCurve, draftDays, savedDays]);

  const overflowAt = draftCurve.maxLevel < draft.maxLevel ? draftCurve.maxLevel : null;
  const fixes = useMemo(
    () =>
      overflowAt === null
        ? null
        : {
            growth: draft.growthPercent > 0 ? largestFitting(draft, "growthPercent", 0.05) : null,
            power: draft.power > 0 ? largestFitting(draft, "power", 0.05) : null,
          },
    [draft, overflowAt],
  );

  /** Percent change of the charted value, draft over saved, per level. */
  const change = useMemo(() => {
    const points: Array<[number, number]> = [];
    const valueAt = (curve: CurveTable, days: Float64Array, level: number) =>
      view === "time"
        ? daysAt(days, level)
        : view === "step"
          ? curve.totals[level]! - curve.totals[level - 1]!
          : curve.totals[level]!;
    const top = Math.min(draftCurve.maxLevel, savedCurve.maxLevel);
    let low = Infinity;
    let high = -Infinity;
    // Levels reached within the first hour mostly come from one-time quest
    // XP, where a few minutes' difference reads as a huge percentage.
    const floor = view === "time" ? 1 / 24 : 0;
    for (let level = 2; level <= top; level += 1) {
      const a = valueAt(draftCurve, draftDays, level);
      const b = valueAt(savedCurve, savedDays, level);
      if (a === null || b === null || !(b > floor)) continue;
      const percent = (a / b - 1) * 100;
      points.push([level, percent]);
      low = Math.min(low, percent);
      high = Math.max(high, percent);
    }
    if (points.length === 0) return { points, low: 0, high: 0, typical: 0 };
    const sorted = points.map(([, percent]) => percent).sort((a, b) => a - b);
    return { points, low, high, typical: sorted[Math.floor(sorted.length / 2)]! };
  }, [view, draftCurve, savedCurve, draftDays, savedDays]);
  const differs =
    Math.max(Math.abs(change.low), Math.abs(change.high)) > 0.05 ||
    draftCurve.maxLevel !== savedCurve.maxLevel;
  // Percentages read best for moderate changes, multiples for large ones;
  // one format per chart so the axis, tooltip and summary agree.
  const asMultiple = change.high >= 200 || change.low <= -66.7;
  const formatPercentChange = (percent: number) => {
    if (asMultiple) {
      const ratio = 1 + percent / 100;
      return `×${ratio < 1 ? ratio.toFixed(2) : ratio < 10 ? ratio.toFixed(1) : ratio.toFixed(0)}`;
    }
    const size = Math.abs(percent);
    return `${percent > 0 ? "+" : percent < 0 ? "−" : ""}${size < 10 ? size.toFixed(1) : size.toFixed(0)}%`;
  };
  const changeSummary =
    Math.abs(change.high - change.low) < 0.5
      ? `${formatPercentChange(change.typical)} at every level`
      : `Typically ${formatPercentChange(change.typical)} (from ${formatPercentChange(change.low)} to ${formatPercentChange(change.high)})`;

  const lastReached = (() => {
    for (let level = draftCurve.maxLevel; level > 1; level -= 1) {
      if (daysAt(draftDays, level) !== null) return level;
    }
    return 1;
  })();
  const milestones = (draft.maxLevel > 100 ? [50, 100] : [10, 50]).filter(
    (level) => level < draftCurve.maxLevel,
  );

  const markers =
    view === "time"
      ? draft.targets
          .filter((target) => target.level >= 2 && target.days > 0)
          .map((target) => ({
            x: target.level,
            y: target.days,
            label: `Target: level ${target.level} in ${formatDays(target.days)}`,
          }))
      : [];

  const tableLevels = useMemo(() => {
    const levels = new Set<number>();
    for (let level = tableStep === 1 ? 2 : tableStep; level <= draftCurve.maxLevel; level += tableStep) {
      levels.add(level);
    }
    levels.add(draftCurve.maxLevel);
    for (const target of draft.targets) {
      if (target.level >= 2 && target.level <= draftCurve.maxLevel) levels.add(target.level);
    }
    return [...levels].sort((a, b) => a - b);
  }, [tableStep, draftCurve.maxLevel, draft.targets]);

  const maxLevelDays = daysAt(draftDays, draftCurve.maxLevel);
  const savedMaxLevelDays = daysAt(savedDays, savedCurve.maxLevel);
  const focusLabel =
    curveKey === "CHARACTER"
      ? strategy === "split"
        ? "all activities, time split evenly"
        : "the fastest character XP"
      : `training only ${SKILL_LABELS[skill]}`;
  const profile = PLAYER_PROFILES.find((entry) => entry.id === profileId)!;

  const simulatorHref = (() => {
    const params = new URLSearchParams();
    for (const key of CURVES) {
      if (!sameDesign(drafts[key], props.curves[key].design) && curveProblems(drafts[key]).length === 0) {
        params.set(key.toLowerCase(), JSON.stringify(drafts[key]));
      }
    }
    const query = params.toString();
    return `/admin/simulations${query ? `?${query}` : ""}`;
  })();

  const save = async () => {
    const moved = impact.up + impact.down;
    const message =
      `Save the ${CURVE_LABELS[curveKey].toLowerCase()} curve?\n\n` +
      (moved > 0
        ? `${moved} of ${impact.total} ${curveKey === "CHARACTER" ? "characters" : "skill records"} change level (${impact.up} up, ${impact.down} down).`
        : "No player changes level.") +
      "\nLevels are recalculated from lifetime XP; nobody's XP changes, so saving the old design restores them.";
    if (!window.confirm(message)) return;
    setSaving(true);
    try {
      await adminRequest("/api/admin/leveling", "PATCH", { curve: curveKey, design: draft });
      toast.success(`${CURVE_LABELS[curveKey]} curve saved`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  const [scaleLevel, setScaleLevel] = useState(() => presetAnchorLevel(draft));
  const [scaleTotal, setScaleTotal] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leveling</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Design how much XP each level costs, and see what it means in play time with
            today&apos;s content.
          </p>
          <p className="mt-2 max-w-3xl text-xs text-white/50">
            Players keep their lifetime XP; saving a curve recalculates every level from it.
            All skills share the skill curve.
          </p>
        </div>
        <Link
          href={simulatorHref}
          className="inline-flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          <FlaskConical className="h-4 w-4" />
          {simulatorHref.includes("?") ? "Try drafts in the simulator" : "Open the simulator"}
        </Link>
      </header>

      <Segmented
        label="Curve"
        value={curveKey}
        options={CURVES.map((key) => ({
          value: key,
          label: `${CURVE_LABELS[key]}${!sameDesign(drafts[key], props.curves[key].design) ? " •" : ""}`,
        }))}
        onChange={(key) =>
          router.replace(key === "SKILL" ? `${pathname}?curve=skill` : pathname, { scroll: false })
        }
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Panel title="Shape" description="The formula every level's cost comes from.">
            <div className="flex flex-wrap gap-1.5">
              {CURVE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={`${preset.description} Keeps the XP for level ${presetAnchorLevel(draft)}.`}
                  onClick={() => setDraft(applyPreset(draft, preset))}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    draft.power === preset.power && draft.growthPercent === preset.growthPercent
                      ? "bg-amber-400/15 text-amber-100"
                      : "bg-white/[0.05] text-white/60 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <SliderField
                label="Max level"
                value={draft.maxLevel}
                min={10}
                max={3_000}
                step={1}
                onChange={(value) => patch({ maxLevel: Math.round(value) })}
              />
              <SliderField
                label="XP for level 2"
                value={draft.firstLevelXp}
                min={0.1}
                max={100_000}
                step={0.1}
                logarithmic
                onChange={(value) => patch({ firstLevelXp: value })}
                hint="Scales every level by the same factor."
              />
              <SliderField
                label="Power"
                value={draft.power}
                min={0}
                max={4}
                step={0.05}
                onChange={(value) => patch({ power: value })}
                hint="Polynomial growth: 1 adds the same XP each level, 2 is quadratic."
                invalid={overflowAt !== null && draft.growthPercent === 0}
              />
              <SliderField
                label="Growth per level"
                value={draft.growthPercent}
                min={0}
                max={15}
                step={0.05}
                suffix="%"
                onChange={(value) => patch({ growthPercent: value })}
                hint="Compounds on top: 10% doubles the cost about every 7 levels."
                invalid={overflowAt !== null && draft.growthPercent > 0}
              />
            </div>
            <div className="space-y-2 rounded-lg bg-white/[0.03] p-3">
              <div className="text-xs font-medium text-white/70">Scale to a total</div>
              <div className="flex items-end gap-2 text-xs text-white/55">
                <label className="w-20 space-y-1">
                  <span>Level</span>
                  <NumberInput
                    className={cn(inputClass, "py-1.5")}
                    value={scaleLevel}
                    min={2}
                    onValueChange={(value) => value !== null && setScaleLevel(Math.max(2, Math.round(value)))}
                  />
                </label>
                <label className="flex-1 space-y-1">
                  <span>Needs total XP</span>
                  <NumberInput
                    className={cn(inputClass, "py-1.5")}
                    value={scaleTotal ?? totalXpForLevel(draftCurve, scaleLevel)}
                    min={1}
                    onValueChange={setScaleTotal}
                  />
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!scaleTotal}
                  onClick={() => {
                    if (!scaleTotal) return;
                    setDraft(scaleDesignToTotal(draft, scaleLevel, scaleTotal));
                    setScaleTotal(null);
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </Panel>

          <Panel
            title="Difficulty bands"
            description="Multiply the XP needed to reach a range of levels: a wall before new content, a soft cap, or easier early levels."
            action={
              <Button
                variant="ghost"
                size="sm"
                disabled={draft.bands.length >= 20}
                onClick={() =>
                  patch({
                    bands: [
                      ...draft.bands,
                      {
                        fromLevel: Math.max(2, draft.maxLevel - 10),
                        toLevel: draft.maxLevel,
                        multiplier: 2,
                      },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            }
          >
            {draft.bands.length === 0 ? (
              <p className="text-xs text-white/40">No bands: every level follows the formula.</p>
            ) : (
              <div className="space-y-2">
                {draft.bands.map((band, index) => {
                  const update = (changes: Partial<typeof band>) =>
                    patch({ bands: draft.bands.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)) });
                  return (
                    <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 text-xs text-white/55">
                      <label className="space-y-1">
                        <span>From level</span>
                        <NumberInput className={cn(inputClass, "py-1.5")} value={band.fromLevel} onValueChange={(value) => value !== null && update({ fromLevel: Math.round(value) })} />
                      </label>
                      <label className="space-y-1">
                        <span>To level</span>
                        <NumberInput className={cn(inputClass, "py-1.5")} value={band.toLevel} onValueChange={(value) => value !== null && update({ toLevel: Math.round(value) })} />
                      </label>
                      <label className="space-y-1">
                        <span>XP ×</span>
                        <NumberInput className={cn(inputClass, "py-1.5")} value={band.multiplier} step="any" onValueChange={(value) => value !== null && update({ multiplier: value })} />
                      </label>
                      <button
                        type="button"
                        aria-label={`Remove band ${index + 1}`}
                        onClick={() => patch({ bands: draft.bands.filter((_, i) => i !== index) })}
                        className="mb-1 rounded p-1.5 text-white/40 hover:bg-white/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            title="Pacing targets"
            description={`Where you want a ${profile.label.toLowerCase()} player to be, ${focusLabel}. Shown as dots on the time chart.`}
            action={
              <Button
                variant="ghost"
                size="sm"
                disabled={draft.targets.length >= 30}
                onClick={() => {
                  // Each new target doubles the last one, a common pacing rhythm.
                  const last = draft.targets.at(-1);
                  const next = last
                    ? { level: Math.min(draft.maxLevel, last.level * 2), days: last.days * 2 }
                    : { level: Math.min(50, draft.maxLevel), days: 30 };
                  patch({ targets: [...draft.targets, next] });
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add
              </Button>
            }
          >
            {draft.targets.length === 0 ? (
              <p className="text-xs text-white/40">
                Add a few, e.g. level 10 in 1 day, level 50 in 30 days, the max level in a year.
              </p>
            ) : (
              <div className="space-y-2">
                {draft.targets.map((target, index) => {
                  const update = (changes: Partial<typeof target>) =>
                    patch({ targets: draft.targets.map((entry, i) => (i === index ? { ...entry, ...changes } : entry)) });
                  const actual = daysAt(draftDays, target.level);
                  const ratio = actual !== null && target.days > 0 ? actual / target.days : null;
                  return (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2 text-xs text-white/55">
                      <label className="space-y-1">
                        <span>Level</span>
                        <NumberInput className={cn(inputClass, "py-1.5")} value={target.level} onValueChange={(value) => value !== null && update({ level: Math.round(value) })} />
                      </label>
                      <label className="space-y-1">
                        <span>In days</span>
                        <NumberInput className={cn(inputClass, "py-1.5")} value={target.days} step="any" onValueChange={(value) => value !== null && update({ days: value })} />
                      </label>
                      <span className="mb-1.5 w-24 text-right" title={actual === null ? "Not reached within 10 years" : `Draft: ${formatDays(actual)}`}>
                        {ratio === null ? (
                          <Tag tone="bad">Not reached</Tag>
                        ) : Math.abs(ratio - 1) <= 0.15 ? (
                          <Tag tone="good">On target</Tag>
                        ) : ratio > 1 ? (
                          <Tag tone="warn">{`${ratio.toFixed(1)}× slower`}</Tag>
                        ) : (
                          <Tag tone="info">{`${(1 / ratio).toFixed(1)}× faster`}</Tag>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove target ${index + 1}`}
                        onClick={() => patch({ targets: draft.targets.filter((_, i) => i !== index) })}
                        className="mb-1 rounded p-1.5 text-white/40 hover:bg-white/10 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </aside>

        <main className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {milestones.map((level) => {
              const days = daysAt(draftDays, level);
              const before = daysAt(savedDays, level);
              return (
                <StatTile
                  key={level}
                  label={`Level ${level}`}
                  value={days === null ? "Over 10 years" : formatDays(days)}
                  hint={
                    before === null
                      ? "Saved: over 10 years"
                      : `Saved ${formatDays(before)}${days !== null && formatChange(before, days) !== "—" ? ` · ${formatChange(before, days)}` : ""}`
                  }
                />
              );
            })}
            <StatTile
              label={`Max level ${draftCurve.maxLevel}`}
              value={maxLevelDays === null ? "Over 10 years" : formatDays(maxLevelDays)}
              hint={
                maxLevelDays === null
                  ? `Level ${lastReached} after 10 years · ${formatXp(totalXpForLevel(draftCurve, draftCurve.maxLevel))} XP`
                  : `Saved ${savedMaxLevelDays === null ? "over 10 years" : formatDays(savedMaxLevelDays)} · ${formatXp(totalXpForLevel(draftCurve, draftCurve.maxLevel))} XP`
              }
            />
            <StatTile
              label={curveKey === "CHARACTER" ? "Characters that change level" : "Skill records that change level"}
              value={impact.up + impact.down === 0 ? "None" : `${impact.up} ↑  ${impact.down} ↓`}
              hint={`Of ${impact.total}, if you save this draft`}
            />
          </div>

          <section className="space-y-4 rounded-xl bg-gray-950/45 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="Chart"
                value={view}
                onChange={setView}
                options={[
                  { value: "time", label: "Time to reach" },
                  { value: "step", label: "XP per level" },
                  { value: "total", label: "Total XP" },
                ]}
              />
              <label className="flex items-center gap-2 text-xs text-white/60">
                <input type="checkbox" className="accent-amber-400" checked={logY} onChange={(event) => setLogY(event.target.checked)} />
                Log scale
              </label>
            </div>
            {view === "time" ? (
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  label="Player profile"
                  value={profileId}
                  onChange={setProfileId}
                  options={PLAYER_PROFILES.map((entry) => ({ value: entry.id, label: entry.label, title: entry.description }))}
                />
                {curveKey === "CHARACTER" ? (
                  <Segmented
                    label="How they play"
                    value={strategy}
                    onChange={setStrategy}
                    options={[
                      { value: "split", label: "Everything evenly" },
                      { value: "fastest", label: "Fastest character XP" },
                    ]}
                  />
                ) : (
                  <select
                    aria-label="Skill"
                    className={cn(inputClass, "w-auto py-1.5")}
                    value={skill}
                    onChange={(event) => setSkill(event.target.value as Skill)}
                  >
                    {skills.map((entry) => (
                      <option key={entry} value={entry}>
                        {SKILL_LABELS[entry]}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : null}
            {overflowAt !== null ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-400/10 px-3 py-2.5 text-sm text-red-100">
                <span className="mr-auto">
                  Total XP passes the game&apos;s limit after level {overflowAt}, so the draft stops there and
                  can&apos;t be saved. Pick a fix:
                </span>
                <Button size="sm" variant="secondary" onClick={() => patch({ maxLevel: overflowAt })}>
                  Max level {overflowAt}
                </Button>
                {fixes?.growth != null ? (
                  <Button size="sm" variant="secondary" onClick={() => patch({ growthPercent: fixes.growth! })}>
                    Growth {fixes.growth}%
                  </Button>
                ) : null}
                {fixes?.power != null ? (
                  <Button size="sm" variant="secondary" onClick={() => patch({ power: fixes.power! })}>
                    Power {fixes.power}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <LineChart
              label={`${CURVE_LABELS[curveKey]}: ${view === "time" ? "time to reach each level" : view === "step" ? "XP needed for each level" : "total XP for each level"}`}
              series={series}
              markers={markers}
              logY={logY}
              xLabel="Level"
              yLabel={view === "time" ? "Time to reach" : view === "step" ? "XP for the level" : "Total XP"}
              formatY={view === "time" ? formatTimeAxis : formatXp}
              logTicks={view === "time" ? TIME_TICKS_DAYS : undefined}
              xMax={draft.maxLevel}
              rules={[{ x: draftCurve.maxLevel, label: `Max level ${draftCurve.maxLevel}` }]}
            />
            {differs ? (
              <div className="space-y-1 rounded-lg bg-white/[0.02] pt-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 text-xs">
                  <span className="font-medium text-white/70">
                    Draft vs saved: {view === "time" ? "time to reach" : view === "step" ? "XP per level" : "total XP"}
                  </span>
                  <span className="text-white/55">
                    {change.points.length > 0 ? changeSummary : "No levels to compare"}
                    {draftCurve.maxLevel !== savedCurve.maxLevel
                      ? ` · max level ${savedCurve.maxLevel} → ${draftCurve.maxLevel}`
                      : ""}
                  </span>
                </div>
                <LineChart
                  label="Draft compared with the saved curve, in percent"
                  series={[{ id: "change", label: "Change", color: SERIES_COLORS[0], points: change.points }]}
                  height={150}
                  xLabel="Level"
                  yLabel="vs saved"
                  formatY={formatPercentChange}
                  xMax={draft.maxLevel}
                  rules={[{ x: draftCurve.maxLevel, label: "" }]}
                />
              </div>
            ) : (
              <p className="text-xs text-white/40">The draft matches the saved curve. Move a slider to compare.</p>
            )}
            {view === "time" ? (
              <p className="text-xs text-white/40">
                A {profile.label.toLowerCase()} player ({profile.description}) doing {focusLabel}, always
                using the best activity open at their levels. After 10 years they are level {lastReached}
                {lastReached < draftCurve.maxLevel ? "; later levels are left off" : ""}.
              </p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Levels</h2>
              <Segmented
                label="Rows"
                value={String(tableStep)}
                onChange={(value) => setTableStep(Number(value) as (typeof TABLE_STEPS)[number])}
                options={TABLE_STEPS.map((step) => ({ value: String(step), label: step === 1 ? "Every level" : `Every ${step}` }))}
              />
            </div>
            <div className="max-h-[520px] overflow-auto rounded-lg bg-white/[0.02]">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-gray-950 text-left text-xs text-white/45">
                  <tr>
                    <th className="px-3 py-2 font-medium">Level</th>
                    <th className="px-3 py-2 text-right font-medium">XP for level</th>
                    <th className="px-3 py-2 text-right font-medium">Total XP</th>
                    <th className="px-3 py-2 text-right font-medium">vs saved</th>
                    <th className="px-3 py-2 text-right font-medium">Reached</th>
                    <th className="px-3 py-2 text-right font-medium">Saved curve</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {tableLevels.map((level) => {
                    const total = totalXpForLevel(draftCurve, level);
                    const savedTotal = level <= savedCurve.maxLevel ? totalXpForLevel(savedCurve, level) : null;
                    const target = draft.targets.find((entry) => entry.level === level);
                    const band = bandMultiplier(draft, level);
                    return (
                      <tr key={level} className={cn("border-t border-white/5", target && "bg-white/[0.04]")}>
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-2">
                            {level}
                            {band !== 1 ? <Tag tone="warn">{`×${band}`}</Tag> : null}
                            {target ? <Tag tone="info">{`Target ${formatDays(target.days)}`}</Tag> : null}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right">{formatXp(total - totalXpForLevel(draftCurve, level - 1))}</td>
                        <td className="px-3 py-1.5 text-right">{formatXp(total)}</td>
                        <td className="px-3 py-1.5 text-right text-white/55">
                          {savedTotal === null ? "new" : formatChange(savedTotal, total)}
                        </td>
                        <td className="px-3 py-1.5 text-right">{formatDays(daysAt(draftDays, level))}</td>
                        <td className="px-3 py-1.5 text-right text-white/55">{formatDays(daysAt(savedDays, level))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {dirty || problems.length > 0 ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-900/95 px-4 py-3 shadow-2xl ring-1 ring-white/10">
          <div className="min-w-0 text-sm">
            {problems.length > 0 ? (
              <span className="text-red-300">{problems[0]}</span>
            ) : !saved.designSaved && sameDesign(draft, saved.design) ? (
              <span className="text-white/70">
                No design is stored yet.{" "}
                {unsavedTableDiff.levels === 0
                  ? "This default matches the live table exactly; saving stores it."
                  : Number.isFinite(unsavedTableDiff.largest)
                    ? `This default rounds differently from the live table (at most ${(unsavedTableDiff.largest * 100).toFixed(1)}% at any level); saving replaces the table.`
                    : `This default doesn't cover every level of the live table; saving replaces the table.`}
              </span>
            ) : (
              <span className="text-white/70">
                Unsaved {CURVE_LABELS[curveKey].toLowerCase()} changes.{" "}
                {impact.up + impact.down > 0
                  ? `Saving moves ${impact.up + impact.down} of ${impact.total} (${impact.up} up, ${impact.down} down).`
                  : "No player changes level."}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setDraft(saved.designSaved ? saved.design : DEFAULT_CURVE_DESIGNS[curveKey])}
              disabled={saving || sameDesign(draft, saved.design)}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Discard
            </Button>
            <Button onClick={() => void save()} disabled={saving || problems.length > 0}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save curve"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
