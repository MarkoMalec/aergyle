"use client";

import React, { useMemo, useState } from "react";
import { Tag } from "~/components/admin/players/shared";
import type { CurveTable } from "~/game/balance/curve";
import {
  groupLabel,
  trackLabel,
  type ActivityGroup,
  type BalanceContent,
  type Track,
} from "~/game/balance/content";
import { dayReached, trainedTracks, type JourneyResult } from "~/game/balance/journey";
import { ANY_LEVEL, groupSources, type SourceOptions } from "~/game/balance/sources";
import { formatDays, formatHours, formatPercent, formatXp } from "./format";
import { LineChart, SERIES_COLORS } from "./LineChart";
import { StatTile } from "./ui";

const MILESTONES = [10, 25, 50, 100, 150, 200, 300, 500, 1_000];

/** The lowest levels at which a group has anything to do, for "blocked" notes. */
function firstUnlock(content: BalanceContent, group: ActivityGroup, options: SourceOptions) {
  const sources = groupSources(content, group, ANY_LEVEL, options);
  let best: { name: string; gates: string } | null = null;
  let bestLevel = Infinity;
  for (const source of sources) {
    const level = Math.max(...source.gates.map((gate) => gate.level));
    if (level < bestLevel) {
      bestLevel = level;
      best = {
        name: source.name,
        gates: source.gates
          .filter((gate) => gate.level > 1)
          .map((gate) => `${trackLabel(gate.track)} ${gate.level}`)
          .join(", "),
      };
    }
  }
  return best;
}

function levelSeries(result: JourneyResult, track: Track) {
  return result.levelAtDay[track].map((level, day) => [day, level] as const);
}

export function JourneyTab(props: {
  content: BalanceContent;
  result: JourneyResult;
  options: SourceOptions;
  curves: { character: CurveTable; skill: CurveTable };
}) {
  const { result } = props;
  const [showAll, setShowAll] = useState(false);
  const tracks = useMemo(() => trainedTracks(result), [result]);
  const skills = tracks.filter((track) => track !== "CHARACTER");

  const xpSources = Object.entries(result.characterXpBySource)
    .filter(([, xp]) => xp > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalCharacterXp = xpSources.reduce((sum, [, xp]) => sum + xp, 0);
  const budget = result.hoursPerDay * result.days;
  const segments = [...result.segments].sort((a, b) => a.startDay - b.startDay);
  const shownSegments = showAll ? segments : segments.slice(0, 12);
  const maxLevelOf = (track: Track) =>
    track === "CHARACTER" ? props.curves.character.maxLevel : props.curves.skill.maxLevel;
  const milestones = MILESTONES.filter((level) =>
    tracks.some((track) => level <= maxLevelOf(track)),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={`Character level after ${formatDays(result.days)}`}
          value={result.levelAtDay.CHARACTER.at(-1)}
          hint={`Level 50 on ${formatDays(dayReached(result, "CHARACTER", 50))}`}
        />
        <StatTile
          label="Activity time"
          value={formatHours(result.playedHours)}
          hint={`${formatHours(result.hoursPerDay)} a day available`}
        />
        <StatTile
          label="Unused time"
          value={budget > 0 ? formatPercent(result.idleHours / budget) : "—"}
          hint={result.idleHours > 0.01 ? "Too few check-ins or nothing to do" : "Every available hour was used"}
        />
        <StatTile
          label="Most character XP from"
          value={xpSources[0] ? groupLabel(xpSources[0][0] as ActivityGroup) : "—"}
          hint={xpSources[0] ? formatPercent(xpSources[0][1] / totalCharacterXp) : "No XP earned"}
        />
      </div>

      {result.blocked.length > 0 ? (
        <div className="space-y-1.5 rounded-xl bg-amber-400/[0.06] p-4 text-sm">
          {result.blocked.map(({ group, day }) => {
            const unlock = firstUnlock(props.content, group, props.options);
            return (
              <div key={group} className="flex flex-wrap items-center gap-2 text-white/75">
                <Tag tone="warn">Nothing to do</Tag>
                <span>
                  {groupLabel(group)} had no activity open from {day === 0 ? "the start" : `day ${day}`}
                  {unlock
                    ? unlock.gates
                      ? `; its first one, ${unlock.name}, needs ${unlock.gates}.`
                      : `; ${unlock.name} should be open, so check its requirements.`
                    : "; it has no XP source at all."}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
        <h2 className="font-semibold">Character level</h2>
        <LineChart
          label="Character level by day"
          series={[{ id: "CHARACTER", label: "Character", color: SERIES_COLORS[0], points: levelSeries(result, "CHARACTER") }]}
          xLabel="Day"
          yLabel="Level"
          formatX={(day) => String(Math.round(day))}
          formatY={(level) => String(Math.round(level))}
          height={260}
        />
      </section>

      {skills.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Skills</h2>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {skills.map((track) => (
              <div key={track} className="rounded-xl bg-gray-950/45 p-4">
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium">{trackLabel(track)}</span>
                  <span className="tabular-nums text-white/55">
                    1 → {result.levelAtDay[track].at(-1)}
                  </span>
                </div>
                <LineChart
                  compact
                  label={`${trackLabel(track)} level by day`}
                  series={[{ id: track, label: trackLabel(track), color: SERIES_COLORS[0], points: levelSeries(result, track) }]}
                  xLabel="Day"
                  yLabel="Level"
                  formatX={(day) => String(Math.round(day))}
                  formatY={(level) => String(Math.round(level))}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
        <h2 className="font-semibold">When each level is reached</h2>
        <div className="overflow-x-auto rounded-lg bg-white/[0.02]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-white/45">
              <tr>
                <th className="px-3 py-2 font-medium">Track</th>
                {milestones.map((level) => (
                  <th key={level} className="px-3 py-2 text-right font-medium">
                    Level {level}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Final</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {tracks.map((track) => (
                <tr key={track} className="border-t border-white/5">
                  <td className="px-3 py-1.5 font-medium">{trackLabel(track)}</td>
                  {milestones.map((level) => (
                    <td key={level} className="px-3 py-1.5 text-right text-white/75">
                      {level > maxLevelOf(track) ? "" : formatDays(dayReached(result, track, level))}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right">{result.levelAtDay[track].at(-1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/40">Time since the character was created. Empty cells are beyond the curve&apos;s max level; dashes were not reached.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
          <h2 className="font-semibold">Where character XP came from</h2>
          <div className="space-y-2">
            {xpSources.map(([source, xp]) => (
              <div key={source} className="grid grid-cols-[120px_minmax(0,1fr)_110px] items-center gap-3 text-sm">
                <span className="truncate text-white/70">{groupLabel(source as ActivityGroup)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${(xp / totalCharacterXp) * 100}%`, background: SERIES_COLORS[0] }}
                  />
                </span>
                <span className="text-right tabular-nums text-white/60">
                  {formatPercent(xp / totalCharacterXp)} · {formatXp(xp)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40">
            Hours spent:{" "}
            {Object.entries(result.hoursByGroup)
              .sort((a, b) => b[1] - a[1])
              .map(([group, hours]) => `${groupLabel(group as ActivityGroup)} ${formatHours(hours)}`)
              .join(" · ")}
          </p>
        </section>

        <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
          <h2 className="font-semibold">What the player did</h2>
          <ol className="space-y-1 text-sm">
            {shownSegments.map((segment, index) => (
              <li key={index} className="grid grid-cols-[150px_minmax(0,1fr)_70px] gap-3 rounded-md px-2 py-1 odd:bg-white/[0.02]">
                <span className="tabular-nums text-white/50">
                  {formatDays(segment.startDay)} – {formatDays(segment.endDay)}
                </span>
                <span className="truncate">
                  <span className="text-white/50">{groupLabel(segment.group)}:</span> {segment.name}
                </span>
                <span className="text-right tabular-nums text-white/55">{formatHours(segment.hours)}</span>
              </li>
            ))}
          </ol>
          {segments.length > 12 ? (
            <button type="button" className="text-xs text-white/50 hover:text-white" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${segments.length}`}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
