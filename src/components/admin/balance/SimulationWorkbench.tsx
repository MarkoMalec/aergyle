"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useDeferredValue, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { adminRequest } from "~/components/admin/fields";
import type { LevelCurve } from "~/generated/prisma/enums";
import {
  buildCurve,
  CURVE_LABELS,
  curveFromTotals,
  curveProblems,
  parseCurveDesign,
  type CurveTable,
} from "~/game/balance/curve";
import { groupLabel, type BalanceContent, type XpGroup } from "~/game/balance/content";
import { simulateJourney } from "~/game/balance/journey";
import { groupsWithContent } from "~/game/balance/sources";
import { cn } from "~/lib/utils";
import type { SavedCurve } from "~/server/balance/leveling";
import { CombatTab } from "./CombatTab";
import { JourneyTab } from "./JourneyTab";
import { defaultScenario, ScenarioPanel, type Scenario } from "./ScenarioPanel";
import { SourcesTab } from "./SourcesTab";
import { UnlocksTab } from "./UnlocksTab";
import { Segmented } from "./ui";

const TABS = [
  { id: "journey", label: "Player journey" },
  { id: "sources", label: "XP sources" },
  { id: "unlocks", label: "Unlocks" },
  { id: "combat", label: "Dungeons & gear" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const PER_SYSTEM = [
  { href: "/admin/hunting", label: "Hunting loot & danger" },
  { href: "/admin/gathering", label: "Gathering finds" },
  { href: "/admin/dungeons", label: "One dungeon, any stats" },
  { href: "/admin/character-stats", label: "Stats by level" },
];

export function SimulationWorkbench(props: {
  content: BalanceContent;
  curves: Record<LevelCurve, SavedCurve>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: TabId = TABS.find((entry) => entry.id === searchParams.get("tab"))?.id ?? "journey";

  // Unsaved curves handed over from /admin/leveling, when valid.
  const drafts = useMemo(() => {
    const result: Partial<Record<LevelCurve, CurveTable>> = {};
    for (const key of ["CHARACTER", "SKILL"] as const) {
      const raw = searchParams.get(key.toLowerCase());
      if (!raw) continue;
      try {
        const design = parseCurveDesign(JSON.parse(raw), props.curves[key].design);
        if (curveProblems(design).length === 0) result[key] = buildCurve(design);
      } catch {
        // A broken link falls back to the saved curve.
      }
    }
    return result;
  }, [searchParams, props.curves]);
  const curves = useMemo(
    () => ({
      character: drafts.CHARACTER ?? curveFromTotals(props.curves.CHARACTER.totals),
      skill: drafts.SKILL ?? curveFromTotals(props.curves.SKILL.totals),
    }),
    [drafts, props.curves],
  );

  const groups = useMemo(() => groupsWithContent(props.content), [props.content]);
  const [scenario, setScenario] = useState<Scenario>(() =>
    defaultScenario(groups, props.content.seeds.length > 0),
  );
  const deferred = useDeferredValue(scenario);
  const result = useMemo(
    () =>
      simulateJourney({
        content: props.content,
        curves,
        profile: deferred.profile,
        plan: deferred.plan,
        options: deferred.options,
        days: deferred.days,
      }),
    [props.content, curves, deferred],
  );

  const goTo = (next: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "journey") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setWhatIf = (group: XpGroup, factor: number) =>
    setScenario((current) => ({
      ...current,
      options: { ...current.options, xpScale: { ...current.options.xpScale, [group]: factor } },
    }));

  const applyScale = async (group: XpGroup, factor: number) => {
    if (
      !window.confirm(
        `Multiply every stored ${groupLabel(group)} XP reward by ${factor}?\n\nPlayers see the new values at once. Rewards are rounded to whole XP and never drop below 1, so undoing it with the inverse factor may be off by one on small rewards.`,
      )
    ) {
      return;
    }
    try {
      const response = await adminRequest("/api/admin/leveling/xp-scale", "POST", { group, factor });
      toast.success(`${groupLabel(group)} XP ×${factor}: ${String(response?.changed ?? 0)} rewards updated`);
      setWhatIf(group, 1);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to apply");
    }
  };

  const draftKeys = (Object.keys(drafts) as LevelCurve[]).map((key) => CURVE_LABELS[key].toLowerCase());

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-3xl font-bold">Simulations</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Play a character forward with today&apos;s content and rules: how fast it levels, which activities
            pay, when content opens up, and whether it survives the dungeons at their level.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
          Per-system simulators:
          {PER_SYSTEM.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-white/70 hover:bg-white/10 hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>
      </header>

      {draftKeys.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sky-400/[0.08] px-4 py-3 text-sm text-sky-100">
          <span>Using the unsaved {draftKeys.join(" and ")} from Leveling. Nothing is saved from here.</span>
          <span className="flex gap-3">
            <Link href={`/admin/leveling${drafts.SKILL && !drafts.CHARACTER ? "?curve=skill" : ""}`} className="underline underline-offset-2">
              Back to Leveling
            </Link>
            <button type="button" className="underline underline-offset-2" onClick={() => router.replace(pathname)}>
              Use saved curves
            </button>
          </span>
        </div>
      ) : null}

      <ScenarioPanel
        scenario={scenario}
        onChange={setScenario}
        groups={groups}
        hasSeeds={props.content.seeds.length > 0}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Simulation" value={tab} onChange={goTo} options={TABS.map((entry) => ({ value: entry.id, label: entry.label }))} />
        <span className={cn("text-xs text-white/40 transition-opacity", deferred !== scenario ? "opacity-100" : "opacity-0")}>
          Updating…
        </span>
      </div>

      {tab === "journey" ? (
        <JourneyTab content={props.content} result={result} options={deferred.options} curves={curves} />
      ) : tab === "sources" ? (
        <SourcesTab
          content={props.content}
          options={scenario.options}
          curves={curves}
          groups={groups}
          checkInsPerDay={scenario.profile.checkInsPerDay}
          onWhatIf={setWhatIf}
          onApply={applyScale}
        />
      ) : tab === "unlocks" ? (
        <UnlocksTab content={props.content} result={result} curves={curves} />
      ) : (
        <CombatTab content={props.content} result={result} curves={curves} />
      )}
    </div>
  );
}
