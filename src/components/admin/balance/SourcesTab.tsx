"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { Wand2 } from "lucide-react";
import { inputClass, NumberInput } from "~/components/admin/fields";
import { Tag } from "~/components/admin/players/shared";
import { Button } from "~/components/ui/button";
import type { CurveTable } from "~/game/balance/curve";
import {
  groupLabel,
  trackLabel,
  type ActivityGroup,
  type BalanceContent,
  type Track,
  type XpGroup,
} from "~/game/balance/content";
import {
  ANY_LEVEL,
  gardenPlan,
  groupSources,
  mainTrack,
  xpPerHour,
  xpScaleOf,
  type Source,
  type SourceOptions,
} from "~/game/balance/sources";
import { cn } from "~/lib/utils";
import { formatDecimal, formatHours, formatSeconds, formatXp } from "./format";
import { Chip } from "./ui";

type Row = {
  source: Source;
  unlock: number;
  rate: number;
  characterRate: number;
  hoursPerLevel: number | null;
  flags: Array<{ tone: "warn" | "info" | "bad" | "neutral"; text: string; title?: string }>;
};

/** Gates as "Woodcutting 40 · Character 40", highest per track. */
function gateText(source: Source) {
  const byTrack = new Map<Track, number>();
  for (const gate of source.gates) {
    if (gate.level > (byTrack.get(gate.track) ?? 1)) byTrack.set(gate.track, gate.level);
  }
  const parts = [...byTrack].map(([track, level]) => `${trackLabel(track)} ${level}`);
  return parts.length > 0 ? parts.join(" · ") : "Start";
}

function buildRows(
  content: BalanceContent,
  group: ActivityGroup,
  options: SourceOptions,
  curves: { character: CurveTable; skill: CurveTable },
  itemNames: Map<number, string>,
): Row[] {
  const track = mainTrack(group);
  const curve = track === "CHARACTER" ? curves.character : curves.skill;
  const recipes = new Set(content.resources.filter((resource) => resource.recipeLocked).map((resource) => `resource:${resource.id}`));
  const sources = groupSources(content, group, ANY_LEVEL, { ...options, recipes: true });
  const rows = sources.map((source): Row => {
    const unlock = Math.max(1, ...source.gates.filter((gate) => gate.track === track).map((gate) => gate.level));
    const rate = xpPerHour(source, track);
    const step = unlock < curve.maxLevel ? curve.totals[unlock + 1]! - curve.totals[unlock]! : null;
    const flags: Row["flags"] = [];
    if (recipes.has(source.key)) flags.push({ tone: "neutral", text: "Recipe" });
    if (source.bought.length > 0) {
      const names = [...new Set(source.bought.map((id) => itemNames.get(id) ?? `#${id}`))];
      flags.push({ tone: "neutral", text: `Buys ${names.length}`, title: names.join(", ") });
    }
    if (unlock > curve.maxLevel) flags.push({ tone: "bad", text: "Above max level" });
    if (rate === 0) flags.push({ tone: "bad", text: "No XP" });
    return { source, unlock, rate, characterRate: xpPerHour(source, "CHARACTER"), hoursPerLevel: step && rate > 0 ? step / rate : null, flags };
  });
  rows.sort((a, b) => a.unlock - b.unlock || b.rate - a.rate);

  // Never the best choice: something open no later pays more.
  for (const row of rows) {
    const better = rows.find(
      (other) =>
        other !== row &&
        other.rate > row.rate * 1.0001 &&
        other.source.gates.every((gate) =>
          row.source.gates.some((mine) => mine.track === gate.track && mine.level >= gate.level) || gate.level <= 1,
        ),
    );
    if (better) {
      row.flags.push({
        tone: "warn",
        text: "Never best",
        title: `${better.source.name} pays more XP per hour and opens no later.`,
      });
    }
  }
  // A big jump over everything opened before it makes the old tier pointless.
  let bestSoFar = 0;
  for (const row of rows) {
    if (bestSoFar > 0 && row.rate > bestSoFar * 2) {
      row.flags.push({ tone: "info", text: `×${formatDecimal(row.rate / bestSoFar)} jump`, title: "More than twice the best XP per hour opened before it." });
    }
    bestSoFar = Math.max(bestSoFar, row.rate);
  }
  return rows;
}

export function SourcesTab(props: {
  content: BalanceContent;
  options: SourceOptions;
  curves: { character: CurveTable; skill: CurveTable };
  groups: ActivityGroup[];
  checkInsPerDay: number;
  onWhatIf: (group: XpGroup, factor: number) => void;
  onApply: (group: XpGroup, factor: number) => Promise<void>;
}) {
  const { content, options } = props;
  const [shown, setShown] = useState<Set<XpGroup>>(() => new Set());
  const [applying, setApplying] = useState<XpGroup | null>(null);
  const itemNames = useMemo(() => new Map(content.items.map((item) => [item.id, item.name])), [content.items]);
  const unplaced = content.resources.filter((resource) => resource.requiredCharacterLevel === null && resource.xpPerUnit > 0);
  const garden = gardenPlan(content, options, props.checkInsPerDay);
  const visible = (group: XpGroup) => shown.size === 0 || shown.has(group);

  const scaleControl = (group: XpGroup) => {
    const factor = options.xpScale[group] ?? 1;
    return (
      <div className="flex items-center gap-2 text-xs text-white/55">
        <label className="flex items-center gap-1.5">
          What-if XP ×
          <NumberInput
            className={cn(inputClass, "w-20 py-1 text-right", factor !== 1 && "border-sky-400/50")}
            value={factor}
            step={0.05}
            min={0.05}
            onValueChange={(value) => value !== null && value > 0 && props.onWhatIf(group, value)}
          />
        </label>
        {factor !== 1 ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={applying !== null}
            onClick={async () => {
              setApplying(group);
              try {
                await props.onApply(group, factor);
              } finally {
                setApplying(null);
              }
            }}
          >
            <Wand2 className="h-3.5 w-3.5" />
            {applying === group ? "Applying…" : `Apply ×${factor} to the game`}
          </Button>
        ) : null}
      </div>
    );
  };

  const groupHeader = (group: XpGroup, note: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold">{groupLabel(group)}</h3>
        <p className="text-xs text-white/45">{note}</p>
      </div>
      {scaleControl(group)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {[...props.groups, ...(garden ? (["GARDENING"] as const) : []), ...(content.quests.length > 0 ? (["QUESTS"] as const) : [])]
          .filter((group, index, all) => all.indexOf(group) === index)
          .map((group) => (
            <Chip
              key={group}
              on={shown.has(group)}
              onChange={(on) => {
                const next = new Set(shown);
                if (on) next.add(group);
                else next.delete(group);
                setShown(next);
              }}
            >
              {groupLabel(group)}
            </Chip>
          ))}
        {shown.size > 0 ? (
          <button type="button" className="text-xs text-white/45 hover:text-white" onClick={() => setShown(new Set())}>
            Show all
          </button>
        ) : null}
      </div>

      <p className="max-w-4xl text-xs text-white/45">
        Rates use the scenario&apos;s tool efficiency, materials rule and XP what-ifs. &quot;Hours per level&quot; is
        how long one level takes right when the source opens. What-ifs only change the simulations until you
        apply them; applying rewrites every stored XP reward of that group (rounded, never below 1).
      </p>

      {unplaced.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-400/[0.06] p-4 text-sm text-white/75">
          <Tag tone="warn">Not offered anywhere</Tag>
          {unplaced.map((resource) => (
            <Link key={resource.id} href={`/admin/vocations/${resource.id}`} className="underline decoration-white/20 underline-offset-2 hover:text-white">
              {resource.name}
            </Link>
          ))}
          <span className="text-white/45">No location enables these, so players can never start them.</span>
        </div>
      ) : null}

      {props.groups.filter(visible).map((group) => {
        const rows = buildRows(content, group, options, props.curves, itemNames);
        const track = mainTrack(group);
        return (
          <section key={group} className="space-y-3 rounded-xl bg-gray-950/45 p-5">
            {groupHeader(
              group,
              group === "DUNGEONS"
                ? "Character XP only, and only when the run is cleared."
                : `Every XP point goes to ${trackLabel(track)} and to the character.`,
            )}
            <div className="overflow-x-auto rounded-lg bg-white/[0.02]">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="text-left text-xs text-white/45">
                  <tr>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Opens at</th>
                    <th className="px-3 py-2 text-right font-medium">Time</th>
                    <th className="px-3 py-2 text-right font-medium">XP</th>
                    <th className="px-3 py-2 text-right font-medium">{trackLabel(track)} XP/h</th>
                    {track !== "CHARACTER" ? <th className="px-3 py-2 text-right font-medium">Character XP/h</th> : null}
                    <th className="px-3 py-2 text-right font-medium">Hours per level</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map((row) => (
                    <tr key={row.source.key} className="border-t border-white/5">
                      <td className="px-3 py-1.5">
                        <Link href={row.source.editHref} className="hover:text-amber-200">
                          {row.source.name}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-white/65">{gateText(row.source)}</td>
                      <td className="px-3 py-1.5 text-right text-white/65">{formatSeconds(row.source.seconds)}</td>
                      <td className="px-3 py-1.5 text-right text-white/65">{formatDecimal(row.source.xp[track] ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatXp(row.rate)}</td>
                      {track !== "CHARACTER" ? (
                        <td className="px-3 py-1.5 text-right text-white/65">{formatXp(row.characterRate)}</td>
                      ) : null}
                      <td className="px-3 py-1.5 text-right">{row.hoursPerLevel === null ? "—" : formatHours(row.hoursPerLevel)}</td>
                      <td className="px-3 py-1.5">
                        <span className="flex flex-wrap gap-1">
                          {row.flags.map((flag) => (
                            <span key={flag.text} title={flag.title}>
                              <Tag tone={flag.tone}>{flag.text}</Tag>
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {garden && visible("GARDENING") ? (
        <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
          {groupHeader(
            "GARDENING",
            `Grows alongside other activities: ${content.gardenTiles} tiles, replanted at most ${formatDecimal(props.checkInsPerDay)} times a day (the scenario's check-ins).`,
          )}
          <div className="overflow-x-auto rounded-lg bg-white/[0.02]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-white/45">
                <tr>
                  <th className="px-3 py-2 font-medium">Seed</th>
                  <th className="px-3 py-2 text-right font-medium">Grows</th>
                  <th className="px-3 py-2 text-right font-medium">XP per tile</th>
                  <th className="px-3 py-2 text-right font-medium">Replants a day</th>
                  <th className="px-3 py-2 text-right font-medium">XP a day</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {content.seeds.map((seed) => {
                  const cycles = Math.min(props.checkInsPerDay, 86_400 / seed.growSeconds);
                  const xp = content.gardenTiles * seed.xp * xpScaleOf(options, "GARDENING") * cycles;
                  return (
                    <tr key={seed.itemId} className="border-t border-white/5">
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          {seed.name}
                          {seed.name === garden.seedName ? <Tag tone="good">Best</Tag> : null}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-white/65">{formatSeconds(seed.growSeconds)}</td>
                      <td className="px-3 py-1.5 text-right text-white/65">{seed.xp}</td>
                      <td className="px-3 py-1.5 text-right text-white/65">{formatDecimal(cycles)}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatXp(xp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {content.quests.length > 0 && visible("QUESTS") ? (
        <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
          {groupHeader("QUESTS", "Character XP only. Objectives take no simulated time.")}
          <div className="overflow-x-auto rounded-lg bg-white/[0.02]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-white/45">
                <tr>
                  <th className="px-3 py-2 font-medium">Quest</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">Opens at</th>
                  <th className="px-3 py-2 font-medium">Repeats</th>
                  <th className="px-3 py-2 text-right font-medium">XP</th>
                  <th className="px-3 py-2 text-right font-medium">Levels at unlock</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {content.quests.map((quest) => {
                  const xp = quest.xp * xpScaleOf(options, "QUESTS");
                  const curve = props.curves.character;
                  const start = quest.requiredLevel < curve.maxLevel ? curve.totals[quest.requiredLevel]! : null;
                  let levels = 0;
                  if (start !== null) {
                    while (quest.requiredLevel + levels < curve.maxLevel && curve.totals[quest.requiredLevel + levels + 1]! <= start + xp) levels += 1;
                  }
                  return (
                    <tr key={quest.id} className="border-t border-white/5">
                      <td className="px-3 py-1.5">{quest.name}</td>
                      <td className="px-3 py-1.5 text-white/65">{quest.npcName}</td>
                      <td className="px-3 py-1.5 text-white/65">Character {quest.requiredLevel}</td>
                      <td className="px-3 py-1.5 text-white/65">{quest.repeat === "ONCE" ? "Once" : quest.repeat === "DAILY" ? "Daily" : "Weekly"}</td>
                      <td className="px-3 py-1.5 text-right font-medium">{formatXp(xp)}</td>
                      <td className="px-3 py-1.5 text-right">
                        {levels >= 3 ? <Tag tone="warn">{`${levels} levels`}</Tag> : levels}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
