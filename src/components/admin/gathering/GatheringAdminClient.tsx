"use client";

import Link from "next/link";
import React from "react";
import toast from "react-hot-toast";
import { Copy, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { SearchSelect } from "~/components/admin/SearchSelect";
import {
  Art,
  Card,
  DetailHeader,
  type Draft,
  DurationTable,
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
  same,
  SaveBar,
  theadClass,
  Toggle,
  useDraft,
  useSelection,
  useUrlTab,
} from "~/components/admin/editor";
import { adminRequest } from "~/components/admin/fields";
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

const TABS = [
  { key: "resources", label: "By resource" },
  { key: "locations", label: "By location" },
  { key: "durations", label: "Durations" },
  { key: "simulator", label: "Simulator" },
] as const;

type DropFieldsProps = {
  label: string;
  value: DropValues;
  onChange: (patch: Partial<DropValues>) => void;
};

/** Chance and amount inputs of one drop. */
function dropFields(props: DropFieldsProps) {
  return [
    <Percent
      key="chance"
      label={`${props.label} find chance`}
      value={props.value.baseChance}
      onChange={(baseChance) => props.onChange({ baseChance })}
    />,
    <RangeInputs
      key="amount"
      label={`${props.label} amount`}
      floor={1}
      min={props.value.minQuantity}
      max={props.value.maxQuantity}
      onChange={({ min, max }) =>
        props.onChange({
          minQuantity: min ?? props.value.minQuantity,
          maxQuantity: max ?? props.value.maxQuantity,
        })
      }
    />,
  ];
}

function DropCells(props: DropFieldsProps) {
  return dropFields(props).map((input) => <td key={input.key}>{input}</td>);
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

function poolEditing(locations: Draft<GatheringAdminLocation>): PoolEditing {
  const mapPool = (
    location: GatheringAdminLocation,
    resourceId: number,
    change: (pool: GatheringLocationPool) => GatheringLocationPool,
  ) => ({
    ...location,
    resources: location.resources.map((pool) =>
      pool.resourceId === resourceId ? change(pool) : pool,
    ),
  });
  return {
    updatePool: (locationId, resourceId, patch) =>
      locations.update(locationId, (location) =>
        mapPool(location, resourceId, (pool) => ({ ...pool, ...patch })),
      ),
    applyEverywhere: (resourceId, values, enableEverywhere) =>
      locations.setRows((current) =>
        current.map((location) =>
          mapPool(location, resourceId, (pool) =>
            enableEverywhere || pool.enabled
              ? {
                  ...pool,
                  enabled: true,
                  baseChance: values.baseChance,
                  minQuantity: values.minQuantity,
                  maxQuantity: values.maxQuantity,
                }
              : pool,
          ),
        ),
      ),
  };
}

function ResourceView(
  props: PoolEditing & {
    resource: GatheringAdminResource;
    locations: GatheringAdminLocation[];
    rarity?: RarityOption;
    setLevel: (level: number) => void;
  },
) {
  const { resource } = props;
  const pools = props.locations.flatMap((location) => {
    const pool = location.resources.find(
      (entry) => entry.resourceId === resource.id,
    );
    return pool ? [{ location, pool }] : [];
  });
  const firstEnabled = pools.find((entry) => entry.pool.enabled)?.pool;
  const [bulk, setBulk] = React.useState<DropValues>({
    baseChance: firstEnabled?.baseChance ?? 0.25,
    minQuantity: firstEnabled?.minQuantity ?? 1,
    maxQuantity: firstEnabled?.maxQuantity ?? 1,
  });
  const bulkInvalid = bulk.maxQuantity < bulk.minQuantity;
  const enabledCount = pools.filter((entry) => entry.pool.enabled).length;
  const [bulkChance, bulkAmount] = dropFields({
    label: "Every location",
    value: bulk,
    onChange: (patch) => setBulk((current) => ({ ...current, ...patch })),
  });

  return (
    <div className="min-w-0 space-y-4">
      <DetailHeader
        image={resource.item.sprite}
        title={resource.name}
        subtitle={
          <>
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
          </>
        }
      >
        <Labeled label="Required Gathering level" className="w-40">
          <Num
            label="Required Gathering level"
            value={resource.requiredSkillLevel}
            min={1}
            integer
            onChange={props.setLevel}
          />
        </Labeled>
      </DetailHeader>

      <Card
        className="bg-amber-400/[0.06]"
        title="Same drop everywhere"
        description="Write one chance and amount into every location, then fine-tune single locations below. Nothing is saved until you press Save all."
      >
        <div className="flex flex-wrap items-end gap-2">
          <Labeled label="Chance" className="w-28">
            {bulkChance}
          </Labeled>
          <Labeled label="Amount" className="w-44">
            {bulkAmount}
          </Labeled>
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
      </Card>

      <Card className="overflow-x-auto p-2">
        <table className="w-full min-w-[520px] text-sm">
          <thead className={theadClass}>
            <tr>
              <th>Location</th>
              <th className="w-14">Drops</th>
              <th className="w-28">Chance</th>
              <th className="w-44">Amount</th>
            </tr>
          </thead>
          <tbody>
            {pools.map(({ location, pool }) => (
              <tr
                key={location.id}
                className={cn(
                  rowClass,
                  !pool.enabled && "text-white/40 [&_input]:opacity-50",
                )}
              >
                <td>
                  <div className="font-medium">{location.name}</div>
                  <div className="text-[11px] text-white/40">
                    Gathering lv {location.gatheringRequiredLevel}
                    {location.gatheringEnabled ? "" : " · location off"}
                  </div>
                </td>
                <td>
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
                  value={pool}
                  onChange={(patch) =>
                    props.updatePool(location.id, resource.id, patch)
                  }
                />
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function LocationView(
  props: PoolEditing & {
    location: GatheringAdminLocation;
    resources: GatheringAdminResource[];
    canCopy: boolean;
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
      <DetailHeader
        title={location.name}
        subtitle={`Character level ${location.requiredLevel} to travel · ${active.length} resources in the pool`}
      >
        <label className="flex items-center gap-2 text-sm text-white/70">
          <Toggle
            label={`Gathering at ${location.name}`}
            checked={location.gatheringEnabled}
            onChange={(gatheringEnabled) =>
              props.updateLocation({ gatheringEnabled })
            }
          />
          Gathering {location.gatheringEnabled ? "on" : "off"}
        </label>
        <Labeled label="Required Gathering level" className="w-40">
          <Num
            label={`Required Gathering level at ${location.name}`}
            value={location.gatheringRequiredLevel}
            min={1}
            integer
            onChange={(gatheringRequiredLevel) =>
              props.updateLocation({ gatheringRequiredLevel })
            }
          />
        </Labeled>
      </DetailHeader>

      <Card className="overflow-x-auto p-2">
        <table className="w-full min-w-[560px] text-sm">
          <thead className={theadClass}>
            <tr>
              <th>Resource</th>
              <th className="w-28">Chance</th>
              <th className="w-44">Amount</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {active.map((resource) => {
              const pool = poolById.get(resource.id)!;
              return (
                <tr key={resource.id} className={rowClass}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Art src={resource.item.sprite} size={28} />
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
                          <div className="truncate font-medium">
                            {resource.name}
                          </div>
                        )}
                        <div className="text-[11px] text-white/40">
                          lv {resource.requiredSkillLevel}
                        </div>
                      </div>
                    </div>
                  </td>
                  <DropCells
                    label={`${resource.name} at ${location.name}`}
                    value={pool}
                    onChange={(patch) =>
                      props.updatePool(location.id, resource.id, patch)
                    }
                  />
                  <td>
                    <div className="flex justify-end gap-0.5">
                      {props.canCopy ? (
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
                            toast.success(
                              `${resource.name} copied to its other locations`,
                            );
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
                          props.updatePool(location.id, resource.id, {
                            enabled: false,
                          })
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
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-sm text-white/45"
                >
                  Nothing can be gathered here yet. Add a resource below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="p-2">
          <SearchSelect
            className="max-w-xs"
            placeholder={
              addable.length
                ? "+ Add a resource to this pool…"
                : "Every resource is in this pool"
            }
            options={addable.map((resource) => ({
              id: resource.id,
              name: resource.name,
              image: resource.item.sprite,
              detail: `lv ${resource.requiredSkillLevel}`,
            }))}
            value={null}
            onChange={(id) => {
              if (id !== null)
                props.updatePool(location.id, id, { enabled: true });
            }}
          />
        </div>
      </Card>
    </div>
  );
}

const saveLocation = (
  location: GatheringAdminLocation,
  saved: GatheringAdminLocation,
) =>
  adminRequest(`/api/admin/gathering/locations/${location.id}`, "PATCH", {
    gatheringEnabled: location.gatheringEnabled,
    gatheringRequiredLevel: location.gatheringRequiredLevel,
    // Only the pool rows that changed.
    resources: location.resources.filter(
      (pool) =>
        !same(
          pool,
          saved.resources.find((entry) => entry.resourceId === pool.resourceId),
        ),
    ),
  });

const saveResource = patchRow<GatheringAdminResource>(
  "/api/admin/gathering/resources",
  (resource) => ({ requiredSkillLevel: resource.requiredSkillLevel }),
);

const saveDuration = patchRow<GatheringAdminDuration>(
  "/api/admin/gathering/durations",
);

export function GatheringAdminClient(props: {
  locations: GatheringAdminLocation[];
  resources: GatheringAdminResource[];
  durations: GatheringAdminDuration[];
  rarities: RarityOption[];
  /** Set on a region page: only that region's resource pool. */
  locationId?: number;
  initialTab?: string;
}) {
  const locations = useDraft(props.locations, saveLocation);
  const resources = useDraft(props.resources, saveResource);
  const durations = useDraft(props.durations, saveDuration);
  const [tab, selectTab] = useUrlTab(
    TABS.map((entry) => entry.key),
    props.initialTab,
  );
  const [resourceId, setResourceId] = useSelection(
    resources.rows.map((row) => row.id),
  );
  const [locationId, setLocationId] = useSelection(
    locations.rows.map((row) => row.id),
    props.locationId,
  );
  const editing = poolEditing(locations);

  const resourceName = (id: number) =>
    resources.rows.find((entry) => entry.id === id)?.name;
  const problems = locations.rows.flatMap((location) =>
    location.resources
      .filter((pool) => pool.maxQuantity < pool.minQuantity)
      .map(
        (pool) =>
          `${resourceName(pool.resourceId)} at ${location.name}: max below min`,
      ),
  );
  const saveBar = (
    <SaveBar drafts={[locations, resources, durations]} problems={problems} />
  );

  const location = locations.rows.find((entry) => entry.id === locationId);
  const locationView = location ? (
    <LocationView
      {...editing}
      location={location}
      resources={resources.rows}
      canCopy={!props.locationId && locations.rows.length > 1}
      updateLocation={(patch) => locations.update(location.id, patch)}
      onOpenResource={
        props.locationId
          ? undefined
          : (id) => {
              setResourceId(id);
              selectTab("resources");
            }
      }
    />
  ) : null;

  if (props.locationId) {
    return (
      <div className="space-y-4">
        {locationView}
        {saveBar}
      </div>
    );
  }

  const resource = resources.rows.find((entry) => entry.id === resourceId);
  const rarityByValue = new Map(
    props.rarities.map((rarity) => [rarity.value, rarity]),
  );
  const locationCount = (id: number) =>
    locations.rows.filter((entry) =>
      entry.resources.some((pool) => pool.resourceId === id && pool.enabled),
    ).length;

  return (
    <div className="space-y-4">
      <EditorTabs tabs={TABS} active={tab} onSelect={selectTab} />

      {tab === "resources" ? (
        <div className={masterDetailClass}>
          <PickList
            placeholder="Find a resource…"
            selectedId={resourceId}
            onSelect={setResourceId}
            items={resources.rows.map((entry) => {
              const count = locationCount(entry.id);
              return {
                id: entry.id,
                name: entry.name,
                image: entry.item.sprite,
                detail: `lv ${entry.requiredSkillLevel} · ${count} loc`,
                muted: count === 0,
              };
            })}
            footer={
              <ListAction href="/admin/vocations/new">
                New Gathering resource
              </ListAction>
            }
          />
          {resource ? (
            <ResourceView
              key={resource.id}
              {...editing}
              resource={resource}
              locations={locations.rows}
              rarity={rarityByValue.get(resource.rarity)}
              setLevel={(requiredSkillLevel) =>
                resources.update(resource.id, { requiredSkillLevel })
              }
            />
          ) : (
            <p className="text-sm text-white/55">
              No Gathering resources exist yet. Create one from Vocation
              resources.
            </p>
          )}
        </div>
      ) : null}

      {tab === "locations" ? (
        <div className={masterDetailClass}>
          <PickList
            placeholder="Find a location…"
            selectedId={locationId}
            onSelect={setLocationId}
            items={locations.rows.map((entry) => ({
              id: entry.id,
              name: entry.name,
              detail: entry.gatheringEnabled
                ? `lv ${entry.gatheringRequiredLevel} · ${entry.resources.filter((pool) => pool.enabled).length}`
                : "off",
              muted: !entry.gatheringEnabled,
            }))}
          />
          {locationView}
        </div>
      ) : null}

      {tab === "durations" ? (
        <DurationTable
          draft={durations}
          endpoint="/api/admin/gathering/durations"
          description="More rolls mean more find attempts; the quantity multiplier scales the amount found on each successful attempt."
          columns={[
            {
              key: "rewardRolls",
              label: "Find rolls",
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
            { key: "xpReward", label: "XP", min: 0, integer: true },
            {
              key: "requiredGatheringLevel",
              label: "Req. level",
              min: 0,
              max: 10_000,
              integer: true,
            },
          ]}
          newRow={(last) => ({
            label: `New expedition ${durations.rows.length + 1}`,
            durationSeconds: (last?.durationSeconds ?? 0) + 3_600,
            rewardRolls: Math.min(100, (last?.rewardRolls ?? 1) + 2),
            quantityMultiplier: last?.quantityMultiplier ?? 1,
            xpReward: last?.xpReward ?? 0,
            requiredGatheringLevel: last?.requiredGatheringLevel ?? 0,
            enabled: false,
            sortOrder: (last?.sortOrder ?? 0) + 10,
          })}
        />
      ) : null}

      {tab === "simulator" ? (
        <GatheringSimulator
          locations={locations.rows}
          resources={resources.rows}
          durations={durations.rows}
          rarities={props.rarities}
        />
      ) : null}

      {saveBar}
    </div>
  );
}
