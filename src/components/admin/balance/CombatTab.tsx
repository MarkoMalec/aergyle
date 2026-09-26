"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { inputClass } from "~/components/admin/fields";
import { Tag } from "~/components/admin/players/shared";
import {
  combatAtLevel,
  dungeonSurvival,
  gearForLevel,
  lowestSurvivingLevel,
  resolveGearPiece,
  type GearChoice,
  type GearPiece,
} from "~/game/balance/combat";
import type { CurveTable } from "~/game/balance/curve";
import type { BalanceContent, BalanceDungeon } from "~/game/balance/content";
import { dayReached, type JourneyResult } from "~/game/balance/journey";
import { cn } from "~/lib/utils";
import { formatDays, formatDecimal, formatPercent, formatXp } from "./format";
import { Segmented } from "./ui";

type Check = {
  dungeon: BalanceDungeon;
  survival: number;
  lowest: number | null;
};

const TARGETS = [0.5, 0.75, 0.9, 0.99] as const;
const RUNS = 200;

function Verdict(props: { check: Check }) {
  const { dungeon, lowest } = props.check;
  if (dungeon.monsters.length === 0) return <Tag tone="bad">No monsters</Tag>;
  if (lowest === null) return <Tag tone="bad">Not survivable at any level</Tag>;
  if (lowest > dungeon.requiredLevel) return <Tag tone="warn">{`Needs level ${lowest} (+${lowest - dungeon.requiredLevel})`}</Tag>;
  if (lowest < dungeon.requiredLevel - 10) return <Tag tone="info">{`Survivable from level ${lowest}`}</Tag>;
  return <Tag tone="good">Fits its level</Tag>;
}

/** Items of one slot by level, flagging ones weaker than an earlier item. */
function slotLadder(content: BalanceContent, choice: NonNullable<GearChoice>) {
  const slots = new Map<string, Array<GearPiece & { weakerThan: GearPiece | null }>>();
  const pieces = content.items
    .map((item) => resolveGearPiece(item, choice.rarity, choice.multiplier))
    .filter((piece): piece is GearPiece => (piece?.power ?? null) !== null)
    .sort((a, b) => a.item.requiredLevel - b.item.requiredLevel);
  for (const piece of pieces) {
    const list = slots.get(piece.slot) ?? [];
    const weakerThan =
      list.find((earlier) => earlier.item.requiredLevel < piece.item.requiredLevel && earlier.power! > piece.power! * 1.0001) ?? null;
    list.push({ ...piece, weakerThan });
    slots.set(piece.slot, list);
  }
  return [...slots];
}

export function CombatTab(props: {
  content: BalanceContent;
  result: JourneyResult;
  curves: { character: CurveTable; skill: CurveTable };
}) {
  const { content } = props;
  const rarities = content.rarities;
  const defaultRarity = rarities.find((entry) => entry.rarity === "COMMON")?.rarity ?? rarities[0]?.rarity ?? null;
  const [rarity, setRarity] = useState<string>(defaultRarity ?? "NONE");
  const [target, setTarget] = useState<(typeof TARGETS)[number]>(0.9);
  const [checks, setChecks] = useState<Check[]>([]);
  const [progress, setProgress] = useState(0);

  const choice: GearChoice = useMemo(() => {
    const entry = rarities.find((candidate) => candidate.rarity === rarity);
    return entry ? { rarity: entry.rarity, multiplier: entry.multiplier } : null;
  }, [rarities, rarity]);
  const maxLevel = props.curves.character.maxLevel;

  useEffect(() => {
    // One dungeon per task so a long search never freezes the page.
    let cancelled = false;
    const gearCache = new Map<number, GearPiece[]>();
    const combatFor = (level: number) => {
      let gear = gearCache.get(level);
      if (!gear) {
        gear = gearForLevel(content, level, choice);
        gearCache.set(level, gear);
      }
      return combatAtLevel(content, level, gear);
    };
    const results: Check[] = [];
    setChecks([]);
    setProgress(0);
    const run = (index: number) => {
      if (cancelled || index >= content.dungeons.length) return;
      const dungeon = content.dungeons[index]!;
      const survival = dungeonSurvival(dungeon, combatFor(dungeon.requiredLevel), RUNS).rate;
      const lowest =
        dungeon.monsters.length === 0 ? null : lowestSurvivingLevel(dungeon, combatFor, target, maxLevel, RUNS);
      results.push({ dungeon, survival, lowest });
      setChecks([...results]);
      setProgress(index + 1);
      setTimeout(() => run(index + 1), 0);
    };
    const timer = setTimeout(() => run(0), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content, choice, target, maxLevel]);

  const ladder = useMemo(() => (choice ? slotLadder(content, choice) : []), [content, choice]);
  const flagged = ladder.reduce((sum, [, list]) => sum + list.filter((piece) => piece.weakerThan).length, 0);
  const running = progress < content.dungeons.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-xs text-white/55">
          <span className="block">Character gear</span>
          <select className={cn(inputClass, "w-auto py-1.5")} value={rarity} onChange={(event) => setRarity(event.target.value)}>
            <option value="NONE">No gear (base stats only)</option>
            {rarities.map((entry) => (
              <option key={entry.rarity} value={entry.rarity}>
                Best items for their level, {entry.label} (×{entry.multiplier})
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1 text-xs text-white/55">
          <span className="block">Survive at least</span>
          <Segmented
            label="Survival target"
            value={String(target)}
            onChange={(value) => setTarget(Number(value) as (typeof TARGETS)[number])}
            options={TARGETS.map((value) => ({ value: String(value), label: formatPercent(value) }))}
          />
        </div>
        {running ? (
          <span className="pb-2 text-xs text-white/45">
            Simulating {progress + 1} of {content.dungeons.length}…
          </span>
        ) : null}
      </div>

      <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
        <div>
          <h2 className="font-semibold">Dungeons by level</h2>
          <p className="text-xs text-white/45">
            A character with base stats from the character-stat rules for its level
            {choice ? " plus, in every slot, the strongest item it may equip" : ""}, entering at full health.{" "}
            {RUNS} runs per check with the live combat resolver; the level search assumes survival only improves with level.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg bg-white/[0.02]">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs text-white/45">
              <tr>
                <th className="px-3 py-2 font-medium">Dungeon</th>
                <th className="px-3 py-2 text-right font-medium">Requires</th>
                <th className="px-3 py-2 text-right font-medium">XP / run</th>
                <th className="px-3 py-2 text-right font-medium">XP/h</th>
                <th className="px-3 py-2 text-right font-medium">Survival at requirement</th>
                <th className="px-3 py-2 text-right font-medium">Survives {formatPercent(target)} from</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
                <th className="px-3 py-2 text-right font-medium">Player gets there</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {checks.map((check) => (
                <tr key={check.dungeon.id} className="border-t border-white/5">
                  <td className="px-3 py-1.5">
                    <Link href="/admin/dungeons" className="hover:text-amber-200">
                      {check.dungeon.name}
                    </Link>
                    <span className="ml-1.5 text-xs text-white/40">{check.dungeon.locationName}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">{check.dungeon.requiredLevel}</td>
                  <td className="px-3 py-1.5 text-right text-white/65">{formatXp(check.dungeon.xp)}</td>
                  <td className="px-3 py-1.5 text-right text-white/65">{formatXp((check.dungeon.xp * 3_600) / check.dungeon.seconds)}</td>
                  <td className="px-3 py-1.5 text-right">{formatPercent(check.survival)}</td>
                  <td className="px-3 py-1.5 text-right">{check.lowest === null ? "—" : `Level ${check.lowest}`}</td>
                  <td className="px-3 py-1.5">
                    <Verdict check={check} />
                  </td>
                  <td className="px-3 py-1.5 text-right text-white/65">
                    {formatDays(dayReached(props.result, "CHARACTER", Math.min(maxLevel, Math.max(check.lowest ?? 0, check.dungeon.requiredLevel))))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/40">
          &quot;Player gets there&quot; is when the scenario&apos;s character reaches the higher of the requirement and the
          survivable level. The dungeon editor&apos;s simulator tests one dungeon against any stats you type.
        </p>
      </section>

      {choice ? (
        <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
          <div>
            <h2 className="font-semibold">Gear by level</h2>
            <p className="text-xs text-white/45">
              Power is average damage × attack speed for weapons and armor + magic resist for armour, at{" "}
              {rarities.find((entry) => entry.rarity === choice.rarity)?.label} rarity.{" "}
              {flagged > 0
                ? `${flagged} item${flagged === 1 ? " is" : "s are"} weaker than an item of a lower level in the same slot.`
                : "Every item beats the lower-level items of its slot."}
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {ladder.map(([slot, pieces]) => (
              <details key={slot} className="rounded-lg bg-white/[0.02] p-3" open={pieces.some((piece) => piece.weakerThan)}>
                <summary className="cursor-pointer text-sm">
                  <span className="font-medium capitalize">{slot}</span>{" "}
                  <span className="text-white/45">
                    {pieces.length} item{pieces.length === 1 ? "" : "s"}, levels {pieces[0]!.item.requiredLevel}–{pieces.at(-1)!.item.requiredLevel}
                  </span>
                  {pieces.some((piece) => piece.weakerThan) ? (
                    <span className="ml-2">
                      <Tag tone="warn">{`${pieces.filter((piece) => piece.weakerThan).length} weaker`}</Tag>
                    </span>
                  ) : null}
                </summary>
                <table className="mt-2 w-full text-sm">
                  <tbody className="tabular-nums">
                    {pieces.map((piece) => (
                      <tr key={piece.item.id} className="border-t border-white/5">
                        <td className="w-14 py-1 text-white/50">{piece.item.requiredLevel}</td>
                        <td className="py-1">
                          <Link href={`/admin/items/${piece.item.id}`} className="hover:text-amber-200">
                            {piece.item.name}
                          </Link>
                        </td>
                        <td className="py-1 text-right">{formatDecimal(piece.power!)}</td>
                        <td className="w-48 py-1 pl-3 text-xs">
                          {piece.weakerThan ? (
                            <span className="text-amber-200">
                              weaker than {piece.weakerThan.item.name} ({piece.weakerThan.item.requiredLevel})
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
