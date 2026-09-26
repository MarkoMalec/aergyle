"use client";

import React from "react";
import { inputClass, NumberInput } from "~/components/admin/fields";
import { groupLabel, type ActivityGroup, type XpGroup } from "~/game/balance/content";
import {
  MAX_JOURNEY_DAYS,
  PLAYER_PROFILES,
  type JourneyPlan,
  type PlayerProfile,
} from "~/game/balance/journey";
import type { SourceOptions } from "~/game/balance/sources";
import { cn } from "~/lib/utils";
import { Chip, Segmented } from "./ui";

export type ProfileId = (typeof PLAYER_PROFILES)[number]["id"] | "custom";

export type Scenario = {
  profileId: ProfileId;
  profile: PlayerProfile;
  days: number;
  plan: JourneyPlan;
  options: SourceOptions;
};

export function defaultScenario(groups: ActivityGroup[], hasSeeds: boolean): Scenario {
  const regular = PLAYER_PROFILES.find((entry) => entry.id === "regular")!;
  return {
    profileId: regular.id,
    profile: { ...regular.profile },
    days: 365,
    plan: { groups, strategy: "split", garden: hasSeeds, quests: true },
    options: {
      efficiency: 0,
      materials: "bought",
      recipes: true,
      xpScale: {},
      xpMultiplier: 1,
    },
  };
}

const DAY_OPTIONS = [7, 30, 90, 180, 365, 730, 1_825, MAX_JOURNEY_DAYS];

function daysLabel(days: number) {
  if (days < 365) return `${days} days`;
  return `${days / 365} year${days === 365 ? "" : "s"}`;
}

function Row(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
      <div className="text-xs font-medium text-white/55">{props.label}</div>
      <div className="flex flex-wrap items-center gap-2">{props.children}</div>
    </div>
  );
}

function SmallNumber(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-white/55">
      {props.label}
      <NumberInput
        className={cn(inputClass, "w-20 py-1 text-right")}
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        onValueChange={(value) => {
          if (value !== null) props.onChange(Math.min(props.max, Math.max(props.min, value)));
        }}
      />
      {props.suffix}
    </label>
  );
}

export function ScenarioPanel(props: {
  scenario: Scenario;
  onChange: (scenario: Scenario) => void;
  groups: ActivityGroup[];
  hasSeeds: boolean;
}) {
  const { scenario, onChange } = props;
  const plan = scenario.plan;
  const setPlan = (changes: Partial<JourneyPlan>) => onChange({ ...scenario, plan: { ...plan, ...changes } });
  const setOptions = (changes: Partial<SourceOptions>) =>
    onChange({ ...scenario, options: { ...scenario.options, ...changes } });
  const setProfile = (changes: Partial<PlayerProfile>) =>
    onChange({ ...scenario, profileId: "custom", profile: { ...scenario.profile, ...changes } });
  const whatIfs = (Object.entries(scenario.options.xpScale) as Array<[XpGroup, number]>).filter(
    ([, factor]) => factor !== 1,
  );

  return (
    <section className="space-y-3 rounded-xl bg-gray-950/45 p-5">
      <Row label="Player">
        <Segmented
          label="Player profile"
          value={scenario.profileId}
          onChange={(profileId) => {
            const preset = PLAYER_PROFILES.find((entry) => entry.id === profileId);
            onChange({
              ...scenario,
              profileId,
              profile: preset ? { ...preset.profile } : scenario.profile,
            });
          }}
          options={[
            ...PLAYER_PROFILES.map((entry) => ({ value: entry.id, label: entry.label, title: entry.description })),
            { value: "custom" as const, label: "Custom" },
          ]}
        />
        <SmallNumber label="Active" value={scenario.profile.hoursPerDay} min={0} max={24} step={0.5} suffix="h/day" onChange={(hoursPerDay) => setProfile({ hoursPerDay })} />
        <SmallNumber label="Check-ins" value={scenario.profile.checkInsPerDay} min={1} max={288} suffix="/day" onChange={(checkInsPerDay) => setProfile({ checkInsPerDay: Math.round(checkInsPerDay) })} />
        <select
          aria-label="Days simulated"
          className={cn(inputClass, "w-auto py-1.5")}
          value={scenario.days}
          onChange={(event) => onChange({ ...scenario, days: Number(event.target.value) })}
        >
          {DAY_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {daysLabel(days)}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Activities">
        {props.groups.map((group) => (
          <Chip
            key={group}
            on={plan.groups.includes(group)}
            onChange={(on) =>
              setPlan({
                groups: on
                  ? props.groups.filter((entry) => entry === group || plan.groups.includes(entry))
                  : plan.groups.filter((entry) => entry !== group),
              })
            }
          >
            {groupLabel(group)}
          </Chip>
        ))}
        {props.hasSeeds ? (
          <Chip on={plan.garden} onChange={(garden) => setPlan({ garden })} title="Grows alongside other activities">
            Garden
          </Chip>
        ) : null}
        <Chip on={plan.quests} onChange={(quests) => setPlan({ quests })} title="One-time quests when unlocked, repeatable ones every day or week">
          Quests
        </Chip>
        <span className="flex gap-2">
          <button type="button" className="text-xs text-white/45 hover:text-white" onClick={() => setPlan({ groups: props.groups })}>
            All
          </button>
          <button type="button" className="text-xs text-white/45 hover:text-white" onClick={() => setPlan({ groups: [] })}>
            None
          </button>
        </span>
      </Row>

      <Row label="Time goes to">
        <Segmented
          label="Strategy"
          value={plan.strategy}
          onChange={(strategy) => setPlan({ strategy })}
          options={[
            { value: "split", label: "Every activity evenly", title: "Equal hours per chosen activity each day" },
            { value: "fastest", label: "Fastest character XP", title: "The activity with the most character XP per hour first" },
          ]}
        />
      </Row>

      <Row label="Rules">
        <Segmented
          label="Crafting materials"
          value={scenario.options.materials}
          onChange={(materials) => setOptions({ materials })}
          options={[
            { value: "bought", label: "Materials bought", title: "Crafting inputs come from the market or storage" },
            { value: "gathered", label: "Gathers own materials", title: "Crafts include the time (and XP) of gathering their inputs" },
          ]}
        />
        <label className="flex items-center gap-1.5 text-xs text-white/55">
          <input
            type="checkbox"
            className="accent-amber-400"
            checked={scenario.options.recipes}
            onChange={(event) => setOptions({ recipes: event.target.checked })}
          />
          Knows recipes
        </label>
        <SmallNumber label="Tool efficiency" value={scenario.options.efficiency} min={0} max={1_000} onChange={(efficiency) => setOptions({ efficiency })} />
        <SmallNumber label="XP boost ×" value={scenario.options.xpMultiplier} min={0.1} max={10} step={0.1} onChange={(xpMultiplier) => setOptions({ xpMultiplier })} />
      </Row>

      {whatIfs.length > 0 ? (
        <Row label="XP what-ifs">
          {whatIfs.map(([group, factor]) => (
            <span key={group} className="rounded-full bg-sky-400/10 px-2.5 py-1 text-xs text-sky-100">
              {groupLabel(group)} ×{factor}
            </span>
          ))}
          <button type="button" className="text-xs text-white/45 hover:text-white" onClick={() => setOptions({ xpScale: {} })}>
            Reset
          </button>
        </Row>
      ) : null}
    </section>
  );
}
