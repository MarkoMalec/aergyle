"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import toast from "react-hot-toast";
import { Clock3, Leaf, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { GatheringSimulator } from "./GatheringSimulator";

export type GatheringAdminResource = {
  id: number;
  name: string;
  itemId: number;
  requiredSkillLevel: number;
  rarity: string;
  item: { name: string; sprite: string };
};

export type GatheringLocationPool = {
  resourceId: number;
  enabled: boolean;
  baseChance: number;
  minQuantity: number;
  maxQuantity: number;
};

export type GatheringAdminLocation = {
  id: number;
  name: string;
  requiredLevel: number;
  gatheringEnabled: boolean;
  gatheringRequiredLevel: number;
  resources: GatheringLocationPool[];
};

export type GatheringAdminDuration = {
  id: number;
  label: string;
  durationSeconds: number;
  rewardRolls: number;
  quantityMultiplier: number;
  xpReward: number;
  requiredGatheringLevel: number;
  enabled: boolean;
  sortOrder: number;
};

export type RarityOption = {
  value: string;
  label: string;
  color: string;
};

const inputClass =
  "h-9 w-full rounded-md border border-white/10 bg-black/20 px-2 text-sm text-white outline-none transition focus:border-amber-400/50";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function responseJson(response: Response) {
  return (await response.json().catch(() => null)) as null | {
    error?: string;
    duration?: GatheringAdminDuration;
  };
}

function ResourceCatalogue(props: {
  initialResources: GatheringAdminResource[];
  rarities: RarityOption[];
}) {
  const [resources, setResources] = React.useState(props.initialResources);
  const [savingId, setSavingId] = React.useState<number | null>(null);

  const update = (
    resourceId: number,
    patch: Partial<GatheringAdminResource>,
  ) => {
    setResources((current) =>
      current.map((resource) =>
        resource.id === resourceId ? { ...resource, ...patch } : resource,
      ),
    );
  };

  const save = async (resource: GatheringAdminResource) => {
    setSavingId(resource.id);
    try {
      const response = await fetch(
        `/api/admin/gathering/resources/${resource.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requiredSkillLevel: resource.requiredSkillLevel,
            rarity: resource.rarity,
          }),
        },
      );
      const body = await responseJson(response);
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to save resource");
      toast.success(`${resource.name} saved`);
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save resource"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-gray-800/60 bg-gray-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Leaf className="h-4 w-4 text-emerald-300" />
            Gathering resource catalogue
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Reward rarity controls field-guide ordering and granted stacks.
            Resource level applies in every location that contains it.
          </p>
        </div>
        <Link
          href="/admin/vocations/new"
          className="rounded-md bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700"
        >
          New Gathering resource
        </Link>
      </div>

      {resources.length === 0 ? (
        <div className="p-6 text-sm text-white/60">
          No Gathering resources exist yet. Seed the starter content or create
          one from Vocation resources.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-black/20 text-left text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="p-3">Resource</th>
                <th className="p-3">Reward rarity</th>
                <th className="p-3">Required Gathering level</th>
                <th className="p-3 text-right">Item</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => {
                const rarity = props.rarities.find(
                  (option) => option.value === resource.rarity,
                );
                return (
                  <tr key={resource.id} className="border-t border-white/10">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Image
                          src={resource.item.sprite}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-md bg-black/20 object-contain"
                        />
                        <div>
                          <Link
                            href={`/admin/vocations/${resource.id}`}
                            className="font-semibold text-white hover:underline"
                          >
                            {resource.name}
                          </Link>
                          <div className="text-xs text-white/45">
                            Resource #{resource.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <select
                        aria-label={`${resource.name} rarity`}
                        className={inputClass}
                        value={resource.rarity}
                        style={{ color: rarity?.color }}
                        onChange={(event) =>
                          update(resource.id, { rarity: event.target.value })
                        }
                      >
                        {props.rarities.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        aria-label={`${resource.name} required level`}
                        className={`${inputClass} max-w-40`}
                        type="number"
                        min={1}
                        value={resource.requiredSkillLevel}
                        onChange={(event) =>
                          update(resource.id, {
                            requiredSkillLevel: Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/admin/items/${resource.itemId}`}
                        className="text-white/70 hover:text-white hover:underline"
                      >
                        {resource.item.name} #{resource.itemId}
                      </Link>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void save(resource)}
                        disabled={savingId === resource.id}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {savingId === resource.id ? "Saving…" : "Save"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LocationCard(props: {
  initialLocation: GatheringAdminLocation;
  resources: GatheringAdminResource[];
}) {
  const [location, setLocation] = React.useState(props.initialLocation);
  const [saving, setSaving] = React.useState(false);

  const updatePool = (
    resourceId: number,
    patch: Partial<GatheringLocationPool>,
  ) => {
    setLocation((current) => ({
      ...current,
      resources: current.resources.map((resource) =>
        resource.resourceId === resourceId
          ? { ...resource, ...patch }
          : resource,
      ),
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/admin/gathering/locations/${location.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gatheringEnabled: location.gatheringEnabled,
            gatheringRequiredLevel: location.gatheringRequiredLevel,
            resources: location.resources,
          }),
        },
      );
      const body = await responseJson(response);
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to save location");
      toast.success(`${location.name} Gathering pool saved`);
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save location"));
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = location.resources.filter(
    (resource) => resource.enabled,
  ).length;

  return (
    <details
      className="overflow-hidden rounded-lg border border-gray-800/60 bg-gray-900/40"
      open={location.gatheringEnabled}
    >
      <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md border border-white/10 bg-black/20 p-2">
              <MapPin className="h-5 w-5 text-amber-300" />
            </span>
            <div>
              <h3 className="font-semibold text-white">{location.name}</h3>
              <p className="text-xs text-white/50">
                Character level {location.requiredLevel} · {enabledCount} of{" "}
                {props.resources.length} resources available
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              location.gatheringEnabled
                ? "bg-emerald-400/15 text-emerald-200"
                : "bg-white/5 text-white/50"
            }`}
          >
            {location.gatheringEnabled ? "Gathering enabled" : "Disabled"}
          </span>
        </div>
      </summary>

      <div className="border-t border-white/10 p-4">
        <div className="mb-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="flex min-h-11 items-center gap-3 rounded-md border border-white/10 bg-black/15 px-3 text-sm">
            <input
              type="checkbox"
              checked={location.gatheringEnabled}
              onChange={(event) =>
                setLocation((current) => ({
                  ...current,
                  gatheringEnabled: event.target.checked,
                }))
              }
            />
            Available for Gathering expeditions
          </label>
          <label className="space-y-1 text-xs text-white/60">
            Required Gathering level
            <input
              className={inputClass}
              type="number"
              min={1}
              value={location.gatheringRequiredLevel}
              onChange={(event) =>
                setLocation((current) => ({
                  ...current,
                  gatheringRequiredLevel: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>

        {props.resources.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/10 p-4 text-sm text-white/55">
            Create at least one Gathering resource before configuring this pool.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-white/10">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-black/20 text-left text-xs uppercase tracking-wide text-white/45">
                <tr>
                  <th className="p-3">Available</th>
                  <th className="p-3">Resource</th>
                  <th className="p-3">Base find chance</th>
                  <th className="p-3">Minimum</th>
                  <th className="p-3">Maximum</th>
                </tr>
              </thead>
              <tbody>
                {props.resources.map((resource) => {
                  const pool = location.resources.find(
                    (row) => row.resourceId === resource.id,
                  );
                  if (!pool) return null;
                  return (
                    <tr key={resource.id} className="border-t border-white/10">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`${resource.name} availability at ${location.name}`}
                          checked={pool.enabled}
                          onChange={(event) =>
                            updatePool(resource.id, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Image
                            src={resource.item.sprite}
                            alt=""
                            width={30}
                            height={30}
                            className="h-8 w-8 object-contain"
                          />
                          <div>
                            <div className="font-medium text-white/90">
                              {resource.name}
                            </div>
                            <div className="text-xs text-white/45">
                              {resource.rarity
                                .toLowerCase()
                                .replaceAll("_", " ")}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex max-w-32 items-center gap-2">
                          <input
                            className={inputClass}
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={Math.round(pool.baseChance * 1000) / 10}
                            onChange={(event) =>
                              updatePool(resource.id, {
                                baseChance: Number(event.target.value) / 100,
                              })
                            }
                          />
                          <span className="text-white/45">%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <input
                          className={`${inputClass} max-w-28`}
                          type="number"
                          min={1}
                          value={pool.minQuantity}
                          onChange={(event) =>
                            updatePool(resource.id, {
                              minQuantity: Number(event.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="p-3">
                        <input
                          className={`${inputClass} max-w-28`}
                          type="number"
                          min={1}
                          value={pool.maxQuantity}
                          onChange={(event) =>
                            updatePool(resource.id, {
                              maxQuantity: Number(event.target.value),
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
        )}

        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save location pool"}
          </Button>
        </div>
      </div>
    </details>
  );
}

function DurationEditor(props: { initialDurations: GatheringAdminDuration[] }) {
  const router = useRouter();
  const [durations, setDurations] = React.useState(props.initialDurations);
  const [savingId, setSavingId] = React.useState<number | "new" | null>(null);
  const [draft, setDraft] = React.useState<Omit<GatheringAdminDuration, "id">>({
    label: "",
    durationSeconds: 3_600,
    rewardRolls: 3,
    quantityMultiplier: 1,
    xpReward: 0,
    requiredGatheringLevel: 0,
    enabled: true,
    sortOrder: (props.initialDurations.length + 1) * 10,
  });

  const update = (id: number, patch: Partial<GatheringAdminDuration>) => {
    setDurations((current) =>
      current.map((duration) =>
        duration.id === id ? { ...duration, ...patch } : duration,
      ),
    );
  };

  const save = async (duration: GatheringAdminDuration) => {
    setSavingId(duration.id);
    try {
      const response = await fetch(
        `/api/admin/gathering/durations/${duration.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(duration),
        },
      );
      const body = await responseJson(response);
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to save duration");
      toast.success(`${duration.label} saved`);
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save duration"));
    } finally {
      setSavingId(null);
    }
  };

  const create = async () => {
    setSavingId("new");
    try {
      const response = await fetch("/api/admin/gathering/durations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await responseJson(response);
      if (!response.ok || !body?.duration) {
        throw new Error(body?.error ?? "Unable to create duration");
      }
      setDurations((current) => [...current, body.duration!]);
      setDraft((current) => ({
        ...current,
        label: "",
        sortOrder: current.sortOrder + 10,
      }));
      toast.success("Expedition duration added");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Unable to create duration"));
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (duration: GatheringAdminDuration) => {
    if (!confirm(`Delete the ${duration.label} expedition duration?`)) return;
    setSavingId(duration.id);
    try {
      const response = await fetch(
        `/api/admin/gathering/durations/${duration.id}`,
        { method: "DELETE" },
      );
      const body = await responseJson(response);
      if (!response.ok)
        throw new Error(body?.error ?? "Unable to delete duration");
      setDurations((current) =>
        current.filter((entry) => entry.id !== duration.id),
      );
      toast.success("Expedition duration deleted");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "Unable to delete duration"));
    } finally {
      setSavingId(null);
    }
  };

  const fields = (
    duration: Omit<GatheringAdminDuration, "id">,
    onChange: (patch: Partial<GatheringAdminDuration>) => void,
  ) => (
    <>
      <td className="p-2">
        <input
          className={inputClass}
          value={duration.label}
          placeholder="e.g. 2 hours"
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </td>
      <td className="p-2">
        <input
          aria-label="Duration in hours"
          className={inputClass}
          type="number"
          min={1 / 60}
          max={168}
          step={0.25}
          value={duration.durationSeconds / 3_600}
          onChange={(event) =>
            onChange({
              durationSeconds: Math.round(Number(event.target.value) * 3_600),
            })
          }
        />
      </td>
      <td className="p-2">
        <input
          className={inputClass}
          type="number"
          min={1}
          max={100}
          value={duration.rewardRolls}
          onChange={(event) =>
            onChange({ rewardRolls: Number(event.target.value) })
          }
        />
      </td>
      <td className="p-2">
        <input
          className={inputClass}
          type="number"
          min={0.1}
          max={20}
          step={0.05}
          value={duration.quantityMultiplier}
          onChange={(event) =>
            onChange({ quantityMultiplier: Number(event.target.value) })
          }
        />
      </td>
      <td className="p-2">
        <input
          className={inputClass}
          type="number"
          min={0}
          value={duration.xpReward}
          onChange={(event) =>
            onChange({ xpReward: Number(event.target.value) })
          }
        />
      </td>
      <td className="p-2">
        <input
          aria-label="Required Gathering level"
          className={inputClass}
          type="number"
          min={0}
          max={10_000}
          value={duration.requiredGatheringLevel}
          onChange={(event) =>
            onChange({
              requiredGatheringLevel: Number(event.target.value),
            })
          }
        />
      </td>
      <td className="p-2">
        <input
          className={inputClass}
          type="number"
          value={duration.sortOrder}
          onChange={(event) =>
            onChange({ sortOrder: Number(event.target.value) })
          }
        />
      </td>
      <td className="p-2 text-center">
        <input
          type="checkbox"
          checked={duration.enabled}
          onChange={(event) => onChange({ enabled: event.target.checked })}
        />
      </td>
    </>
  );

  return (
    <section className="overflow-hidden rounded-lg border border-gray-800/60 bg-gray-900/40">
      <div className="border-b border-white/10 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="h-4 w-4 text-sky-300" />
          Expedition durations
        </h2>
        <p className="mt-1 text-sm text-white/60">
          More rolls increase the number of find attempts; the quantity
          multiplier scales the amount found on successful attempts.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] text-sm">
          <thead className="bg-black/20 text-left text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="p-2">Label</th>
              <th className="p-2">Hours</th>
              <th className="p-2">Find rolls</th>
              <th className="p-2">Quantity ×</th>
              <th className="p-2">XP</th>
              <th className="p-2">Required level</th>
              <th className="p-2">Order</th>
              <th className="p-2 text-center">Enabled</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {durations.map((duration) => (
              <tr key={duration.id} className="border-t border-white/10">
                {fields(duration, (patch) => update(duration.id, patch))}
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void save(duration)}
                      disabled={savingId === duration.id}
                    >
                      <Save className="h-4 w-4" />
                      <span className="sr-only">Save {duration.label}</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void remove(duration)}
                      disabled={savingId === duration.id}
                    >
                      <Trash2 className="h-4 w-4 text-red-300" />
                      <span className="sr-only">Delete {duration.label}</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="border-t border-dashed border-white/15 bg-white/[0.02]">
              {fields(draft, (patch) =>
                setDraft((current) => ({ ...current, ...patch })),
              )}
              <td className="p-2 text-right">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void create()}
                  disabled={
                    savingId === "new" || draft.label.trim().length === 0
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function GatheringAdminClient(props: {
  locations: GatheringAdminLocation[];
  resources: GatheringAdminResource[];
  durations: GatheringAdminDuration[];
  rarities: RarityOption[];
}) {
  return (
    <div className="space-y-6">
      <GatheringSimulator
        locations={props.locations}
        resources={props.resources}
        durations={props.durations}
        rarities={props.rarities}
      />

      <ResourceCatalogue
        initialResources={props.resources}
        rarities={props.rarities}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Location resource pools</h2>
          <p className="mt-1 text-sm text-white/60">
            Find chance and quantity bounds are specific to each existing world
            location. Disabled resources never appear in the expedition pool.
          </p>
        </div>
        {props.locations.map((location) => (
          <LocationCard
            key={location.id}
            initialLocation={location}
            resources={props.resources}
          />
        ))}
      </section>

      <DurationEditor initialDurations={props.durations} />
    </div>
  );
}
