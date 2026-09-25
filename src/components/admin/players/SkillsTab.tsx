"use client";

import React, { useState } from "react";
import { inputClass, NumberInput, Panel } from "~/components/admin/fields";
import { cn } from "~/lib/utils";
import type { AdminPlayer } from "~/server/admin/players";
import {
  ActionButton,
  Empty,
  formatDate,
  formatDuration,
  humanize,
  Tag,
  usePlayerEdit,
} from "./shared";

const digits = (value: string) => value.replace(/\D/g, "");
const cell = "px-2 py-1.5";

/** One track's row: level or XP (the other follows), plus a skill's totals. */
function TrackRow(props: {
  trackType: string;
  trackKey: string;
  label: string;
  level: number;
  experience: string;
  maxLevel?: number;
  progress?: { currentXp: number; xpForNextLevel: number };
  totals?: { itemsGathered: string; secondsSpent: string };
}) {
  const { run } = usePlayerEdit();
  const [level, setLevel] = useState<number | null>(props.level);
  const [experience, setExperience] = useState(props.experience);
  const [items, setItems] = useState(props.totals?.itemsGathered ?? "");
  const [seconds, setSeconds] = useState(props.totals?.secondsSpent ?? "");
  const key = `${props.trackType}-${props.trackKey}`;

  const changes = {
    // XP wins when both changed: it is the exact one.
    ...(experience !== props.experience && experience
      ? { experience }
      : level !== null && level !== props.level
        ? { level }
        : {}),
    ...(props.totals && items && items !== props.totals.itemsGathered
      ? { itemsGathered: items }
      : {}),
    ...(props.totals && seconds && seconds !== props.totals.secondsSpent
      ? { secondsSpent: seconds }
      : {}),
  };
  const dirty = Object.keys(changes).length > 0;
  const edited = (changed: boolean) => changed && "border-amber-400/60";

  return (
    <tr className="even:bg-white/[0.02]">
      <td className={cn(cell, "pl-0 font-medium")}>{props.label}</td>
      <td className={cn(cell, "w-24")}>
        <NumberInput
          className={cn(inputClass, "h-8 py-1", edited(level !== props.level))}
          min={1}
          max={props.maxLevel}
          value={level}
          onValueChange={setLevel}
        />
      </td>
      <td className={cn(cell, "w-40")}>
        <input
          className={cn(inputClass, "h-8 py-1", edited(experience !== props.experience))}
          inputMode="numeric"
          value={experience}
          onChange={(event) => setExperience(digits(event.target.value))}
        />
      </td>
      <td className={cn(cell, "whitespace-nowrap text-xs text-white/50")}>
        {props.progress
          ? `${props.progress.currentXp.toLocaleString()} / ${props.progress.xpForNextLevel.toLocaleString()}`
          : null}
      </td>
      {props.totals ? (
        <>
          <td className={cn(cell, "w-32")}>
            <input
              className={cn(inputClass, "h-8 py-1", edited(items !== props.totals.itemsGathered))}
              inputMode="numeric"
              value={items}
              onChange={(event) => setItems(digits(event.target.value))}
            />
          </td>
          <td className={cn(cell, "w-32")}>
            <input
              className={cn(inputClass, "h-8 py-1", edited(seconds !== props.totals.secondsSpent))}
              inputMode="numeric"
              title={formatDuration(Number(seconds || 0))}
              value={seconds}
              onChange={(event) => setSeconds(digits(event.target.value))}
            />
          </td>
        </>
      ) : null}
      <td className={cn(cell, "pr-0")}>
        <div className="flex justify-end gap-1.5">
          <ActionButton
            actionKey={`save-${key}`}
            disabled={!dirty}
            onClick={() =>
              run(
                `save-${key}`,
                "/skills",
                "PATCH",
                { trackType: props.trackType, trackKey: props.trackKey, ...changes },
                `${props.label} saved`,
              )
            }
          >
            Save
          </ActionButton>
          <ActionButton
            actionKey={`reset-${key}`}
            variant="ghost"
            confirm={`Reset ${props.label} to level 1 with no XP${props.totals ? " and no lifetime totals" : ""}?`}
            onClick={() =>
              run(
                `reset-${key}`,
                "/skills",
                "DELETE",
                { trackType: props.trackType, trackKey: props.trackKey },
                `${props.label} reset`,
              )
            }
          >
            Reset
          </ActionButton>
        </div>
      </td>
    </tr>
  );
}

function trackKeyOf(row: { level: number; experience: string }, extra = "") {
  return `${row.level}:${row.experience}:${extra}`;
}

function XpHistory({ rows }: { rows: AdminPlayer["xpHistory"] }) {
  return (
    <Panel
      title="Recent character XP"
      description="The last 50 awards the game logged. High-frequency ticks are only logged when they level the character up."
    >
      {rows.length === 0 ? (
        <Empty>Nothing logged.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-white/45">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium">XP</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="py-2 pl-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="even:bg-white/[0.02]">
                  <td className="whitespace-nowrap py-1 pr-3 text-xs text-white/60">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-3 py-1">
                    {humanize(row.vocationalActionType ?? row.actionType)}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    +{Number(row.finalAmount).toLocaleString()}
                  </td>
                  <td className="px-3 py-1">
                    {row.levelAfter > row.levelBefore ? (
                      <Tag tone="good">
                        {row.levelBefore} → {row.levelAfter}
                      </Tag>
                    ) : (
                      row.levelAfter
                    )}
                  </td>
                  <td className="py-1 pl-3 text-xs text-white/60">
                    {row.description ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function SkillsTab() {
  const { player } = usePlayerEdit();

  return (
    <div className="space-y-6">
      <Panel
        title="Skills"
        description="Change the level (they start at its beginning) or the exact XP (the level follows). Items and seconds are the lifetime totals on their skill page."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-xs text-white/45">
                <th className="py-2 pr-2 font-medium">Skill</th>
                <th className="px-2 py-2 font-medium">Level</th>
                <th className="px-2 py-2 font-medium">Total XP</th>
                <th className="px-2 py-2 font-medium">Into level</th>
                <th className="px-2 py-2 font-medium">Items made</th>
                <th className="px-2 py-2 font-medium">Seconds spent</th>
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody>
              {player.skills.map((skill) => (
                <TrackRow
                  key={`${skill.actionType}|${trackKeyOf(skill, `${skill.itemsGathered}:${skill.secondsSpent}`)}`}
                  trackType="SKILL"
                  trackKey={skill.actionType}
                  label={humanize(skill.actionType)}
                  level={skill.level}
                  experience={skill.experience}
                  maxLevel={player.maxSkillLevel}
                  progress={skill.progress}
                  totals={{
                    itemsGathered: skill.itemsGathered,
                    secondsSpent: skill.secondsSpent,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {player.otherTracks.length > 0 ? (
        <Panel
          title="Other progression"
          description="Progress tracks outside the skills."
        >
          <table className="w-full text-sm">
            <tbody>
              {player.otherTracks.map((track) => (
                <TrackRow
                  key={`${track.trackType}:${track.trackKey}|${trackKeyOf(track)}`}
                  trackType={track.trackType}
                  trackKey={track.trackKey}
                  label={`${humanize(track.trackType)} · ${humanize(track.trackKey)}`}
                  level={track.level}
                  experience={track.experience}
                />
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      <XpHistory rows={player.xpHistory} />
    </div>
  );
}
