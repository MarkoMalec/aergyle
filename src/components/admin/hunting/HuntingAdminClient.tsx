"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CirclePlus,
  FlaskConical,
  Plus,
  Save,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import { toCreatureAttackProfile } from "~/server/creatures/attackProfile";
import { runHuntingSimulation } from "~/server/hunting/simulator";
import { Button } from "~/components/ui/button";
import {
  CreatureEditor,
  type AdminCreature,
  type AdminItemOption,
} from "~/components/admin/creatures/CreatureEditor";
import {
  inputClass,
  labelClass,
  NumberField,
  responseJson,
} from "~/components/admin/fields";

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
  accidentChance: number;
  accidentDamageMin: number;
  accidentDamageMax: number;
  creatures: Assignment[];
};

type LocationOption = { id: number; name: string };

function SafetySettings(props: {
  initial: Config;
  onChange: (config: Config) => void;
}) {
  const [config, setConfig] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setConfig(props.initial), [props.initial]);
  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/hunting/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const body = await responseJson(response);
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to save safety settings");
      props.onChange(config);
      toast.success("Hunting safety controls saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-gray-950/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-300" /> Global danger
            guardrails
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            These are hard safety controls above every animal, ground, and
            duration. Reductions protect active hunts immediately; increases
            apply only to new departures.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save guardrails"}
        </Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className={labelClass}>
          <span>Damage enabled</span>
          <select
            className={inputClass}
            value={config.damageEnabled ? "yes" : "no"}
            onChange={(event) =>
              setConfig((row) => ({
                ...row,
                damageEnabled: event.target.value === "yes",
              }))
            }
          >
            <option value="yes">Enabled</option>
            <option value="no">Disabled</option>
          </select>
        </label>
        <NumberField
          label="Global danger ×"
          value={config.globalDangerMultiplier}
          min={0}
          step={0.05}
          onChange={(value) =>
            setConfig((row) => ({ ...row, globalDangerMultiplier: value }))
          }
        />
        <NumberField
          label="Max health loss %"
          value={config.maxHealthLossPercent}
          min={0}
          max={100}
          onChange={(value) =>
            setConfig((row) => ({ ...row, maxHealthLossPercent: value }))
          }
        />
        <NumberField
          label="Health floor %"
          value={config.minimumRemainingHealthPercent}
          min={0}
          max={100}
          onChange={(value) =>
            setConfig((row) => ({
              ...row,
              minimumRemainingHealthPercent: value,
            }))
          }
        />
        <NumberField
          label="Minimum to start %"
          value={config.minimumHealthToStartPercent}
          min={0}
          max={100}
          onChange={(value) =>
            setConfig((row) => ({ ...row, minimumHealthToStartPercent: value }))
          }
        />
      </div>
    </section>
  );
}

function DurationEditor(props: {
  initial: Duration[];
  onChange: (durations: Duration[]) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(props.initial);
  const [savingId, setSavingId] = useState<number | null>(null);
  useEffect(() => setRows(props.initial), [props.initial]);
  const update = (id: number, patch: Partial<Duration>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };
  const save = async (row: Duration) => {
    setSavingId(row.id);
    try {
      const response = await fetch(`/api/admin/hunting/durations/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const body = await responseJson(response);
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to save duration");
      props.onChange(rows);
      toast.success(`${row.label} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSavingId(null);
    }
  };
  const add = async () => {
    const last = rows.at(-1);
    const draft = {
      label: `New hunt ${rows.length + 1}`,
      durationSeconds: (last?.durationSeconds ?? 0) + 3_600,
      encounterRolls: (last?.encounterRolls ?? 0) + 2,
      quantityMultiplier: last?.quantityMultiplier ?? 1,
      dangerMultiplier: last?.dangerMultiplier ?? 1,
      xpReward: last?.xpReward ?? 20,
      requiredHuntingLevel: last?.requiredHuntingLevel ?? 1,
      enabled: false,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    };
    const response = await fetch("/api/admin/hunting/durations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = await responseJson(response);
    if (!response.ok)
      return toast.error(body?.error ?? "Unable to add duration");
    toast.success("Duration created");
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-white/10 bg-gray-950/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Expedition durations</h2>
          <p className="mt-1 text-sm text-white/55">
            Encounter rolls scale both material opportunity and exposure to
            danger.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void add()}>
          <Plus className="mr-2 h-4 w-4" />
          Add duration
        </Button>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div
            className="grid gap-3 rounded-lg border border-white/10 p-3 md:grid-cols-4 xl:grid-cols-10"
            key={row.id}
          >
            <label className={labelClass}>
              <span>Label</span>
              <input
                className={inputClass}
                value={row.label}
                onChange={(event) =>
                  update(row.id, { label: event.target.value })
                }
              />
            </label>
            <NumberField
              label="Seconds"
              value={row.durationSeconds}
              min={60}
              onChange={(value) => update(row.id, { durationSeconds: value })}
            />
            <NumberField
              label="Encounters"
              value={row.encounterRolls}
              min={1}
              onChange={(value) => update(row.id, { encounterRolls: value })}
            />
            <NumberField
              label="Quantity ×"
              value={row.quantityMultiplier}
              min={0.1}
              step={0.05}
              onChange={(value) =>
                update(row.id, { quantityMultiplier: value })
              }
            />
            <NumberField
              label="Danger ×"
              value={row.dangerMultiplier}
              min={0}
              step={0.05}
              onChange={(value) => update(row.id, { dangerMultiplier: value })}
            />
            <NumberField
              label="XP"
              value={row.xpReward}
              min={0}
              onChange={(value) => update(row.id, { xpReward: value })}
            />
            <NumberField
              label="Hunting level"
              value={row.requiredHuntingLevel}
              min={1}
              onChange={(value) =>
                update(row.id, { requiredHuntingLevel: value })
              }
            />
            <NumberField
              label="Sort order"
              value={row.sortOrder}
              onChange={(value) => update(row.id, { sortOrder: value })}
            />
            <label className={labelClass}>
              <span>Status</span>
              <select
                className={inputClass}
                value={row.enabled ? "yes" : "no"}
                onChange={(event) =>
                  update(row.id, { enabled: event.target.value === "yes" })
                }
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => void save(row)}
                disabled={savingId === row.id}
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GroundEditor(props: {
  initial: Ground[];
  creatures: AdminCreature[];
  locations: LocationOption[];
  onChange: (grounds: Ground[]) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(props.initial);
  const [savingId, setSavingId] = useState<number | null>(null);
  useEffect(() => setRows(props.initial), [props.initial]);
  const update = (id: number, patch: Partial<Ground>) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const assignment = (ground: Ground, creatureId: number) =>
    ground.creatures.find((row) => row.creatureId === creatureId);
  const toggle = (ground: Ground, creatureId: number, enabled: boolean) => {
    update(ground.id, {
      creatures: enabled
        ? [
            ...ground.creatures.filter((row) => row.creatureId !== creatureId),
            { creatureId, enabled: true, encounterWeight: 1 },
          ]
        : ground.creatures.filter((row) => row.creatureId !== creatureId),
    });
  };
  const weight = (ground: Ground, creatureId: number, value: number) =>
    update(ground.id, {
      creatures: ground.creatures.map((row) =>
        row.creatureId === creatureId
          ? { ...row, encounterWeight: value }
          : row,
      ),
    });
  const save = async (ground: Ground) => {
    setSavingId(ground.id);
    const payload = {
      locationId: ground.locationId,
      name: ground.name,
      description: ground.description,
      requiredHuntingLevel: ground.requiredHuntingLevel,
      enabled: ground.enabled,
      sortOrder: ground.sortOrder,
      accidentChance: ground.accidentChance,
      accidentDamageMin: ground.accidentDamageMin,
      accidentDamageMax: ground.accidentDamageMax,
      creatures: ground.creatures,
    };
    try {
      const response = await fetch(`/api/admin/hunting/grounds/${ground.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await responseJson(response);
      if (!response.ok) throw new Error(body?.error ?? "Unable to save ground");
      props.onChange(rows);
      toast.success(`${ground.name} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSavingId(null);
    }
  };
  const create = async () => {
    const location = props.locations[0];
    if (!location) return toast.error("Create a world location first");
    const response = await fetch("/api/admin/hunting/grounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: location.id,
        name: `New Hunting Ground ${rows.length + 1}`,
        description: null,
        requiredHuntingLevel: 1,
        enabled: false,
        sortOrder: 100,
        accidentChance: 0.03,
        accidentDamageMin: 1,
        accidentDamageMax: 3,
        creatures: [],
      }),
    });
    const body = await responseJson(response);
    if (!response.ok)
      return toast.error(body?.error ?? "Unable to create ground");
    toast.success("Hunting ground created");
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-white/10 bg-gray-950/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Location hunting grounds</h2>
          <p className="mt-1 text-sm text-white/55">
            Players choose one sub-location. Encounter weights are relative, not
            percentages.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void create()}>
          <CirclePlus className="mr-2 h-4 w-4" />
          New ground
        </Button>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((ground) => (
          <details
            className="rounded-xl border border-white/10 bg-black/15"
            key={ground.id}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <strong className="block truncate">
                  {ground.locationName} · {ground.name}
                </strong>
                <small className="text-white/45">
                  Hunting {ground.requiredHuntingLevel} ·{" "}
                  {ground.creatures.length} animals ·{" "}
                  {Math.round(ground.accidentChance * 100)}% accident chance
                </small>
              </span>
              <span
                className={
                  ground.enabled
                    ? "text-xs text-emerald-300"
                    : "text-xs text-white/35"
                }
              >
                {ground.enabled ? "Enabled" : "Disabled"}
              </span>
            </summary>
            <div className="space-y-5 border-t border-white/10 p-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className={labelClass}>
                  <span>World location</span>
                  <select
                    className={inputClass}
                    value={ground.locationId}
                    onChange={(event) => {
                      const locationId = Number(event.target.value);
                      update(ground.id, {
                        locationId,
                        locationName:
                          props.locations.find((row) => row.id === locationId)
                            ?.name ?? ground.locationName,
                      });
                    }}
                  >
                    {props.locations.map((location) => (
                      <option value={location.id} key={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span>Ground name</span>
                  <input
                    className={inputClass}
                    value={ground.name}
                    onChange={(event) =>
                      update(ground.id, { name: event.target.value })
                    }
                  />
                </label>
                <NumberField
                  label="Required Hunting level"
                  value={ground.requiredHuntingLevel}
                  min={1}
                  onChange={(value) =>
                    update(ground.id, { requiredHuntingLevel: value })
                  }
                />
                <label className={labelClass}>
                  <span>Status</span>
                  <select
                    className={inputClass}
                    value={ground.enabled ? "yes" : "no"}
                    onChange={(event) =>
                      update(ground.id, {
                        enabled: event.target.value === "yes",
                      })
                    }
                  >
                    <option value="yes">Enabled</option>
                    <option value="no">Disabled</option>
                  </select>
                </label>
                <NumberField
                  label="Accident chance (0–1)"
                  value={ground.accidentChance}
                  min={0}
                  max={1}
                  step={0.005}
                  onChange={(value) =>
                    update(ground.id, { accidentChance: value })
                  }
                />
                <NumberField
                  label="Accident damage min"
                  value={ground.accidentDamageMin}
                  min={0}
                  onChange={(value) =>
                    update(ground.id, { accidentDamageMin: value })
                  }
                />
                <NumberField
                  label="Accident damage max"
                  value={ground.accidentDamageMax}
                  min={0}
                  onChange={(value) =>
                    update(ground.id, { accidentDamageMax: value })
                  }
                />
                <NumberField
                  label="Sort order"
                  value={ground.sortOrder}
                  onChange={(value) => update(ground.id, { sortOrder: value })}
                />
                <label className={`${labelClass} md:col-span-2 lg:col-span-4`}>
                  <span>Description</span>
                  <input
                    className={inputClass}
                    value={ground.description ?? ""}
                    onChange={(event) =>
                      update(ground.id, {
                        description: event.target.value || null,
                      })
                    }
                  />
                </label>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                  Available animals and encounter weights
                </p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {props.creatures.map((creature) => {
                    const row = assignment(ground, creature.id);
                    return (
                      <div
                        className="flex items-center gap-3 rounded-lg border border-white/10 p-2"
                        key={creature.id}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(row)}
                          onChange={(event) =>
                            toggle(ground, creature.id, event.target.checked)
                          }
                        />
                        <Image
                          src={creature.asset}
                          alt=""
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-md bg-black/25 object-contain"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {creature.name}
                        </span>
                        <input
                          aria-label={`${creature.name} encounter weight`}
                          className="w-20 rounded border border-white/10 bg-black/25 px-2 py-1 text-sm"
                          type="number"
                          min={0.001}
                          step={0.1}
                          disabled={!row}
                          value={row?.encounterWeight ?? 1}
                          onChange={(event) =>
                            weight(
                              ground,
                              creature.id,
                              Number(event.target.value),
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => void save(ground)}
                  disabled={savingId === ground.id}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {savingId === ground.id ? "Saving…" : "Save ground"}
                </Button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function HuntingSimulator(props: {
  config: Config;
  durations: Duration[];
  creatures: AdminCreature[];
  grounds: Ground[];
}) {
  const [groundId, setGroundId] = useState(props.grounds[0]?.id ?? 0);
  const [durationId, setDurationId] = useState(props.durations[0]?.id ?? 0);
  const [skillLevel, setSkillLevel] = useState(25);
  const [luck, setLuck] = useState(10);
  const [efficiency, setEfficiency] = useState(10);
  const [armor, setArmor] = useState(20);
  const [evasion, setEvasion] = useState(10);
  const [block, setBlock] = useState(5);
  const [resist, setResist] = useState(0);
  const [result, setResult] = useState<ReturnType<
    typeof runHuntingSimulation
  > | null>(null);
  const creatureById = useMemo(
    () => new Map(props.creatures.map((creature) => [creature.id, creature])),
    [props.creatures],
  );
  useEffect(() => {
    if (!props.grounds.some((ground) => ground.id === groundId)) {
      setGroundId(props.grounds[0]?.id ?? 0);
    }
  }, [groundId, props.grounds]);
  useEffect(() => {
    if (!props.durations.some((duration) => duration.id === durationId)) {
      setDurationId(props.durations[0]?.id ?? 0);
    }
  }, [durationId, props.durations]);
  const run = () => {
    const ground = props.grounds.find((row) => row.id === groundId);
    const duration = props.durations.find((row) => row.id === durationId);
    if (!ground || !duration) return;
    const pool = ground.creatures.flatMap((assignment) => {
      const creature = creatureById.get(assignment.creatureId);
      if (!creature || !assignment.enabled || !creature.enabled) return [];
      const drops = creature.drops
        .filter((drop) => drop.enabled && drop.requiredLevel <= skillLevel)
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
        skillLevel,
        luck,
        huntingEfficiency: efficiency,
        defenses: {
          armor,
          magicResist: armor,
          evasionMelee: evasion,
          evasionRanged: evasion,
          evasionMagic: evasion,
          blockChance: block,
          fireResist: resist,
          coldResist: resist,
          lightningResist: resist,
          poisonResist: resist,
          movementSpeed: 100,
          maxHealth: 100,
        },
        iterations: 2_000,
      }),
    );
  };
  return (
    <section className="rounded-xl border border-white/10 bg-gray-950/45 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <FlaskConical className="h-4 w-4 text-amber-300" /> Live rules
          simulator
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Runs 2,000 expeditions through the same resolver used when players
          claim.
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-9">
        <label className={labelClass}>
          <span>Ground</span>
          <select
            className={inputClass}
            value={groundId}
            onChange={(event) => setGroundId(Number(event.target.value))}
          >
            {props.grounds.map((ground) => (
              <option key={ground.id} value={ground.id}>
                {ground.locationName} · {ground.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          <span>Duration</span>
          <select
            className={inputClass}
            value={durationId}
            onChange={(event) => setDurationId(Number(event.target.value))}
          >
            {props.durations.map((duration) => (
              <option key={duration.id} value={duration.id}>
                {duration.label}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          label="Skill"
          value={skillLevel}
          min={1}
          onChange={setSkillLevel}
        />
        <NumberField label="Luck" value={luck} onChange={setLuck} />
        <NumberField
          label="Efficiency"
          value={efficiency}
          min={0}
          onChange={setEfficiency}
        />
        <NumberField label="Armor" value={armor} min={0} onChange={setArmor} />
        <NumberField
          label="Evasion"
          value={evasion}
          min={0}
          max={75}
          onChange={setEvasion}
        />
        <NumberField
          label="Block"
          value={block}
          min={0}
          max={75}
          onChange={setBlock}
        />
        <NumberField
          label="Elemental resist"
          value={resist}
          min={-100}
          max={75}
          onChange={setResist}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button onClick={run}>
          <Activity className="mr-2 h-4 w-4" />
          Run simulation
        </Button>
        {result ? (
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-md bg-white/5 px-3 py-2">
              Avg items <strong>{result.averageItems.toFixed(2)}</strong>
            </span>
            <span className="rounded-md bg-white/5 px-3 py-2">
              Injury rate{" "}
              <strong>{(result.injuryRate * 100).toFixed(1)}%</strong>
            </span>
            <span className="rounded-md bg-white/5 px-3 py-2">
              Avg damage <strong>{result.averageDamage.toFixed(2)}</strong>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function HuntingAdminClient(props: {
  config: Config;
  durations: Duration[];
  creatures: AdminCreature[];
  grounds: Ground[];
  locations: LocationOption[];
  items: AdminItemOption[];
}) {
  const [config, setConfig] = useState(props.config);
  const [durations, setDurations] = useState(props.durations);
  const [creatures, setCreatures] = useState(props.creatures);
  const [grounds, setGrounds] = useState(props.grounds);
  useEffect(() => setConfig(props.config), [props.config]);
  useEffect(() => setDurations(props.durations), [props.durations]);
  useEffect(() => setCreatures(props.creatures), [props.creatures]);
  useEffect(() => setGrounds(props.grounds), [props.grounds]);
  return (
    <div className="space-y-8">
      <SafetySettings initial={config} onChange={setConfig} />
      <HuntingSimulator
        config={config}
        durations={durations}
        creatures={creatures}
        grounds={grounds}
      />
      <DurationEditor initial={durations} onChange={setDurations} />
      <GroundEditor
        initial={grounds}
        creatures={creatures}
        locations={props.locations}
        onChange={setGrounds}
      />
      <CreatureEditor
        kind="ANIMAL"
        initial={creatures}
        items={props.items}
        onChange={setCreatures}
      />
    </div>
  );
}
