"use client";

import React, { useState } from "react";
import { Activity, X } from "lucide-react";
import { toCreatureAttackProfile } from "~/server/creatures/attackProfile";
import { runHuntingSimulation } from "~/server/hunting/simulator";
import { strikeRulesFor, type CombatConfig } from "~/server/combat/rules";
import {
  SearchSelect,
  type SearchOption,
} from "~/components/admin/SearchSelect";
import { Button } from "~/components/ui/button";
import {
  CreatureEditor,
  creatureProblems,
  saveCreature,
  type AdminCreature,
  type AdminItemOption,
} from "~/components/admin/creatures/CreatureEditor";
import {
  Art,
  Card,
  DetailHeader,
  DurationTable,
  editorInput,
  EditorTabs,
  Labeled,
  ListAction,
  masterDetailClass,
  Num,
  patchRow,
  Percent,
  PickList,
  RangeInputs,
  rowClass,
  SaveBar,
  theadClass,
  Toggle,
  useDraft,
  useSelection,
  useServerAction,
  useUrlTab,
} from "~/components/admin/editor";
import { adminRequest, StatTiles } from "~/components/admin/fields";
import { cn } from "~/lib/utils";

type Config = {
  damageEnabled: boolean;
  globalDangerMultiplier: number;
  maxHealthLossPercent: number;
  minimumRemainingHealthPercent: number;
  minimumHealthToStartPercent: number;
};

type Duration = {
  id: number;
  label: string;
  durationSeconds: number;
  encounterRolls: number;
  quantityMultiplier: number;
  dangerMultiplier: number;
  xpReward: number;
  requiredHuntingLevel: number;
  enabled: boolean;
  sortOrder: number;
};

type Assignment = {
  creatureId: number;
  enabled: boolean;
  encounterWeight: number;
};

type Ground = {
  id: number;
  locationId: number;
  locationName: string;
  name: string;
  description: string | null;
  requiredHuntingLevel: number;
  enabled: boolean;
  sortOrder: number;
  requiredStageId: number | null;
  accidentChance: number;
  accidentDamageMin: number;
  accidentDamageMax: number;
  creatures: Assignment[];
};

type LocationOption = { id: number; name: string; requiredLevel: number };

const TABS = [
  "grounds",
  "animals",
  "durations",
  "safety",
  "simulator",
] as const;

const saveGround = patchRow<Ground>(
  "/api/admin/hunting/grounds",
  ({ id: _id, locationName: _name, ...ground }) => ground,
);
const saveDuration = patchRow<Duration>("/api/admin/hunting/durations");
const saveConfig = ({ id: _id, ...config }: Config & { id: number }) =>
  adminRequest("/api/admin/hunting/config", "PATCH", config);

/** Share of encounters each enabled animal gets on a ground. */
function encounterShares(ground: Ground, animals: Map<number, AdminCreature>) {
  const live = ground.creatures.filter(
    (row) => row.enabled && animals.get(row.creatureId)?.enabled,
  );
  const total = live.reduce((sum, row) => sum + row.encounterWeight, 0);
  return new Map(
    live.map((row) => [
      row.creatureId,
      total ? row.encounterWeight / total : 0,
    ]),
  );
}

function GroundView(props: {
  ground: Ground;
  animals: AdminCreature[];
  locations: LocationOption[];
  stages: SearchOption[];
  update: (patch: Partial<Ground>) => void;
  onOpenAnimal?: (id: number) => void;
}) {
  const { ground, update } = props;
  const animalById = new Map(
    props.animals.map((animal) => [animal.id, animal]),
  );
  const shares = encounterShares(ground, animalById);
  const assigned = new Set(ground.creatures.map((row) => row.creatureId));
  const updateAssignment = (creatureId: number, patch: Partial<Assignment>) =>
    update({
      creatures: ground.creatures.map((row) =>
        row.creatureId === creatureId ? { ...row, ...patch } : row,
      ),
    });

  return (
    <div className="min-w-0 space-y-4">
      <DetailHeader
        title={ground.name || "Unnamed ground"}
        subtitle={`${ground.locationName} · ${shares.size} animals active · ${(ground.accidentChance * 100).toFixed(1)}% accident chance`}
      >
        <label className="flex items-center gap-2 text-sm text-white/70">
          <Toggle
            label={`${ground.name} enabled`}
            checked={ground.enabled}
            onChange={(enabled) => update({ enabled })}
          />
          {ground.enabled ? "Open to players" : "Hidden"}
        </label>
      </DetailHeader>

      <Card title="Setup">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Labeled label="Name">
            <input
              className={editorInput}
              value={ground.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </Labeled>
          <Labeled label="Region">
            <select
              className={editorInput}
              value={ground.locationId}
              onChange={(event) => {
                const location = props.locations.find(
                  (row) => row.id === Number(event.target.value),
                );
                if (location)
                  update({
                    locationId: location.id,
                    locationName: location.name,
                  });
              }}
            >
              {props.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Required Hunting level">
            <Num
              label="Required Hunting level"
              value={ground.requiredHuntingLevel}
              min={1}
              integer
              onChange={(requiredHuntingLevel) =>
                update({ requiredHuntingLevel })
              }
            />
          </Labeled>
          <Labeled label="Hidden until project stage">
            <SearchSelect
              className="h-8"
              options={props.stages}
              value={ground.requiredStageId}
              noneLabel="Always visible"
              onChange={(requiredStageId) => update({ requiredStageId })}
            />
          </Labeled>
          <Labeled label="List order" hint="Lower comes first in the region.">
            <Num
              label="List order"
              value={ground.sortOrder}
              integer
              onChange={(sortOrder) => update({ sortOrder })}
            />
          </Labeled>
          <Labeled label="Description" className="sm:col-span-2 lg:col-span-3">
            <input
              className={editorInput}
              value={ground.description ?? ""}
              placeholder="Shown to players when they pick a ground"
              onChange={(event) =>
                update({ description: event.target.value || null })
              }
            />
          </Labeled>
        </div>
      </Card>

      <Card
        title="Accidents"
        description="A mishap such as a fall or a thorn, rolled per encounter regardless of the animal."
      >
        <div className="flex flex-wrap gap-3">
          <Labeled label="Chance per encounter" className="w-36">
            <Percent
              label="Accident chance"
              value={ground.accidentChance}
              step={0.5}
              onChange={(accidentChance) => update({ accidentChance })}
            />
          </Labeled>
          <Labeled label="Damage" className="w-44">
            <RangeInputs
              label="Accident damage"
              min={ground.accidentDamageMin}
              max={ground.accidentDamageMax}
              onChange={({ min, max }) =>
                update({
                  accidentDamageMin: min ?? ground.accidentDamageMin,
                  accidentDamageMax: max ?? ground.accidentDamageMax,
                })
              }
            />
          </Labeled>
        </div>
      </Card>

      <Card
        title="Animals"
        description="Weights are relative: weight 2 is met twice as often as weight 1. The share column shows the resulting odds."
        className="overflow-x-auto"
      >
        <table className="w-full min-w-[620px] text-sm">
          <thead className={theadClass}>
            <tr>
              <th>Animal</th>
              <th className="w-24">Weight</th>
              <th className="w-40">Encounter share</th>
              <th className="w-12">On</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {ground.creatures.map((row) => {
              const animal = animalById.get(row.creatureId);
              const share = shares.get(row.creatureId) ?? 0;
              return (
                <tr
                  key={row.creatureId}
                  className={cn(
                    rowClass,
                    !shares.has(row.creatureId) && "text-white/40",
                  )}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <Art src={animal?.asset ?? ""} size={32} />
                      <div className="min-w-0">
                        <button
                          type="button"
                          className="truncate font-medium hover:underline disabled:no-underline"
                          disabled={!props.onOpenAnimal}
                          onClick={() => props.onOpenAnimal?.(row.creatureId)}
                        >
                          {animal?.name ?? `Animal #${row.creatureId}`}
                        </button>
                        <div className="text-[11px] text-white/40">
                          {animal
                            ? `${Math.round(animal.attackChance * 100)}% retaliation · ${animal.drops.length} drops${animal.enabled ? "" : " · animal disabled"}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Num
                      label={`${animal?.name} weight`}
                      value={row.encounterWeight}
                      min={0.001}
                      step={0.5}
                      onChange={(encounterWeight) =>
                        updateAssignment(row.creatureId, { encounterWeight })
                      }
                    />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-amber-400/70"
                          style={{ width: `${share * 100}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-white/60">
                        {(share * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <Toggle
                      label={`${animal?.name} on this ground`}
                      checked={row.enabled}
                      onChange={(enabled) =>
                        updateAssignment(row.creatureId, { enabled })
                      }
                    />
                  </td>
                  <td>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      aria-label={`Remove ${animal?.name}`}
                      onClick={() =>
                        update({
                          creatures: ground.creatures.filter(
                            (entry) => entry.creatureId !== row.creatureId,
                          ),
                        })
                      }
                    >
                      <X className="h-4 w-4 text-red-300" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {ground.creatures.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-white/45"
                >
                  No animals live here yet. Add one below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <SearchSelect
          className="max-w-xs"
          placeholder="+ Add an animal…"
          options={props.animals
            .filter((animal) => !assigned.has(animal.id))
            .map((animal) => ({
              id: animal.id,
              name: animal.name,
              image: animal.asset,
              detail: `${Math.round(animal.attackChance * 100)}%`,
            }))}
          value={null}
          onChange={(creatureId) => {
            if (creatureId === null) return;
            update({
              creatures: [
                ...ground.creatures,
                { creatureId, enabled: true, encounterWeight: 1 },
              ],
            });
          }}
        />
      </Card>
    </div>
  );
}

function SafetyView(props: {
  config: Config;
  update: (patch: Partial<Config>) => void;
}) {
  const { config, update } = props;
  const percent = (
    key: keyof Omit<Config, "damageEnabled">,
    label: string,
    hint: string,
  ) => (
    <Labeled label={label} hint={hint}>
      <Num
        label={label}
        value={config[key]}
        min={0}
        max={100}
        suffix="%"
        onChange={(value) => update({ [key]: value })}
      />
    </Labeled>
  );
  return (
    <Card
      title="Global danger guardrails"
      description="Hard limits above every animal, ground and duration. Lowering them protects hunts already underway; raising them only affects new departures."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Labeled
          label="Hunting damage"
          hint="Off means no hunt can hurt a character."
        >
          <label className="flex h-8 items-center gap-2 text-sm text-white/70">
            <Toggle
              label="Hunting damage"
              checked={config.damageEnabled}
              onChange={(damageEnabled) => update({ damageEnabled })}
            />
            {config.damageEnabled
              ? "Animals and accidents can hurt"
              : "Disabled"}
          </label>
        </Labeled>
        <Labeled
          label="Global danger ×"
          hint="Multiplies all hunting damage. 1 = as configured."
        >
          <Num
            label="Global danger multiplier"
            value={config.globalDangerMultiplier}
            min={0}
            max={10}
            step={0.05}
            onChange={(globalDangerMultiplier) =>
              update({ globalDangerMultiplier })
            }
          />
        </Labeled>
        {percent(
          "maxHealthLossPercent",
          "Max health lost per hunt",
          "Of maximum health, over the whole expedition.",
        )}
        {percent(
          "minimumRemainingHealthPercent",
          "Health floor",
          "A hunt never takes a character below this.",
        )}
        {percent(
          "minimumHealthToStartPercent",
          "Health needed to depart",
          "Must be at least the health floor.",
        )}
      </div>
    </Card>
  );
}

function HuntingSimulator(props: {
  config: Config;
  durations: Duration[];
  animals: AdminCreature[];
  grounds: Ground[];
  locations: LocationOption[];
  combatConfig: CombatConfig;
}) {
  const [groundId, setGroundId] = useSelection(
    props.grounds.map((row) => row.id),
  );
  const [durationId, setDurationId] = useSelection(
    props.durations.map((row) => row.id),
  );
  const [player, setPlayer] = useState({
    skillLevel: 25,
    luck: 10,
    efficiency: 10,
    armor: 20,
    evasion: 10,
    block: 5,
    resist: 0,
  });
  const [result, setResult] = useState<ReturnType<
    typeof runHuntingSimulation
  > | null>(null);

  const run = () => {
    const ground = props.grounds.find((row) => row.id === groundId);
    const duration = props.durations.find((row) => row.id === durationId);
    if (!ground || !duration) return;
    const animalById = new Map(
      props.animals.map((animal) => [animal.id, animal]),
    );
    const pool = ground.creatures.flatMap((assignment) => {
      const creature = animalById.get(assignment.creatureId);
      if (!creature || !assignment.enabled || !creature.enabled) return [];
      const drops = creature.drops
        .filter(
          (drop) => drop.enabled && drop.requiredLevel <= player.skillLevel,
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
        }));
      return drops.length
        ? [
            {
              creatureId: creature.id,
              name: creature.name,
              asset: creature.asset,
              encounterWeight: assignment.encounterWeight,
              ...toCreatureAttackProfile(creature),
              attackChance: creature.attackChance,
              drops,
            },
          ]
        : [];
    });
    setResult(
      runHuntingSimulation({
        pool,
        encounterRolls: duration.encounterRolls,
        quantityMultiplier: duration.quantityMultiplier,
        dangerMultiplier: duration.dangerMultiplier,
        globalDangerMultiplier: props.config.globalDangerMultiplier,
        damageEnabled: props.config.damageEnabled,
        maxHealthLossPercent: props.config.maxHealthLossPercent,
        accidentChance: ground.accidentChance,
        accidentDamageMin: ground.accidentDamageMin,
        accidentDamageMax: ground.accidentDamageMax,
        skillLevel: player.skillLevel,
        luck: player.luck,
        huntingEfficiency: player.efficiency,
        // Armor against the ground's location level, as on a real departure.
        rules: strikeRulesFor(
          props.locations.find((row) => row.id === ground.locationId)
            ?.requiredLevel ?? 1,
          props.combatConfig,
        ),
        defenses: {
          armor: player.armor,
          magicResist: player.resist,
          evasionMelee: player.evasion,
          evasionRanged: player.evasion,
          evasionMagic: player.evasion,
          blockChance: player.block,
          fireResist: player.resist,
          coldResist: player.resist,
          lightningResist: player.resist,
          poisonResist: player.resist,
          movementSpeed: 100,
          maxHealth: 100,
        },
        iterations: 2_000,
      }),
    );
  };

  const playerFields: Array<{
    key: keyof typeof player;
    label: string;
    min?: number;
    max?: number;
  }> = [
    { key: "skillLevel", label: "Hunting level", min: 1 },
    { key: "luck", label: "Luck" },
    { key: "efficiency", label: "Efficiency", min: 0 },
    { key: "armor", label: "Armor", min: 0 },
    { key: "evasion", label: "Evasion %", min: 0, max: 75 },
    { key: "block", label: "Block %", min: 0, max: 75 },
    { key: "resist", label: "Resist %", min: -100, max: 75 },
  ];

  return (
    <Card
      title="Rules simulator"
      description="Runs 2,000 expeditions through the resolver used when players claim, using your current edits, saved or not. The character has 100 health."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Labeled label="Ground" className="sm:col-span-2">
          <select
            className={editorInput}
            value={groundId ?? ""}
            onChange={(event) => setGroundId(Number(event.target.value))}
          >
            {props.grounds.map((ground) => (
              <option key={ground.id} value={ground.id}>
                {ground.locationName} · {ground.name}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Duration" className="sm:col-span-2">
          <select
            className={editorInput}
            value={durationId ?? ""}
            onChange={(event) => setDurationId(Number(event.target.value))}
          >
            {props.durations.map((duration) => (
              <option key={duration.id} value={duration.id}>
                {duration.label}
              </option>
            ))}
          </select>
        </Labeled>
        {playerFields.map((field) => (
          <Labeled key={field.key} label={field.label}>
            <Num
              label={field.label}
              value={player[field.key]}
              min={field.min}
              max={field.max}
              onChange={(value) =>
                setPlayer((current) => ({ ...current, [field.key]: value }))
              }
            />
          </Labeled>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        onClick={run}
        disabled={!groundId || !durationId}
      >
        <Activity className="h-4 w-4" />
        Run simulation
      </Button>
      {result ? (
        <StatTiles
          stats={[
            { label: "Items per hunt", value: result.averageItems.toFixed(2) },
            {
              label: "Hunts with an injury",
              value: `${(result.injuryRate * 100).toFixed(1)}%`,
            },
            {
              label: "Damage per hunt",
              value: result.averageDamage.toFixed(2),
            },
          ]}
        />
      ) : null}
    </Card>
  );
}

export function HuntingAdminClient(props: {
  config: Config;
  durations: Duration[];
  creatures: AdminCreature[];
  grounds: Ground[];
  locations: LocationOption[];
  items: AdminItemOption[];
  combatConfig: CombatConfig;
  stages: SearchOption[];
  /** Set on a region page: only that region's grounds, no global settings. */
  locationId?: number;
  initialTab?: string;
}) {
  const run = useServerAction();
  const [configRows] = useState(() => [{ id: 1, ...props.config }]);
  const config = useDraft(configRows, saveConfig);
  const durations = useDraft(props.durations, saveDuration);
  const animals = useDraft(props.creatures, saveCreature);
  const grounds = useDraft(props.grounds, saveGround);
  const [tab, selectTab] = useUrlTab(TABS, props.initialTab);
  const [groundId, setGroundId] = useSelection(
    grounds.rows.map((row) => row.id),
  );
  const [animalId, setAnimalId] = useSelection(
    animals.rows.map((row) => row.id),
  );
  const settings = config.rows[0]!;

  const problems = [
    ...grounds.rows
      .filter((ground) => ground.accidentDamageMax < ground.accidentDamageMin)
      .map((ground) => `${ground.name}: accident damage max below min`),
    ...grounds.rows
      .filter((ground) => !ground.name.trim())
      .map(() => "A hunting ground needs a name"),
    ...creatureProblems(animals.rows),
    ...(settings.minimumRemainingHealthPercent >
    settings.minimumHealthToStartPercent
      ? ["Health needed to depart must be at least the health floor"]
      : []),
  ];

  const createGround = async () => {
    const location =
      props.locations.find(
        (row) =>
          row.id ===
          (props.locationId ??
            grounds.rows.find((ground) => ground.id === groundId)?.locationId),
      ) ?? props.locations[0];
    if (!location) return;
    const result = await run(
      () =>
        adminRequest("/api/admin/hunting/grounds", "POST", {
          locationId: location.id,
          name: `New Hunting Ground ${grounds.rows.length + 1}`,
          description: null,
          requiredHuntingLevel: 1,
          enabled: false,
          sortOrder: 100,
          accidentChance: 0.03,
          accidentDamageMin: 1,
          accidentDamageMax: 3,
          creatures: [],
        }),
      `Hunting ground created in ${location.name} (hidden)`,
    );
    const created = result?.ground as { id?: number } | undefined;
    if (created?.id) setGroundId(created.id);
  };

  const ground = grounds.rows.find((row) => row.id === groundId);
  const groundsPane = (
    <div className={masterDetailClass}>
      <PickList
        placeholder="Find a ground…"
        selectedId={groundId}
        onSelect={setGroundId}
        items={grounds.rows.map((row) => ({
          id: row.id,
          name: row.name,
          detail: props.locationId
            ? `lv ${row.requiredHuntingLevel}`
            : `${row.locationName} · lv ${row.requiredHuntingLevel}`,
          muted: !row.enabled,
        }))}
        footer={
          <ListAction onClick={() => void createGround()}>
            New hunting ground
          </ListAction>
        }
      />
      {ground ? (
        <GroundView
          key={ground.id}
          ground={ground}
          animals={animals.rows}
          locations={props.locations}
          stages={props.stages}
          update={(patch) => grounds.update(ground.id, patch)}
          onOpenAnimal={
            props.locationId
              ? undefined
              : (id) => {
                  setAnimalId(id);
                  selectTab("animals");
                }
          }
        />
      ) : (
        <p className="text-sm text-white/55">
          No hunting grounds yet. Create one to get started.
        </p>
      )}
    </div>
  );

  if (props.locationId) {
    return (
      <div className="space-y-4">
        {groundsPane}
        <SaveBar drafts={[grounds]} problems={problems} />
      </div>
    );
  }

  const groundNames = (animal: AdminCreature) =>
    grounds.rows
      .filter((row) =>
        row.creatures.some((entry) => entry.creatureId === animal.id),
      )
      .map((row) => row.name);

  return (
    <div className="space-y-4">
      <EditorTabs
        tabs={[
          {
            key: "grounds",
            label: "Hunting grounds",
            count: grounds.rows.length,
          },
          { key: "animals", label: "Animals", count: animals.rows.length },
          { key: "durations", label: "Durations" },
          { key: "safety", label: "Safety rules" },
          { key: "simulator", label: "Simulator" },
        ]}
        active={tab}
        onSelect={selectTab}
      />

      {tab === "grounds" ? groundsPane : null}

      {tab === "animals" ? (
        <CreatureEditor
          kind="ANIMAL"
          draft={animals}
          items={props.items}
          selectedId={animalId}
          onSelect={setAnimalId}
          usage={(animal) => {
            const names = groundNames(animal);
            return names.length
              ? `Lives in ${names.join(", ")}`
              : "Not placed in any hunting ground yet";
          }}
        />
      ) : null}

      {tab === "durations" ? (
        <DurationTable
          draft={durations}
          endpoint="/api/admin/hunting/durations"
          description="Each encounter is a chance at materials and a chance of getting hurt; the danger multiplier scales the second."
          columns={[
            {
              key: "encounterRolls",
              label: "Encounters",
              min: 1,
              max: 100,
              integer: true,
            },
            {
              key: "quantityMultiplier",
              label: "Quantity ×",
              min: 0.1,
              max: 20,
              step: 0.05,
            },
            {
              key: "dangerMultiplier",
              label: "Danger ×",
              min: 0,
              max: 10,
              step: 0.05,
            },
            { key: "xpReward", label: "XP", min: 0, integer: true },
            {
              key: "requiredHuntingLevel",
              label: "Req. level",
              min: 1,
              max: 10_000,
              integer: true,
            },
          ]}
          newRow={(last) => ({
            label: `New hunt ${durations.rows.length + 1}`,
            durationSeconds: (last?.durationSeconds ?? 0) + 3_600,
            encounterRolls: Math.min(100, (last?.encounterRolls ?? 0) + 2),
            quantityMultiplier: last?.quantityMultiplier ?? 1,
            dangerMultiplier: last?.dangerMultiplier ?? 1,
            xpReward: last?.xpReward ?? 20,
            requiredHuntingLevel: last?.requiredHuntingLevel ?? 1,
            enabled: false,
            sortOrder: (last?.sortOrder ?? 0) + 10,
          })}
        />
      ) : null}

      {tab === "safety" ? (
        <SafetyView
          config={settings}
          update={(patch) => config.update(1, patch)}
        />
      ) : null}

      {tab === "simulator" ? (
        <HuntingSimulator
          config={settings}
          durations={durations.rows}
          animals={animals.rows}
          grounds={grounds.rows}
          locations={props.locations}
          combatConfig={props.combatConfig}
        />
      ) : null}

      <SaveBar
        drafts={[config, durations, animals, grounds]}
        problems={problems}
      />
    </div>
  );
}
