"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import type { AdminCreature } from "~/components/admin/creatures/CreatureEditor";
import { NumberField } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  combatSnapshotFromStats,
  isFightableMonster,
  type DungeonCombatSnapshot,
  type DungeonDeathRules,
  type DungeonMonsterPoolEntry,
} from "~/server/dungeons/resolver";
import { runDungeonSimulation } from "~/server/dungeons/simulator";
import type { StatType } from "~/generated/prisma/enums";
import {
  calculateFinalStatsFromTotals,
  calculateLevelBaseStats,
  getDefaultBaseStats,
  type StatGrowthRule,
} from "~/utils/stats";

export type MonsterPopulation = {
  creatureId: number;
  enabled: boolean;
  minCount: number;
  maxCount: number;
};

export type TestCharacter = {
  level: number;
  health: number;
  damageMin: number;
  damageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  attackSpeed: number;
  critChance: number;
  critDamage: number;
  armor: number;
  magicResist: number;
  evasion: number;
  block: number;
  resist: number;
};

const NEW_CHARACTER_COMBAT = combatSnapshotFromStats(
  calculateFinalStatsFromTotals(getDefaultBaseStats()),
);

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** A character of the given level without gear, using the admin's stat growth. */
export function testCharacterForLevel(
  level: number,
  statGrowth: Record<StatType, StatGrowthRule>,
): TestCharacter {
  const combat = combatSnapshotFromStats(
    calculateFinalStatsFromTotals(calculateLevelBaseStats(level, statGrowth)),
  );
  return {
    level,
    health: round2(combat.maxHealth),
    damageMin: round2(combat.physicalDamageMin),
    damageMax: round2(combat.physicalDamageMax),
    magicDamageMin: round2(combat.magicDamageMin),
    magicDamageMax: round2(combat.magicDamageMax),
    attackSpeed: round2(combat.attackSpeed),
    critChance: round2(combat.criticalChance),
    critDamage: round2(combat.criticalDamage),
    armor: round2(combat.armor),
    magicResist: round2(combat.magicResist),
    evasion: round2(combat.evasionMelee),
    block: round2(combat.blockChance),
    resist: round2(combat.fireResist),
  };
}

function toCombat(character: TestCharacter): DungeonCombatSnapshot {
  return {
    ...NEW_CHARACTER_COMBAT,
    maxHealth: character.health,
    physicalDamageMin: character.damageMin,
    physicalDamageMax: character.damageMax,
    magicDamageMin: character.magicDamageMin,
    magicDamageMax: character.magicDamageMax,
    attackSpeed: character.attackSpeed,
    criticalChance: character.critChance,
    criticalDamage: character.critDamage,
    armor: character.armor,
    magicResist: character.magicResist,
    evasionMelee: character.evasion,
    evasionRanged: character.evasion,
    evasionMagic: character.evasion,
    blockChance: character.block,
    fireResist: character.resist,
    coldResist: character.resist,
    lightningResist: character.resist,
    poisonResist: character.resist,
  };
}

function buildPool(
  population: MonsterPopulation[],
  monsters: Map<number, AdminCreature>,
  characterLevel: number,
): DungeonMonsterPoolEntry[] {
  return population
    .flatMap((row) => {
      const monster = monsters.get(row.creatureId);
      if (!monster?.enabled || !row.enabled) return [];
      return [
        {
          ...monster,
          creatureId: monster.id,
          minCount: row.minCount,
          maxCount: row.maxCount,
          drops: monster.drops
            .filter(
              (drop) => drop.enabled && drop.requiredLevel <= characterLevel,
            )
            .map((drop) => ({
              dropId: drop.id ?? 0,
              itemId: drop.itemId,
              name: drop.item.name,
              sprite: drop.item.sprite,
              rarity: drop.item.rarity,
              baseChance: drop.baseChance,
              minQuantity: drop.minQuantity,
              maxQuantity: drop.maxQuantity,
            })),
        },
      ];
    })
    .filter(isFightableMonster);
}

export function TestCharacterPanel(props: {
  value: TestCharacter;
  onChange: (value: TestCharacter) => void;
  statGrowth: Record<StatType, StatGrowthRule>;
}) {
  const { value } = props;
  const set = (key: keyof TestCharacter) => (next: number) =>
    props.onChange({ ...value, [key]: next });
  return (
    <details className="rounded-xl bg-white/[0.03]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
        <FlaskConical className="h-4 w-4 text-amber-300" aria-hidden="true" />
        <strong className="text-sm">Test character</strong>
        <span className="text-xs text-white/50">
          Level {value.level} · {value.health} HP · {value.damageMin}–
          {value.damageMax} damage · speed {value.attackSpeed} · armor{" "}
          {value.armor} · evasion {value.evasion}% · block {value.block}%
        </span>
        <span className="ml-auto text-xs text-amber-300/80">Edit</span>
      </summary>
      <div className="space-y-4 px-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs text-white/50">
            Every balance preview below simulates this character. It starts as a
            level 1 character without gear, using the base stats from Character
            stats; raise the numbers to see how a geared player fares.
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              props.onChange(
                testCharacterForLevel(value.level, props.statGrowth),
              )
            }
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Reset to level {value.level} without gear
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          <NumberField
            label="Level"
            value={value.level}
            min={1}
            onChange={set("level")}
          />
          <NumberField
            label="Health"
            value={value.health}
            min={1}
            onChange={set("health")}
          />
          <NumberField
            label="Physical dmg min"
            value={value.damageMin}
            min={0}
            onChange={set("damageMin")}
          />
          <NumberField
            label="Physical dmg max"
            value={value.damageMax}
            min={0}
            onChange={set("damageMax")}
          />
          <NumberField
            label="Magic dmg min"
            value={value.magicDamageMin}
            min={0}
            onChange={set("magicDamageMin")}
          />
          <NumberField
            label="Magic dmg max"
            value={value.magicDamageMax}
            min={0}
            onChange={set("magicDamageMax")}
          />
          <NumberField
            label="Attack speed"
            value={value.attackSpeed}
            min={0.1}
            step={0.1}
            onChange={set("attackSpeed")}
          />
          <NumberField
            label="Crit chance"
            suffix="%"
            value={value.critChance}
            min={0}
            max={100}
            onChange={set("critChance")}
          />
          <NumberField
            label="Crit damage"
            suffix="%"
            value={value.critDamage}
            min={100}
            onChange={set("critDamage")}
          />
          <NumberField
            label="Armor"
            value={value.armor}
            min={0}
            onChange={set("armor")}
          />
          <NumberField
            label="Magic resist"
            value={value.magicResist}
            min={0}
            onChange={set("magicResist")}
          />
          <NumberField
            label="Evasion"
            suffix="%"
            value={value.evasion}
            min={0}
            max={75}
            onChange={set("evasion")}
          />
          <NumberField
            label="Block"
            suffix="%"
            value={value.block}
            min={0}
            max={75}
            onChange={set("block")}
          />
          <NumberField
            label="Elemental resist"
            suffix="%"
            value={value.resist}
            min={-100}
            max={75}
            onChange={set("resist")}
          />
        </div>
      </div>
    </details>
  );
}

function Stat(props: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn("rounded-lg bg-black/20 p-3", props.wide && "col-span-2")}
    >
      <div className="text-[11px] text-white/50">{props.label}</div>
      <div
        className={`mt-0.5 text-lg font-semibold tabular-nums ${props.tone ?? ""}`}
      >
        {props.value}
      </div>
      {props.note ? (
        <div className="text-[11px] leading-snug text-white/45">
          {props.note}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Live preview of a dungeon's unsaved values against the test character,
 * using the same resolver as real runs.
 */
export function BalancePreview(props: {
  population: MonsterPopulation[];
  packSize: number;
  monsters: Map<number, AdminCreature>;
  character: TestCharacter;
  rules: DungeonDeathRules;
}) {
  const { character, packSize, rules } = props;
  const pool = useMemo(
    () => buildPool(props.population, props.monsters, character.level),
    [props.population, props.monsters, character.level],
  );
  const [result, setResult] = useState<ReturnType<
    typeof runDungeonSimulation
  > | null>(null);

  useEffect(() => {
    if (pool.length === 0) {
      setResult(null);
      return;
    }
    // Debounced so typing a number doesn't re-simulate on every keystroke.
    const timer = window.setTimeout(() => {
      setResult(
        runDungeonSimulation({
          pool,
          combat: toCombat(character),
          packSize,
          startingHealth: character.health,
          deathRules: rules,
          iterations: 1_000,
        }),
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pool, character, packSize, rules]);

  const minMonsters = pool.reduce((sum, monster) => sum + monster.minCount, 0);
  const maxMonsters = pool.reduce((sum, monster) => sum + monster.maxCount, 0);
  const survival = result ? result.survivalRate * 100 : 0;
  const recommended = result?.recommendedHealth;

  return (
    <div className="space-y-3 rounded-xl bg-amber-400/[0.04] p-4">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <FlaskConical className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Balance preview
        </h4>
        <p className="mt-1 text-[11px] text-white/45">
          1,000 simulated runs of the values on the left (saved or not) against
          the test character.
        </p>
      </div>
      {pool.length === 0 ? (
        <p className="rounded-lg bg-black/20 p-3 text-sm text-white/55">
          Add at least one enabled monster with health to see a preview.
        </p>
      ) : !result ? (
        <p className="rounded-lg bg-black/20 p-3 text-sm text-white/55">
          Simulating…
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label={`Survives with ${character.health} HP`}
            value={`${survival.toFixed(0)}%`}
            tone={
              survival >= 90
                ? "text-emerald-300"
                : survival >= 50
                  ? "text-amber-300"
                  : "text-red-300"
            }
          />
          <Stat
            label="Recommended health"
            value={recommended ?? "Unwinnable"}
            tone={recommended === null ? "text-red-300" : undefined}
            note="Survives 9 in 10 runs. Players see this for their own gear."
          />
          <Stat
            label="Monsters per run"
            value={
              minMonsters === maxMonsters
                ? minMonsters
                : `${minMonsters}–${maxMonsters}`
            }
            note={
              packSize === 1
                ? "fought one at a time"
                : `up to ${packSize} attacking at once`
            }
          />
          <Stat
            label="Average damage taken"
            value={result.averageDamage.toFixed(0)}
          />
          <Stat
            wide
            label="Average loot (items)"
            value={result.averageItemsWhenCleared.toFixed(1)}
            note={`when cleared · ${result.averageItemsWhenDefeated.toFixed(1)} when defeated`}
          />
        </div>
      )}
    </div>
  );
}
