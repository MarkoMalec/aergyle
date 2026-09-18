"use client";

import Image from "next/image";
import React from "react";
import {
  BarChart3,
  Dices,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  calculateGatheringEffectiveFindChance,
  calculateGatheringRewardModifiers,
  type GatheringRewardPoolEntry,
} from "~/server/gathering/rewards";
import {
  runGatheringSimulation,
  type GatheringSimulationResult,
} from "~/server/gathering/simulator";
import type {
  GatheringAdminDuration,
  GatheringAdminLocation,
  GatheringAdminResource,
  RarityOption,
} from "./GatheringAdminClient";

type ScenarioResource = GatheringRewardPoolEntry & {
  enabled: boolean;
  requiredSkillLevel: number;
};

const inputClass =
  "h-9 w-full rounded-md border border-white/10 bg-black/25 px-2 text-sm text-white outline-none transition focus:border-amber-400/50";
const integerFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 0,
});
const decimalFormatter = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function formatPercent(value: number) {
  const percent = value * 100;
  if (percent > 0 && percent < 0.01) return "<0.01%";
  return percent.toFixed(percent < 10 ? 2 : 1) + "%";
}

function formatSignedPercent(value: number) {
  return (value >= 0 ? "+" : "") + value.toFixed(1) + "%";
}

function createScenarioPool(
  location: GatheringAdminLocation | undefined,
  resources: GatheringAdminResource[],
): ScenarioResource[] {
  if (!location) return [];
  const resourcesById = new Map(
    resources.map((resource) => [resource.id, resource]),
  );

  return location.resources.flatMap((pool) => {
    const resource = resourcesById.get(pool.resourceId);
    if (!resource) return [];
    return [
      {
        resourceId: resource.id,
        itemId: resource.itemId,
        name: resource.name,
        sprite: resource.item.sprite,
        rarity: resource.rarity as GatheringRewardPoolEntry["rarity"],
        enabled: pool.enabled,
        requiredSkillLevel: resource.requiredSkillLevel,
        baseChance: pool.baseChance,
        minQuantity: pool.minQuantity,
        maxQuantity: pool.maxQuantity,
      },
    ];
  });
}

function SimulatorField(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-white/60">
      {props.label}
      {props.children}
    </label>
  );
}

function ResultMetric(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-3">
      <div className="text-xl font-semibold text-white">{props.value}</div>
      <div className="text-xs text-white/50">{props.label}</div>
    </div>
  );
}

export function GatheringSimulator(props: {
  locations: GatheringAdminLocation[];
  resources: GatheringAdminResource[];
  durations: GatheringAdminDuration[];
  rarities: RarityOption[];
}) {
  const initialLocation =
    props.locations.find((location) => location.gatheringEnabled) ??
    props.locations[0];
  const initialDuration =
    props.durations.find((duration) => duration.enabled) ?? props.durations[0];

  const [locationId, setLocationId] = React.useState(initialLocation?.id ?? 0);
  const [durationPresetId, setDurationPresetId] = React.useState<number | null>(
    initialDuration?.id ?? null,
  );
  const [durationHours, setDurationHours] = React.useState(
    (initialDuration?.durationSeconds ?? 3_600) / 3_600,
  );
  const [rewardRolls, setRewardRolls] = React.useState(
    initialDuration?.rewardRolls ?? 1,
  );
  const [quantityMultiplier, setQuantityMultiplier] = React.useState(
    initialDuration?.quantityMultiplier ?? 1,
  );
  const [skillLevel, setSkillLevel] = React.useState(1);
  const [luck, setLuck] = React.useState(0);
  const [gatheringEfficiency, setGatheringEfficiency] = React.useState(0);
  const [iterations, setIterations] = React.useState(10_000);
  const [scenarioPool, setScenarioPool] = React.useState<ScenarioResource[]>(
    () => createScenarioPool(initialLocation, props.resources),
  );
  const [result, setResult] = React.useState<GatheringSimulationResult | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);

  const location = props.locations.find((entry) => entry.id === locationId);
  const durationPreset = props.durations.find(
    (duration) => duration.id === durationPresetId,
  );
  const modifiers = calculateGatheringRewardModifiers({
    skillLevel,
    luck,
    gatheringEfficiency,
    quantityMultiplier,
  });

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  const selectLocation = (nextLocationId: number) => {
    const nextLocation = props.locations.find(
      (entry) => entry.id === nextLocationId,
    );
    setLocationId(nextLocationId);
    setScenarioPool(createScenarioPool(nextLocation, props.resources));
    clearResult();
  };

  const selectDuration = (nextDurationId: number | null) => {
    setDurationPresetId(nextDurationId);
    const duration = props.durations.find(
      (entry) => entry.id === nextDurationId,
    );
    if (duration) {
      setDurationHours(duration.durationSeconds / 3_600);
      setRewardRolls(duration.rewardRolls);
      setQuantityMultiplier(duration.quantityMultiplier);
    }
    clearResult();
  };

  const updateScenarioResource = (
    resourceId: number,
    patch: Partial<ScenarioResource>,
  ) => {
    setScenarioPool((current) =>
      current.map((resource) =>
        resource.resourceId === resourceId
          ? { ...resource, ...patch }
          : resource,
      ),
    );
    clearResult();
  };

  const resetPool = () => {
    setScenarioPool(createScenarioPool(location, props.resources));
    clearResult();
  };

  const runSimulation = () => {
    const normalizedSkillLevel = Math.floor(clamp(skillLevel, 0, 10_000));
    const pool = scenarioPool.filter(
      (resource) =>
        resource.enabled &&
        resource.requiredSkillLevel <= normalizedSkillLevel &&
        resource.baseChance > 0 &&
        resource.minQuantity > 0 &&
        resource.maxQuantity >= resource.minQuantity,
    );

    if (pool.length === 0) {
      setResult(null);
      setError("No enabled resources are available at this Gathering level.");
      return;
    }

    setRunning(true);
    setError(null);
    window.setTimeout(() => {
      try {
        setResult(
          runGatheringSimulation({
            pool,
            durationSeconds: clamp(durationHours, 1 / 60, 168) * 3_600,
            rewardRolls: Math.floor(clamp(rewardRolls, 1, 100)),
            quantityMultiplier: clamp(quantityMultiplier, 0.1, 20),
            skillLevel: normalizedSkillLevel,
            luck: clamp(luck, -100, 250),
            gatheringEfficiency: clamp(gatheringEfficiency, 0, 250),
            iterations: Math.floor(clamp(iterations, 1, 100_000)),
          }),
        );
      } catch {
        setResult(null);
        setError("The scenario could not be simulated. Check its values.");
      } finally {
        setRunning(false);
      }
    }, 0);
  };

  const sortedResults = React.useMemo(() => {
    if (!result) return [];
    const rarityOrder = new Map(
      props.rarities.map((rarity, index) => [rarity.value, index]),
    );
    return [...result.resources].sort(
      (left, right) =>
        (rarityOrder.get(left.rarity) ?? Number.MAX_SAFE_INTEGER) -
          (rarityOrder.get(right.rarity) ?? Number.MAX_SAFE_INTEGER) ||
        left.name.localeCompare(right.name),
    );
  }, [props.rarities, result]);

  if (!initialLocation || !initialDuration) {
    return (
      <section className="rounded-lg border border-dashed border-white/10 bg-gray-900/40 p-6 text-sm text-white/60">
        Add at least one location and one expedition duration to use the balance
        simulator.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-amber-300/20 bg-gray-900/45">
      <div className="border-b border-white/10 bg-gradient-to-r from-amber-400/[0.09] via-emerald-400/[0.05] to-transparent p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-amber-300/20 bg-amber-300/10 p-2">
              <BarChart3 className="h-5 w-5 text-amber-200" />
            </span>
            <div>
              <h2 className="font-semibold text-white">
                Gathering balance simulator
              </h2>
              <p className="text-sm text-white/55">
                Monte Carlo results from the live expedition reward engine.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            No player data is changed
          </span>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-3 rounded-lg border border-white/10 bg-black/15 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <SlidersHorizontal className="h-4 w-4 text-sky-300" />
              Expedition
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <SimulatorField label="Location">
                <select
                  className={inputClass}
                  value={locationId}
                  onChange={(event) =>
                    selectLocation(Number(event.target.value))
                  }
                >
                  {props.locations.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                      {entry.gatheringEnabled ? "" : " (disabled)"}
                    </option>
                  ))}
                </select>
              </SimulatorField>
              <SimulatorField label="Duration preset">
                <select
                  className={inputClass}
                  value={durationPresetId ?? ""}
                  onChange={(event) =>
                    selectDuration(
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                >
                  <option value="">Custom scenario</option>
                  {props.durations.map((duration) => (
                    <option key={duration.id} value={duration.id}>
                      {duration.label} · Lv {duration.requiredGatheringLevel}
                      {duration.enabled ? "" : " · disabled"}
                    </option>
                  ))}
                </select>
              </SimulatorField>
              <SimulatorField label="Hours">
                <input
                  className={inputClass}
                  type="number"
                  min={1 / 60}
                  max={168}
                  step={0.25}
                  value={durationHours}
                  onChange={(event) => {
                    setDurationHours(Number(event.target.value));
                    setDurationPresetId(null);
                    clearResult();
                  }}
                />
              </SimulatorField>
              <SimulatorField label="Simulated expeditions">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={100_000}
                  step={1_000}
                  value={iterations}
                  onChange={(event) => {
                    setIterations(Number(event.target.value));
                    clearResult();
                  }}
                />
              </SimulatorField>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-white/10 bg-black/15 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <Dices className="h-4 w-4 text-violet-300" />
              Character totals
            </h3>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <SimulatorField label="Gathering level">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={10_000}
                  value={skillLevel}
                  onChange={(event) => {
                    setSkillLevel(Number(event.target.value));
                    clearResult();
                  }}
                />
              </SimulatorField>
              <SimulatorField label="Total Luck">
                <input
                  className={inputClass}
                  type="number"
                  min={-100}
                  max={250}
                  value={luck}
                  onChange={(event) => {
                    setLuck(Number(event.target.value));
                    clearResult();
                  }}
                />
              </SimulatorField>
              <SimulatorField label="Gathering Efficiency">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={250}
                  value={gatheringEfficiency}
                  onChange={(event) => {
                    setGatheringEfficiency(Number(event.target.value));
                    clearResult();
                  }}
                />
              </SimulatorField>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <span className="rounded-full bg-violet-300/10 px-2.5 py-1 text-violet-200">
                Find {formatSignedPercent(modifiers.findModifierPercent)}
              </span>
              <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-emerald-200">
                Quantity{" "}
                {formatSignedPercent(modifiers.quantityModifierPercent)}
              </span>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-white/10 bg-black/15 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
              <Play className="h-4 w-4 text-emerald-300" />
              Reward settings
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <SimulatorField label="Find rolls">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={100}
                  value={rewardRolls}
                  onChange={(event) => {
                    setRewardRolls(Number(event.target.value));
                    setDurationPresetId(null);
                    clearResult();
                  }}
                />
              </SimulatorField>
              <SimulatorField label="Quantity multiplier">
                <input
                  className={inputClass}
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.05}
                  value={quantityMultiplier}
                  onChange={(event) => {
                    setQuantityMultiplier(Number(event.target.value));
                    setDurationPresetId(null);
                    clearResult();
                  }}
                />
              </SimulatorField>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.025] px-3 py-2 text-xs text-white/50">
              Final quantity scale{" "}
              <span className="font-semibold text-white/80">
                ×{modifiers.quantityScale.toFixed(2)}
              </span>
              . Hours normalize yield; rolls and quantity × determine the haul.
            </div>
            {durationPreset &&
            skillLevel < durationPreset.requiredGatheringLevel ? (
              <div className="text-xs font-medium text-amber-200/80">
                This preset unlocks at Gathering level{" "}
                {durationPreset.requiredGatheringLevel}.
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/15 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-white/90">
                Scenario resource pool
              </h3>
              <p className="text-xs text-white/45">
                Temporary overrides for this simulation only.
              </p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={resetPool}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset saved values
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-black/20 text-left text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="p-3">Use</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">Unlock</th>
                  <th className="p-3">Base / roll</th>
                  <th className="p-3">Effective / roll</th>
                  <th className="p-3">Minimum</th>
                  <th className="p-3">Maximum</th>
                </tr>
              </thead>
              <tbody>
                {scenarioPool.map((resource) => {
                  const unlocked = resource.requiredSkillLevel <= skillLevel;
                  const rarity = props.rarities.find(
                    (entry) => entry.value === resource.rarity,
                  );
                  return (
                    <tr
                      key={resource.resourceId}
                      className={[
                        "border-t border-white/10",
                        resource.enabled && unlocked ? "" : "opacity-55",
                      ].join(" ")}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={"Use " + resource.name}
                          checked={resource.enabled}
                          onChange={(event) =>
                            updateScenarioResource(resource.resourceId, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Image
                            src={resource.sprite}
                            alt=""
                            width={34}
                            height={34}
                            className="h-9 w-9 rounded bg-black/20 object-contain"
                          />
                          <div>
                            <div className="font-medium text-white/90">
                              {resource.name}
                            </div>
                            <div
                              className="text-xs"
                              style={{ color: rarity?.color ?? "#ffffff" }}
                            >
                              {rarity?.label ?? resource.rarity}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={[
                            "rounded-full px-2 py-1 text-xs font-semibold",
                            unlocked
                              ? "bg-emerald-300/10 text-emerald-200"
                              : "bg-amber-300/10 text-amber-200",
                          ].join(" ")}
                        >
                          Lv {resource.requiredSkillLevel}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex max-w-32 items-center gap-2">
                          <input
                            className={inputClass}
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={Math.round(resource.baseChance * 1_000) / 10}
                            onChange={(event) =>
                              updateScenarioResource(resource.resourceId, {
                                baseChance:
                                  clamp(Number(event.target.value), 0, 100) /
                                  100,
                              })
                            }
                          />
                          <span className="text-white/45">%</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-xs text-sky-200">
                        {resource.enabled && unlocked
                          ? formatPercent(
                              calculateGatheringEffectiveFindChance(
                                resource.baseChance,
                                modifiers.findModifierPercent,
                              ),
                            )
                          : "—"}
                      </td>
                      <td className="p-3">
                        <input
                          className={inputClass + " max-w-24"}
                          type="number"
                          min={1}
                          value={resource.minQuantity}
                          onChange={(event) =>
                            updateScenarioResource(resource.resourceId, {
                              minQuantity: Math.max(
                                1,
                                Math.floor(Number(event.target.value)),
                              ),
                              maxQuantity: Math.max(
                                resource.maxQuantity,
                                Math.max(
                                  1,
                                  Math.floor(Number(event.target.value)),
                                ),
                              ),
                            })
                          }
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className={inputClass + " max-w-24"}
                          type="number"
                          min={1}
                          value={resource.maxQuantity}
                          onChange={(event) =>
                            updateScenarioResource(resource.resourceId, {
                              maxQuantity: Math.max(
                                resource.minQuantity,
                                Math.floor(Number(event.target.value)),
                              ),
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-white/45">
            {location?.name} ·{" "}
            {
              scenarioPool.filter(
                (resource) =>
                  resource.enabled &&
                  resource.requiredSkillLevel <= skillLevel &&
                  resource.baseChance > 0,
              ).length
            }{" "}
            eligible resources
          </div>
          <Button
            type="button"
            onClick={runSimulation}
            disabled={running}
            className="min-w-44"
          >
            <Play className="h-4 w-4" />
            {running ? "Simulating…" : "Run simulation"}
          </Button>
        </div>

        {error ? (
          <div className="rounded-md border border-red-300/15 bg-red-300/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-4 border-t border-white/10 pt-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ResultMetric
                label="Items / expedition"
                value={decimalFormatter.format(
                  result.averageItemsPerExpedition,
                )}
              />
              <ResultMetric
                label="Items / hour"
                value={decimalFormatter.format(result.averageItemsPerHour)}
              />
              <ResultMetric
                label="Resources / expedition"
                value={decimalFormatter.format(result.averageDistinctResources)}
              />
              <ResultMetric
                label="Expeditions simulated"
                value={integerFormatter.format(result.iterations)}
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-white/10">
              <div className="border-b border-white/10 bg-black/15 px-4 py-3">
                <h3 className="text-sm font-semibold text-white/90">
                  Simulated findings
                </h3>
                <p className="text-xs text-white/45">
                  Observed find rate includes the guaranteed fallback when every
                  normal roll misses.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-black/20 text-left text-xs uppercase tracking-wide text-white/45">
                    <tr>
                      <th className="p-3">Resource</th>
                      <th className="p-3 text-right">Base / roll</th>
                      <th className="p-3 text-right">Effective / roll</th>
                      <th className="p-3 text-right">Observed find</th>
                      <th className="p-3 text-right">Avg / expedition</th>
                      <th className="p-3 text-right">Avg / hour</th>
                      <th className="p-3 text-right">Avg when found</th>
                      <th className="p-3 text-right">Total found</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResults.map((resource) => {
                      const rarity = props.rarities.find(
                        (entry) => entry.value === resource.rarity,
                      );
                      return (
                        <tr
                          key={resource.resourceId}
                          className="border-t border-white/10"
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <Image
                                src={resource.sprite}
                                alt=""
                                width={32}
                                height={32}
                                className="h-8 w-8 object-contain"
                              />
                              <div>
                                <div className="font-medium text-white/90">
                                  {resource.name}
                                </div>
                                <div
                                  className="text-xs"
                                  style={{ color: rarity?.color ?? "#ffffff" }}
                                >
                                  {rarity?.label ?? resource.rarity}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-white/65">
                            {formatPercent(resource.baseChance)}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-sky-200">
                            {formatPercent(resource.effectiveChance)}
                          </td>
                          <td className="p-3 text-right font-mono text-xs font-semibold text-amber-200">
                            {formatPercent(resource.expeditionFindRate)}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-white/75">
                            {decimalFormatter.format(
                              resource.averageQuantityPerExpedition,
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-white/75">
                            {decimalFormatter.format(
                              resource.averageQuantityPerHour,
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-white/75">
                            {decimalFormatter.format(
                              resource.averageQuantityWhenFound,
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-xs text-white/75">
                            {integerFormatter.format(resource.totalQuantity)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center text-sm text-white/45">
            Run the scenario to compare find rates and hourly yield.
          </div>
        )}
      </div>
    </section>
  );
}
