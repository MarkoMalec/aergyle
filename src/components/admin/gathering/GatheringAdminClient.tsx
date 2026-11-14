"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import toast from "react-hot-toast";
import { Copy, Plus, Save, Search, Trash2, Undo2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  adminRequest,
  NumberInput,
  responseJson,
} from "~/components/admin/fields";
import { useLeaveGuard } from "~/components/admin/leaveGuard";
import { SearchSelect } from "~/components/admin/SearchSelect";
import { cn } from "~/lib/utils";
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

type DropValues = Pick<
  GatheringLocationPool,
  "baseChance" | "minQuantity" | "maxQuantity"
>;

const GATHERING_TABS = [
  { key: "resources", label: "By resource" },
  { key: "locations", label: "By location" },
  { key: "durations", label: "Durations" },
  { key: "simulator", label: "Simulator" },
] as const;
type GatheringTab = (typeof GATHERING_TABS)[number]["key"];

const inputClass =
  "h-8 w-full rounded-[8px] bg-white/[0.06] px-2 text-sm tabular-nums text-white outline-none transition focus:bg-white/[0.1] focus:ring-1 focus:ring-amber-400/50";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A compact number box; an emptied field keeps the last valid value. */
function Num(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative block", props.className)}>
      <NumberInput
        aria-label={props.label}
        className={cn(
          inputClass,
          props.suffix && "pr-6",
          props.invalid && "bg-red-500/20 ring-1 ring-red-400/60",
        )}
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        onValueChange={(value) => {
          if (value !== null) props.onChange(value);
        }}
      />
      {props.suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-white/40">
          {props.suffix}
        </span>
      ) : null}
    </span>
  );
}

function Toggle(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      title={props.label}
      onClick={() => props.onChange(!props.checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60",
        props.checked ? "bg-emerald-500/70" : "bg-white/10",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
          props.checked ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  );
}

/** Chance, minimum and maximum inputs for one drop, as three elements. */
function dropInputs(
  label: string,
  value: DropValues,
  onChange: (patch: Partial<DropValues>) => void,
) {
  const invalid = value.maxQuantity < value.minQuantity;
  return [
    <Num
      key="chance"
      label={`${label} find chance`}
      value={Number((value.baseChance * 100).toFixed(2))}
      min={0}
      max={100}
      step={0.5}
      suffix="%"
      onChange={(next) =>
        onChange({ baseChance: Math.min(100, Math.max(0, next)) / 100 })
      }
    />,
    <Num
      key="min"
      label={`${label} minimum quantity`}
      value={value.minQuantity}
      min={1}
      invalid={invalid}
      onChange={(next) => onChange({ minQuantity: Math.max(1, Math.round(next)) })}
    />,
    <Num
      key="max"
      label={`${label} maximum quantity`}
      value={value.maxQuantity}
      min={1}
      invalid={invalid}
      onChange={(next) => onChange({ maxQuantity: Math.max(1, Math.round(next)) })}
    />,
  ];
}

function DropCells(props: {
  label: string;
  pool: DropValues;
  onChange: (patch: Partial<DropValues>) => void;
}) {
  return dropInputs(props.label, props.pool, props.onChange).map((input) => (
    <td key={input.key} className="px-2 py-1.5">
      {input}
    </td>
  ));
}

/** Searchable master list for the left column. */
function PickList(props: {
  items: Array<{
    id: number;
    name: string;
    image?: string;
    detail: string;
    muted?: boolean;
  }>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  placeholder: string;
  footer?: React.ReactNode;
}) {
  const [query, setQuery] = React.useState("");
  const needle = query.trim().toLowerCase();
  const items = needle
    ? props.items.filter((item) => item.name.toLowerCase().includes(needle))
    : props.items;

  return (
    <aside className="flex flex-col gap-2 rounded-xl bg-gray-950/45 p-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-white/35" />
        <input
          className={cn(inputClass, "pl-8")}
          placeholder={props.placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul className="max-h-72 space-y-0.5 overflow-y-auto lg:max-h-none lg:flex-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => props.onSelect(item.id)}
              aria-current={item.id === props.selectedId ? "true" : undefined}
              className={cn(
                "flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm transition-colors",
                item.id === props.selectedId
                  ? "bg-amber-400/15 text-white"
                  : "text-white/75 hover:bg-white/[0.05]",
                item.muted && item.id !== props.selectedId && "opacity-50",
              )}
            >
              {item.image ? (
                <Image
                  src={item.image}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 object-contain"
                />
              ) : null}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                {item.detail}
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="px-2 py-3 text-sm text-white/45">Nothing found.</li>
        ) : null}
      </ul>
      {props.footer}
    </aside>
  );
}

type PoolEditing = {
  updatePool: (
    locationId: number,
    resourceId: number,
    patch: Partial<GatheringLocationPool>,
  ) => void;
  applyEverywhere: (
    resourceId: number,
    values: DropValues,
    enableEverywhere: boolean,
  ) => void;
};

function ResourceView(
  props: PoolEditing & {
    resource: GatheringAdminResource;
    locations: GatheringAdminLocation[];
    rarity?: RarityOption;
    setLevel: (level: number) => void;
  },
) {
  const { resource } = props;
  const pools = props.locations.map((location) => ({
    location,
    pool: location.resources.find((pool) => pool.resourceId === resource.id)!,
  }));
  const firstEnabled = pools.find((entry) => entry.pool?.enabled)?.pool;
  const [bulk, setBulk] = React.useState<DropValues>({
    baseChance: firstEnabled?.baseChance ?? 0.25,
    minQuantity: firstEnabled?.minQuantity ?? 1,
    maxQuantity: firstEnabled?.maxQuantity ?? 1,
  });
  const bulkInvalid = bulk.maxQuantity < bulk.minQuantity;
  const enabledCount = pools.filter((entry) => entry.pool?.enabled).length;

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center gap-4 rounded-xl bg-gray-950/45 p-4">
        <Image
          src={resource.item.sprite}
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 rounded-[8px] bg-black/25 object-contain p-1"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{resource.name}</h2>
          <p className="text-xs text-white/50">
            <span style={{ color: props.rarity?.color }}>
              {props.rarity?.label ?? resource.rarity}
            </span>{" "}
            · found in {enabledCount} of {props.locations.length} locations ·{" "}
            <Link
              href={`/admin/items/${resource.itemId}`}
              className="hover:text-white hover:underline"
            >
              item
            </Link>{" "}
            ·{" "}
            <Link
              href={`/admin/vocations/${resource.id}`}
              className="hover:text-white hover:underline"
            >
              resource
            </Link>
          </p>
        </div>
        <label className="w-40 space-y-1 text-xs text-white/55">
          Required Gathering level
          <Num
            label="Required Gathering level"
            value={resource.requiredSkillLevel}
            min={1}
            onChange={(value) => props.setLevel(Math.max(1, Math.round(value)))}
          />
        </label>
      </header>

      <section className="space-y-3 rounded-xl bg-amber-400/[0.06] p-4">
        <div>
          <h3 className="text-sm font-semibold">Same drop everywhere</h3>
          <p className="text-xs text-white/50">
            Write one chance and amount into every location, then fine-tune
            single locations below. Nothing is saved until you press Save.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid w-full grid-cols-3 gap-2 sm:w-auto sm:grid-cols-[96px_80px_80px]">
            <span className="text-[11px] text-white/45">Chance</span>
            <span className="text-[11px] text-white/45">Min</span>
            <span className="text-[11px] text-white/45">Max</span>
            {dropInputs("Every location", bulk, (patch) =>
              setBulk((current) => ({ ...current, ...patch })),
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="soft"
            disabled={bulkInvalid || enabledCount === 0}
            onClick={() => props.applyEverywhere(resource.id, bulk, false)}
          >
            Apply to its {enabledCount} locations
          </Button>
          <Button
            type="button"
            size="sm"
            variant="soft"
            disabled={bulkInvalid}
            onClick={() => props.applyEverywhere(resource.id, bulk, true)}
          >
            Apply and add to all {props.locations.length}
          </Button>
        </div>
      </section>

      <div className="overflow-x-auto rounded-xl bg-gray-950/45">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="w-14 px-2 py-2 font-medium">Drops</th>
              <th className="w-28 px-2 py-2 font-medium">Chance</th>
              <th className="w-24 px-2 py-2 font-medium">Min</th>
              <th className="w-24 px-2 py-2 font-medium">Max</th>
            </tr>
          </thead>
          <tbody>
            {pools.map(({ location, pool }) =>
              pool ? (
                <tr
                  key={location.id}
                  className={cn(
                    "odd:bg-white/[0.02]",
                    !pool.enabled && "text-white/40 [&_input]:opacity-50",
                  )}
                >
                  <td className="px-3 py-1.5">
                    <div className="font-medium">{location.name}</div>
                    <div className="text-[11px] text-white/40">
                      Gathering lv {location.gatheringRequiredLevel}
                      {location.gatheringEnabled ? "" : " · location off"}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Toggle
                      label={`${resource.name} drops at ${location.name}`}
                      checked={pool.enabled}
                      onChange={(enabled) =>
                        props.updatePool(location.id, resource.id, { enabled })
                      }
                    />
                  </td>
                  <DropCells
                    label={`${resource.name} at ${location.name}`}
                    pool={pool}
                    onChange={(patch) =>
                      props.updatePool(location.id, resource.id, patch)
                    }
                  />
                </tr>
              ) : null,
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LocationView(
  props: PoolEditing & {
    location: GatheringAdminLocation;
    resources: GatheringAdminResource[];
    locationCount: number;
    updateLocation: (patch: Partial<GatheringAdminLocation>) => void;
    onOpenResource?: (resourceId: number) => void;
  },
) {
  const { location } = props;
  const poolById = new Map(
    location.resources.map((pool) => [pool.resourceId, pool]),
  );
  const active = props.resources.filter(
    (resource) => poolById.get(resource.id)?.enabled,
  );
  const addable = props.resources.filter(
    (resource) => poolById.get(resource.id)?.enabled === false,
  );

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center gap-4 rounded-xl bg-gray-950/45 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{location.name}</h2>
          <p className="text-xs text-white/50">
            Character level {location.requiredLevel} to travel · {active.length}{" "}
            resources in the pool
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <Toggle
            label={`Gathering at ${location.name}`}
            checked={location.gatheringEnabled}
            onChange={(gatheringEnabled) => props.updateLocation({ gatheringEnabled })}
          />
          Gathering {location.gatheringEnabled ? "on" : "off"}
        </label>
        <label className="w-40 space-y-1 text-xs text-white/55">
          Required Gathering level
          <Num
            label={`Required Gathering level at ${location.name}`}
            value={location.gatheringRequiredLevel}
            min={1}
            onChange={(value) =>
              props.updateLocation({
                gatheringRequiredLevel: Math.max(1, Math.round(value)),
              })
            }
          />
        </label>
      </header>

      <div className="overflow-x-auto rounded-xl bg-gray-950/45">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-3 py-2 font-medium">Resource</th>
              <th className="w-28 px-2 py-2 font-medium">Chance</th>
              <th className="w-24 px-2 py-2 font-medium">Min</th>
              <th className="w-24 px-2 py-2 font-medium">Max</th>
              <th className="w-20 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {active.map((resource) => {
              const pool = poolById.get(resource.id)!;
              return (
                <tr key={resource.id} className="odd:bg-white/[0.02]">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Image
                        src={resource.item.sprite}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 object-contain"
                      />
                      <div className="min-w-0">
                        {props.onOpenResource ? (
                          <button
                            type="button"
                            className="truncate font-medium hover:underline"
                            title="Edit this resource in every location"
                            onClick={() => props.onOpenResource?.(resource.id)}
                          >
                            {resource.name}
                          </button>
                        ) : (
                          <div className="truncate font-medium">{resource.name}</div>
                        )}
                        <div className="text-[11px] text-white/40">
                          lv {resource.requiredSkillLevel}
                        </div>
                      </div>
                    </div>
                  </td>
                  <DropCells
                    label={`${resource.name} at ${location.name}`}
                    pool={pool}
                    onChange={(patch) =>
                      props.updatePool(location.id, resource.id, patch)
                    }
                  />
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-0.5">
                      {props.locationCount > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title={`Copy this drop to every location that has ${resource.name}`}
                          aria-label={`Copy ${resource.name} drop to its other locations`}
                          disabled={pool.maxQuantity < pool.minQuantity}
                          onClick={() => {
                            props.applyEverywhere(resource.id, pool, false);
                            toast.success(`${resource.name} copied to its other locations`);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        title="Remove from this pool"
                        aria-label={`Remove ${resource.name} from ${location.name}`}
                        onClick={() =>
                          props.updatePool(location.id, resource.id, { enabled: false })
                        }
                      >
                        <X className="h-4 w-4 text-red-300" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {active.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-white/45">
                  Nothing can be gathered here yet. Add a resource below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex items-center gap-2 p-3">
          <Plus className="h-4 w-4 shrink-0 text-white/40" />
          <SearchSelect
            className="max-w-xs"
            placeholder={
              addable.length ? "Add a resource to this pool…" : "Every resource is in this pool"
            }
            options={addable.map((resource) => ({
              id: resource.id,
              name: resource.name,
              image: resource.item.sprite,
              detail: `lv ${resource.requiredSkillLevel}`,
            }))}
            value={null}
            onChange={(id) => {
              if (id !== null) props.updatePool(location.id, id, { enabled: true });
            }}
          />
        </div>
      </div>
    </div>
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
      router.refresh();
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
      const duration = body.duration as GatheringAdminDuration;
      setDurations((current) => [...current, duration]);
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
      <td className="p-1.5">
        <input
          className={inputClass}
          value={duration.label}
          placeholder="e.g. 2 hours"
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </td>
      <td className="p-1.5">
        <Num
          label="Duration in hours"
          min={1 / 60}
          max={168}
          step={0.25}
          value={duration.durationSeconds / 3_600}
          onChange={(value) =>
            onChange({ durationSeconds: Math.round(value * 3_600) })
          }
        />
      </td>
      <td className="p-1.5">
        <Num
          label="Find rolls"
          min={1}
          max={100}
          value={duration.rewardRolls}
          onChange={(rewardRolls) => onChange({ rewardRolls })}
        />
      </td>
      <td className="p-1.5">
        <Num
          label="Quantity multiplier"
          min={0.1}
          max={20}
          step={0.05}
          value={duration.quantityMultiplier}
          onChange={(quantityMultiplier) => onChange({ quantityMultiplier })}
        />
      </td>
      <td className="p-1.5">
        <Num
          label="XP reward"
          min={0}
          value={duration.xpReward}
          onChange={(xpReward) => onChange({ xpReward })}
        />
      </td>
      <td className="p-1.5">
        <Num
          label="Required Gathering level"
          min={0}
          max={10_000}
          value={duration.requiredGatheringLevel}
          onChange={(requiredGatheringLevel) =>
            onChange({ requiredGatheringLevel })
          }
        />
      </td>
      <td className="p-1.5">
        <Num
          label="Sort order"
          value={duration.sortOrder}
          onChange={(sortOrder) => onChange({ sortOrder })}
        />
      </td>
      <td className="p-1.5">
        <Toggle
          label="Enabled"
          checked={duration.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
      </td>
    </>
  );

  return (
    <section className="space-y-3 rounded-xl bg-gray-950/45 p-4">
      <p className="text-sm text-white/55">
        More rolls mean more find attempts; the quantity multiplier scales the
        amount found on each successful attempt. Each row saves on its own.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="whitespace-nowrap text-left text-[11px] uppercase tracking-wide text-white/40">
            <tr>
              <th className="p-1.5 font-medium">Label</th>
              <th className="w-24 p-1.5 font-medium">Hours</th>
              <th className="w-24 p-1.5 font-medium">Find rolls</th>
              <th className="w-24 p-1.5 font-medium">Quantity ×</th>
              <th className="w-28 p-1.5 font-medium">XP</th>
              <th className="w-24 p-1.5 font-medium">Req. level</th>
              <th className="w-20 p-1.5 font-medium">Order</th>
              <th className="w-12 p-1.5 font-medium">On</th>
              <th className="p-1.5" />
            </tr>
          </thead>
          <tbody>
            {durations.map((duration) => (
              <tr key={duration.id} className="odd:bg-white/[0.02]">
                {fields(duration, (patch) => update(duration.id, patch))}
                <td className="p-1.5">
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
            <tr className="bg-amber-400/[0.05]">
              {fields(draft, (patch) =>
                setDraft((current) => ({ ...current, ...patch })),
              )}
              <td className="p-1.5 text-right">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void create()}
                  disabled={
                    savingId === "new" || draft.label.trim().length === 0
                  }
                >
                  <Plus className="h-4 w-4" />
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
  /** Set on a region page: only that region's resource pool. */
  locationId?: number;
  initialTab?: string;
}) {
  const router = useRouter();
  const [locations, setLocations] = React.useState(props.locations);
  const [resources, setResources] = React.useState(props.resources);
  const [saved, setSaved] = React.useState({
    locations: props.locations,
    resources: props.resources,
  });
  const [saving, setSaving] = React.useState(false);
  const [tab, setTab] = React.useState<GatheringTab>(
    GATHERING_TABS.find((entry) => entry.key === props.initialTab)?.key ?? "resources",
  );
  const [resourceId, setResourceId] = React.useState(props.resources[0]?.id ?? null);
  const [locationId, setLocationId] = React.useState(
    props.locationId ?? props.locations[0]?.id ?? null,
  );

  const savedLocations = new Map(saved.locations.map((entry) => [entry.id, entry]));
  const savedResources = new Map(saved.resources.map((entry) => [entry.id, entry]));
  const changedLocations = locations.filter(
    (entry) => !same(entry, savedLocations.get(entry.id)),
  );
  const changedResources = resources.filter(
    (entry) =>
      entry.requiredSkillLevel !== savedResources.get(entry.id)?.requiredSkillLevel,
  );
  const changeCount = changedLocations.length + changedResources.length;
  const invalid = locations.flatMap((location) =>
    location.resources
      .filter((pool) => pool.maxQuantity < pool.minQuantity)
      .map(
        (pool) =>
          `${resources.find((entry) => entry.id === pool.resourceId)?.name} at ${location.name}`,
      ),
  );
  useLeaveGuard(changeCount > 0);

  const editing: PoolEditing = {
    updatePool: (targetLocationId, targetResourceId, patch) =>
      setLocations((current) =>
        current.map((location) =>
          location.id !== targetLocationId
            ? location
            : {
                ...location,
                resources: location.resources.map((pool) =>
                  pool.resourceId === targetResourceId ? { ...pool, ...patch } : pool,
                ),
              },
        ),
      ),
    applyEverywhere: (targetResourceId, values, enableEverywhere) =>
      setLocations((current) =>
        current.map((location) => ({
          ...location,
          resources: location.resources.map((pool) =>
            pool.resourceId === targetResourceId && (enableEverywhere || pool.enabled)
              ? {
                  ...pool,
                  enabled: true,
                  baseChance: values.baseChance,
                  minQuantity: values.minQuantity,
                  maxQuantity: values.maxQuantity,
                }
              : pool,
          ),
        })),
      ),
  };

  const updateLocation = (
    targetLocationId: number,
    patch: Partial<GatheringAdminLocation>,
  ) =>
    setLocations((current) =>
      current.map((location) =>
        location.id === targetLocationId ? { ...location, ...patch } : location,
      ),
    );

  const selectTab = (next: GatheringTab) => {
    setTab(next);
    // Keeps the tab in the URL without a server round trip that would reset edits.
    window.history.replaceState(
      null,
      "",
      next === "resources" ? window.location.pathname : `?tab=${next}`,
    );
  };

  const discard = () => {
    setLocations(saved.locations);
    setResources(saved.resources);
  };

  const save = async () => {
    setSaving(true);
    const [locationResults, resourceResults] = await Promise.all([
      Promise.allSettled(
        changedLocations.map(async (location) => {
          const before = savedLocations.get(location.id);
          await adminRequest(`/api/admin/gathering/locations/${location.id}`, "PATCH", {
            gatheringEnabled: location.gatheringEnabled,
            gatheringRequiredLevel: location.gatheringRequiredLevel,
            resources: location.resources.filter(
              (pool) =>
                !same(
                  pool,
                  before?.resources.find((entry) => entry.resourceId === pool.resourceId),
                ),
            ),
          });
          return location;
        }),
      ),
      Promise.allSettled(
        changedResources.map(async (resource) => {
          await adminRequest(`/api/admin/gathering/resources/${resource.id}`, "PATCH", {
            requiredSkillLevel: resource.requiredSkillLevel,
          });
          return resource;
        }),
      ),
    ]);
    const done = <T extends { id: number }>(results: PromiseSettledResult<T>[]) =>
      new Map(
        results.flatMap((result) =>
          result.status === "fulfilled" ? [[result.value.id, result.value] as const] : [],
        ),
      );
    const doneLocations = done(locationResults);
    const doneResources = done(resourceResults);
    setSaved((current) => ({
      locations: current.locations.map((entry) => doneLocations.get(entry.id) ?? entry),
      resources: current.resources.map((entry) => doneResources.get(entry.id) ?? entry),
    }));
    const failure = [...locationResults, ...resourceResults].find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failure) {
      toast.error(errorMessage(failure.reason, "Some changes could not be saved"));
    } else {
      toast.success("Gathering changes saved");
    }
    setSaving(false);
    router.refresh();
  };

  const location = locations.find((entry) => entry.id === locationId);
  const resource = resources.find((entry) => entry.id === resourceId);

  const saveBar =
    changeCount > 0 ? (
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-xl bg-gray-900/95 p-3 shadow-2xl ring-1 ring-amber-400/30 backdrop-blur">
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Unsaved changes</span>
          <span className="text-white/55">
            {" "}
            · {changedLocations.length} location
            {changedLocations.length === 1 ? "" : "s"}
            {changedResources.length
              ? `, ${changedResources.length} resource level${changedResources.length === 1 ? "" : "s"}`
              : ""}
          </span>
          {invalid.length ? (
            <div className="truncate text-xs text-red-300">
              Max is below min: {invalid.join(", ")}
            </div>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={discard} disabled={saving}>
          <Undo2 className="h-4 w-4" />
          Discard
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          disabled={saving || invalid.length > 0}
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save all"}
        </Button>
      </div>
    ) : null;

  if (props.locationId) {
    return location ? (
      <div className="space-y-4">
        <LocationView
          {...editing}
          location={location}
          resources={resources}
          locationCount={1}
          updateLocation={(patch) => updateLocation(location.id, patch)}
        />
        {saveBar}
      </div>
    ) : null;
  }

  const rarityByValue = new Map(props.rarities.map((rarity) => [rarity.value, rarity]));
  const resourceLocationCount = (id: number) =>
    locations.filter((entry) =>
      entry.resources.some((pool) => pool.resourceId === id && pool.enabled),
    ).length;

  return (
    <div className="space-y-4">
      <nav role="tablist" className="flex gap-1 overflow-x-auto border-b border-white/10">
        {GATHERING_TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={tab === entry.key}
            onClick={() => selectTab(entry.key)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
              tab === entry.key
                ? "border-amber-400 text-white"
                : "border-transparent text-white/55 hover:text-white",
            )}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "resources" ? (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <PickList
            placeholder="Find a resource…"
            selectedId={resourceId}
            onSelect={setResourceId}
            items={resources.map((entry) => {
              const count = resourceLocationCount(entry.id);
              return {
                id: entry.id,
                name: entry.name,
                image: entry.item.sprite,
                detail: `lv ${entry.requiredSkillLevel} · ${count} loc`,
                muted: count === 0,
              };
            })}
            footer={
              <Link
                href="/admin/vocations/new"
                className="flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-xs text-white/55 hover:bg-white/[0.05] hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                New Gathering resource
              </Link>
            }
          />
          {resource ? (
            <ResourceView
              key={resource.id}
              {...editing}
              resource={resource}
              locations={locations}
              rarity={rarityByValue.get(resource.rarity)}
              setLevel={(level) =>
                setResources((current) =>
                  current.map((entry) =>
                    entry.id === resource.id
                      ? { ...entry, requiredSkillLevel: level }
                      : entry,
                  ),
                )
              }
            />
          ) : (
            <p className="text-sm text-white/55">
              No Gathering resources exist yet. Create one from Vocation resources.
            </p>
          )}
        </div>
      ) : null}

      {tab === "locations" ? (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <PickList
            placeholder="Find a location…"
            selectedId={locationId}
            onSelect={setLocationId}
            items={locations.map((entry) => ({
              id: entry.id,
              name: entry.name,
              detail: entry.gatheringEnabled
                ? `lv ${entry.gatheringRequiredLevel} · ${entry.resources.filter((pool) => pool.enabled).length}`
                : "off",
              muted: !entry.gatheringEnabled,
            }))}
          />
          {location ? (
            <LocationView
              {...editing}
              location={location}
              resources={resources}
              locationCount={locations.length}
              updateLocation={(patch) => updateLocation(location.id, patch)}
              onOpenResource={(id) => {
                setResourceId(id);
                selectTab("resources");
              }}
            />
          ) : null}
        </div>
      ) : null}

      {tab === "durations" ? (
        <DurationEditor initialDurations={props.durations} />
      ) : null}

      {tab === "simulator" ? (
        <GatheringSimulator
          locations={locations}
          resources={resources}
          durations={props.durations}
          rarities={props.rarities}
        />
      ) : null}

      {saveBar}
    </div>
  );
}
