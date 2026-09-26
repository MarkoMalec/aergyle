"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { inputClass, NumberInput } from "~/components/admin/fields";
import { Tag } from "~/components/admin/players/shared";
import type { CurveTable } from "~/game/balance/curve";
import { trackLabel, type BalanceContent, type Track } from "~/game/balance/content";
import { dayReached, type JourneyResult } from "~/game/balance/journey";
import { contentUnlocks, unlocksByLevel, type Unlock } from "~/game/balance/unlocks";
import { cn } from "~/lib/utils";
import { formatDays } from "./format";
import { StatTile } from "./ui";

const KIND_ORDER: Unlock["kind"][] = ["Location", "Area", "Dungeon", "Expedition", "Resource", "Quest", "Item"];

function UnlockList(props: { unlocks: Unlock[] }) {
  const byKind = KIND_ORDER.map((kind) => [kind, props.unlocks.filter((unlock) => unlock.kind === kind)] as const).filter(
    ([, list]) => list.length > 0,
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {byKind.map(([kind, list]) =>
        list.length > 6 ? (
          <details key={kind} className="text-sm">
            <summary className="cursor-pointer text-white/70 hover:text-white">
              <span className="text-white/45">{kind}s:</span> {list.length}
            </summary>
            <div className="mt-1 flex max-w-3xl flex-wrap gap-x-3 gap-y-0.5">
              {list.map((unlock) => (
                <Link key={unlock.href + unlock.name} href={unlock.href} className="text-white/70 hover:text-amber-200">
                  {unlock.name}
                </Link>
              ))}
            </div>
          </details>
        ) : (
          <span key={kind} className="text-sm">
            <span className="text-white/45">{kind}{list.length > 1 ? "s" : ""}:</span>{" "}
            {list.map((unlock, index) => (
              <React.Fragment key={unlock.href + unlock.name}>
                {index > 0 ? ", " : ""}
                <Link href={unlock.href} className="text-white/80 hover:text-amber-200">
                  {unlock.name}
                </Link>
              </React.Fragment>
            ))}
          </span>
        ),
      )}
    </div>
  );
}

export function UnlocksTab(props: {
  content: BalanceContent;
  result: JourneyResult;
  curves: { character: CurveTable; skill: CurveTable };
}) {
  const { result } = props;
  const unlocks = useMemo(() => contentUnlocks(props.content), [props.content]);
  const tracks = useMemo(() => {
    const present = new Set(unlocks.map((unlock) => unlock.track));
    return (["CHARACTER", ...[...present].filter((track) => track !== "CHARACTER")] as Track[]);
  }, [unlocks]);
  const [track, setTrack] = useState<Track>("CHARACTER");
  const [gapDays, setGapDays] = useState(14);

  const maxLevel = track === "CHARACTER" ? props.curves.character.maxLevel : props.curves.skill.maxLevel;
  const rows = useMemo(() => unlocksByLevel(unlocks, track), [unlocks, track]);
  const trained = track === "CHARACTER" || result.levelAtDay[track].at(-1)! > 1;
  const reached = (level: number) => (level <= 1 ? 0 : level > maxLevel ? null : dayReached(result, track, level));

  const gaps = rows.slice(1).map(([level], index) => {
    const previous = rows[index]![0];
    const from = reached(previous);
    const to = reached(level);
    return { previous, level, days: from !== null && to !== null ? to - from : null };
  });
  const longest = gaps.reduce<(typeof gaps)[number] | null>(
    (best, gap) => (gap.days !== null && (!best || gap.days > (best.days ?? 0)) ? gap : best),
    null,
  );
  const unreached = rows.filter(([level]) => reached(level) === null);
  const beyondMax = rows.filter(([level]) => level > maxLevel);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-xs text-white/55">
          <span className="block">Track</span>
          <select className={cn(inputClass, "w-auto py-1.5")} value={track} onChange={(event) => setTrack(event.target.value as Track)}>
            {tracks.map((entry) => (
              <option key={entry} value={entry}>
                {trackLabel(entry)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/55">
          <span className="block">Flag waits longer than</span>
          <span className="flex items-center gap-1.5">
            <NumberInput
              className={cn(inputClass, "w-20 py-1.5 text-right")}
              value={gapDays}
              min={1}
              onValueChange={(value) => value !== null && value > 0 && setGapDays(value)}
            />
            days
          </span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Unlock levels" value={rows.length} hint={`${trackLabel(track)}, up to level ${rows.at(-1)?.[0] ?? 1}`} />
        <StatTile
          label="Longest wait"
          value={longest?.days != null ? formatDays(longest.days) : "—"}
          hint={longest ? `Level ${longest.previous} → ${longest.level}` : trained ? "Nothing reached twice" : "Not trained in this scenario"}
        />
        <StatTile
          label={`Waits over ${gapDays} days`}
          value={gaps.filter((gap) => gap.days !== null && gap.days > gapDays).length}
        />
        <StatTile
          label="Not reached"
          value={unreached.length}
          hint={beyondMax.length > 0 ? `${beyondMax.length} above the max level ${maxLevel}` : `Within ${formatDays(result.days)}`}
        />
      </div>

      {!trained ? (
        <p className="rounded-xl bg-amber-400/[0.06] p-4 text-sm text-white/70">
          {trackLabel(track)} isn&apos;t trained in this scenario, so there are no times. Add it to the activities above.
        </p>
      ) : null}

      <section className="rounded-xl bg-gray-950/45 p-5">
        <ol>
          {rows.map(([level, list], index) => {
            const gap = index > 0 ? gaps[index - 1] : null;
            const day = reached(level);
            const long = gap?.days != null && gap.days > gapDays;
            return (
              <li key={level}>
                {gap ? (
                  <div className={cn("ml-[27px] border-l-2 py-1.5 pl-6 text-xs", long ? "border-amber-400/60 text-amber-200" : "border-white/10 text-white/35")}>
                    {gap.days !== null
                      ? `${gap.days < 1 / 1_440 ? "No wait" : formatDays(gap.days)} for ${level - gap.previous} level${level - gap.previous === 1 ? "" : "s"}`
                      : `${level - gap.previous} levels`}
                    {long ? " · long wait" : ""}
                  </div>
                ) : null}
                <div className="grid grid-cols-[56px_120px_minmax(0,1fr)] items-baseline gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
                  <span className="grid h-9 w-11 place-items-center rounded-md bg-white/[0.06] text-sm font-semibold tabular-nums">{level}</span>
                  <span className="text-sm tabular-nums text-white/60">
                    {level > maxLevel ? <Tag tone="bad">Above max</Tag> : day === null ? <Tag>Not reached</Tag> : formatDays(day)}
                  </span>
                  <UnlockList unlocks={list} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
