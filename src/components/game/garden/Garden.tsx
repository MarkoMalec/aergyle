"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Check,
  CircleDashed,
  PackageOpen,
  Sprout,
  Sunrise,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import { gardenQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import { useOptionalDndContext } from "~/components/dnd/DnDContext";
import type { InventorySlotWithItem } from "~/types/inventory";
import { useUserContext } from "~/context/userContext";
import { useEquipmentContext } from "~/context/equipmentContext";
import { formatRemaining } from "~/components/game/actions/format";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import {
  addActiveActionEventListener,
  dispatchActiveActionEvent,
} from "~/components/game/actions/activeActionEvents";
import { dispatchSkillProgressEvent } from "~/components/game/skills/skillProgressEvents";
import { cn } from "~/lib/utils";
import { SATCHEL_ART, SeedSatchelDialog } from "./SeedSatchelDialog";
import {
  buildSeedOptions,
  fetchSeedConfig,
  formatCompactDuration,
  formatReadyClock,
  readStored,
  resolvedKind,
  writeStored,
  type GardenStateResponse,
  type GardenTile,
  type PlantGroup,
  type PlotKind,
  type SeedConfigResponse,
  type SeedOption,
} from "./shared";

/** What this device remembers per player; see `readStored`. */
type GardenMemory = {
  lastSeedId: number | null;
  /** Plot index -> the seed that last grew there. */
  layout: Record<string, number>;
};

const EMPTY_MEMORY: GardenMemory = { lastSeedId: null, layout: {} };

function CountChip(props: {
  icon: LucideIcon;
  label: string;
  className?: string;
  title?: string;
}) {
  const Icon = props.icon;
  return (
    <span
      title={props.title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface-inset/70 px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground",
        props.className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {props.label}
    </span>
  );
}

export default function Garden() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();
  const { equipment } = useEquipmentContext();
  const { active: isAnyActionActive } = useVocationalActiveActionContext();
  const dnd = useOptionalDndContext();
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<number[]>([]);
  const [satchelOpen, setSatchelOpen] = useState(false);
  // Plots an action button would touch while it is hovered, with the crop
  // art to ghost into empty plots ("" for plots that are only highlighted).
  const [preview, setPreview] = useState<Map<number, string> | null>(null);
  const [memory, setMemory] = useState<GardenMemory>(EMPTY_MEMORY);
  const dragRef = useRef<{ kind: PlotKind; add: boolean } | null>(null);
  const pointerTypeRef = useRef("mouse");
  const storageKey = user?.id ? `aergyle:garden:${user.id}` : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const endDrag = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    setMemory({ ...EMPTY_MEMORY, ...readStored(storageKey, EMPTY_MEMORY) });
  }, [storageKey]);

  const remember = useCallback(
    (patch: Partial<GardenMemory>) => {
      setMemory((previous) => {
        const next = { ...previous, ...patch };
        if (storageKey) writeStored(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const gardenQuery = useQuery({
    queryKey: gardenQueryKeys.all(),
    queryFn: async (): Promise<GardenStateResponse> => {
      const response = await fetch("/api/garden/state", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as
        | GardenStateResponse
        | { error?: string }
        | null;
      if (!response.ok || !body || "error" in body) {
        throw new Error(
          body && "error" in body ? body.error : "Failed to load garden",
        );
      }
      return body as GardenStateResponse;
    },
    enabled: Boolean(user?.id),
    staleTime: 0,
  });

  useEffect(
    () =>
      addActiveActionEventListener(() => {
        void queryClient.invalidateQueries({ queryKey: gardenQueryKeys.all() });
      }),
    [queryClient],
  );

  const harvestEndsAt = gardenQuery.data?.harvest?.endsAt;
  useEffect(() => {
    if (!harvestEndsAt) return;
    const delay =
      Math.max(0, new Date(harvestEndsAt).getTime() - Date.now()) + 300;
    const timer = window.setTimeout(() => {
      void queryClient
        .invalidateQueries({ queryKey: gardenQueryKeys.all() })
        .then(() => dispatchSkillProgressEvent("Gardening"));
      void queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.all(),
      });
      dispatchActiveActionEvent({ kind: "changed" });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [harvestEndsAt, queryClient]);

  // Record which seed grows in each plot, so it can be replanted after harvest.
  const tilesData = gardenQuery.data?.tiles;
  useEffect(() => {
    if (!tilesData || !storageKey) return;
    setMemory((previous) => {
      let layout = previous.layout;
      for (const tile of tilesData) {
        if (tile.state === "EMPTY" || layout[tile.tileIndex] === tile.seed.id)
          continue;
        if (layout === previous.layout) layout = { ...previous.layout };
        layout[tile.tileIndex] = tile.seed.id;
      }
      if (layout === previous.layout) return previous;
      const next = { ...previous, layout };
      writeStored(storageKey, next);
      return next;
    });
  }, [tilesData, storageKey]);

  const fallbackInventoryQuery = useQuery({
    queryKey: inventoryQueryKeys.byUser(user?.id),
    enabled: !dnd && Boolean(user?.id),
    queryFn: async (): Promise<{ slots: InventorySlotWithItem[] }> => {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load seeds from inventory");
      const body = (await response.json()) as {
        slots?: InventorySlotWithItem[];
      };
      return { slots: body.slots ?? [] };
    },
    staleTime: 0,
  });
  const inventory = useMemo(
    () => dnd?.inventory ?? fallbackInventoryQuery.data?.slots ?? [],
    [dnd?.inventory, fallbackInventoryQuery.data?.slots],
  );
  const seedOptions = useMemo(() => buildSeedOptions(inventory), [inventory]);
  const seedById = useMemo(
    () => new Map(seedOptions.map((seed) => [seed.templateItemId, seed])),
    [seedOptions],
  );

  const seedConfigQueries = useQueries({
    queries: seedOptions.map((seed) => ({
      queryKey: gardenQueryKeys.seedConfig(seed.templateItemId),
      queryFn: () => fetchSeedConfig(seed.templateItemId),
      staleTime: 5 * 60_000,
    })),
  });
  const seedConfigs = new Map<number, SeedConfigResponse>();
  for (const query of seedConfigQueries)
    if (query.data) seedConfigs.set(query.data.id, query.data);
  const cropSprite = (seedId: number) =>
    seedConfigs.get(seedId)?.seedYieldItem?.sprite ??
    seedById.get(seedId)?.sprite ??
    "";

  const tileByIndex = useMemo(
    () => new Map((tilesData ?? []).map((tile) => [tile.tileIndex, tile])),
    [tilesData],
  );
  const gridSize = gardenQuery.data?.gridSize ?? 6;
  const grid = useMemo(
    () =>
      Array.from(
        { length: gridSize * gridSize },
        (_, tileIndex): GardenTile =>
          tileByIndex.get(tileIndex) ?? { tileIndex, state: "EMPTY" },
      ),
    [gridSize, tileByIndex],
  );
  const kindAt = useCallback(
    (index: number, at: number) =>
      resolvedKind(
        tileByIndex.get(index) ?? { tileIndex: index, state: "EMPTY" },
        at,
      ),
    [tileByIndex],
  );

  // A selection holds plots of one kind (empty or ready); plots that changed
  // kind since they were picked (planted, harvested) simply drop out.
  const firstKind = selected.length > 0 ? kindAt(selected[0]!, now) : null;
  const selectionKind = firstKind === "GROWING" ? null : firstKind;
  const selection =
    selectionKind === null
      ? []
      : selected.filter((index) => kindAt(index, now) === selectionKind);

  const togglePlot = useCallback(
    (index: number, kind: PlotKind, add: boolean) => {
      setSelected((previous) => {
        const at = Date.now();
        const sameKind = previous.filter((i) => kindAt(i, at) === kind);
        if (sameKind.includes(index) === add)
          return sameKind.length === previous.length ? previous : sameKind;
        return add
          ? [...sameKind, index].sort((a, b) => a - b)
          : sameKind.filter((i) => i !== index);
      });
    },
    [kindAt],
  );

  useEffect(() => {
    if (selected.length === 0 || satchelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.length, satchelOpen]);

  const plantMutation = useMutation({
    mutationFn: async (input: {
      groups: PlantGroup[];
      rememberSeedId: number | null;
    }) => {
      let planted = 0;
      for (const group of input.groups) {
        const response = await fetch("/api/garden/plant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(group),
        });
        const body = (await response.json().catch(() => null)) as {
          planted?: number;
          error?: string;
        } | null;
        if (!response.ok) {
          const message = body?.error ?? "Failed to plant";
          throw new Error(
            planted > 0 ? `Planted ${planted}, then: ${message}` : message,
          );
        }
        planted += body?.planted ?? group.tileIndices.length;
      }
      return planted;
    },
    onSuccess: (planted, input) => {
      toast.success(`Planted ${planted} plot${planted === 1 ? "" : "s"}`);
      setSelected([]);
      setPreview(null);
      setSatchelOpen(false);
      if (input.rememberSeedId !== null)
        remember({ lastSeedId: input.rememberSeedId });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to plant"),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: gardenQueryKeys.all() }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      ]),
  });

  const harvestMutation = useMutation({
    mutationFn: async (tileIndices: number[]) => {
      const response = await fetch("/api/garden/harvest/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileIndices }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(body?.error ?? "Failed to begin harvest");
    },
    onSuccess: async () => {
      toast.success("Harvest started");
      setSelected([]);
      setPreview(null);
      dispatchActiveActionEvent({ kind: "changed" });
      await queryClient.invalidateQueries({ queryKey: gardenQueryKeys.all() });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to harvest"),
  });

  if (gardenQuery.isLoading)
    return (
      <div className="game-panel-flat game-empty-state">
        Walking out to the garden…
      </div>
    );
  if (gardenQuery.isError) {
    return (
      <div className="game-panel-flat game-empty-state">
        <p>
          {gardenQuery.error instanceof Error
            ? gardenQuery.error.message
            : "The garden is unavailable."}
        </p>
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => gardenQuery.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const emptyPlots: number[] = [];
  const readyPlots: number[] = [];
  let growingCount = 0;
  let nextReadyAt: number | null = null;
  for (const tile of grid) {
    const kind = resolvedKind(tile, now);
    if (kind === "EMPTY") emptyPlots.push(tile.tileIndex);
    else if (kind === "READY") readyPlots.push(tile.tileIndex);
    else if (tile.state !== "EMPTY") {
      growingCount += 1;
      const readyAt = new Date(tile.readyAt).getTime();
      if (nextReadyAt === null || readyAt < nextReadyAt) nextReadyAt = readyAt;
    }
  }

  const harvest = gardenQuery.data?.harvest ?? null;
  const isHarvesting = harvest !== null;
  const canInteract = !isAnyActionActive && !isHarvesting;
  const hasHoe = Boolean(equipment?.hoe);
  const plantBlockedReason = isHarvesting
    ? "Harvest in progress"
    : isAnyActionActive
      ? "Busy with another activity"
      : !hasHoe
        ? "No Hoe equipped"
        : null;

  // With nothing selected, the actions cover every empty or ripe plot.
  const plantTargets = selectionKind === "EMPTY" ? selection : emptyPlots;
  const harvestTargets = selectionKind === "READY" ? selection : readyPlots;
  const harvestSeconds = harvestTargets.reduce((total, index) => {
    const tile = tileByIndex.get(index);
    return (
      total +
      (tile && tile.state !== "EMPTY" ? Math.max(1, tile.harvestSeconds) : 0)
    );
  }, 0);
  const totalSeeds = seedOptions.reduce((sum, seed) => sum + seed.quantity, 0);

  const lastSeed: SeedOption | null =
    (memory.lastSeedId !== null ? seedById.get(memory.lastSeedId) : null) ??
    (seedOptions.length === 1 ? seedOptions[0]! : null);

  // Plots that were harvested and can get the same crop back, seeds allowing.
  const replantGroups: PlantGroup[] = [];
  if (selectionKind === null) {
    const seedsLeft = new Map(
      seedOptions.map((seed) => [seed.templateItemId, seed.quantity]),
    );
    const bySeed = new Map<number, number[]>();
    for (const index of emptyPlots) {
      const seedId = memory.layout[index];
      const left = seedId === undefined ? 0 : seedsLeft.get(seedId) ?? 0;
      if (seedId === undefined || left <= 0) continue;
      seedsLeft.set(seedId, left - 1);
      bySeed.set(seedId, [...(bySeed.get(seedId) ?? []), index]);
    }
    for (const [seedItemId, tileIndices] of bySeed)
      replantGroups.push({ seedItemId, tileIndices });
  }
  const replantCount = replantGroups.reduce(
    (sum, group) => sum + group.tileIndices.length,
    0,
  );

  const showHarvest = harvestTargets.length > 0 && selectionKind !== "EMPTY";
  const showPlant =
    plantTargets.length > 0 &&
    selectionKind !== "READY" &&
    seedOptions.length > 0;

  type PlantAction = {
    label: string;
    title: string;
    groups: PlantGroup[];
    rememberSeedId: number | null;
    sprites: string[];
  };
  let plantAction: PlantAction | null = null;
  if (showPlant && selectionKind === null && replantCount > 0) {
    plantAction = {
      label: `Replant ${replantCount}`,
      title: "Plant the same crops back where they last grew",
      groups: replantGroups,
      rememberSeedId: null,
      sprites: replantGroups.map((group) => cropSprite(group.seedItemId)),
    };
  } else if (showPlant && lastSeed) {
    const count = Math.min(lastSeed.quantity, plantTargets.length);
    plantAction = {
      label:
        selectionKind === "EMPTY"
          ? `Plant ${count}${count < plantTargets.length ? ` of ${plantTargets.length}` : ""}`
          : count < plantTargets.length
            ? `Plant ${count} of ${plantTargets.length}`
            : count === 1
              ? "Plant 1"
              : `Plant all ${count}`,
      title: `Plant ${lastSeed.name}`,
      groups: [
        {
          seedItemId: lastSeed.templateItemId,
          tileIndices: plantTargets.slice(0, count),
        },
      ],
      rememberSeedId: lastSeed.templateItemId,
      sprites: [cropSprite(lastSeed.templateItemId)],
    };
  }

  const previewPlant = (groups: PlantGroup[]) => {
    const map = new Map<number, string>();
    for (const group of groups)
      for (const index of group.tileIndices)
        map.set(index, seedById.get(group.seedItemId)?.sprite ?? "");
    return map;
  };
  const hoverPreview = (map: Map<number, string>) => ({
    onMouseEnter: () => setPreview(map),
    onMouseLeave: () => setPreview(null),
    onFocus: () => setPreview(map),
    onBlur: () => setPreview(null),
  });

  const hoeMissing = !hasHoe && emptyPlots.length > 0;
  const status = isHarvesting
    ? null
    : isAnyActionActive
      ? "Busy with another activity"
      : selection.length > 0
        ? `${selection.length} ${selectionKind === "READY" ? "ripe" : "empty"} plot${selection.length === 1 ? "" : "s"} selected`
        : hoeMissing
          ? "No Hoe equipped"
          : null;

  const harvestRemaining = harvest
    ? Math.max(0, Math.ceil((new Date(harvest.endsAt).getTime() - now) / 1000))
    : 0;
  const harvestProgress = harvest
    ? Math.min(
        1,
        Math.max(
          0,
          (now - new Date(harvest.startedAt).getTime()) /
            Math.max(
              1,
              new Date(harvest.endsAt).getTime() -
                new Date(harvest.startedAt).getTime(),
            ),
        ),
      )
    : 0;

  return (
    <section
      className="game-panel-flat min-w-0 overflow-hidden"
      aria-labelledby="garden-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
        <div>
          <p className="game-eyebrow">{gridSize * gridSize} growing plots</p>
          <h2 id="garden-title" className="game-section-title">
            Your garden
          </h2>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Plot summary">
          <CountChip icon={CircleDashed} label={`${emptyPlots.length} empty`} />
          <CountChip
            icon={Sprout}
            label={`${growingCount} growing`}
            className="text-primary"
          />
          <CountChip
            icon={Wheat}
            label={`${readyPlots.length} ready`}
            className={
              readyPlots.length > 0 ? "bg-xp/[0.12] text-xp" : undefined
            }
          />
          {nextReadyAt !== null ? (
            <CountChip
              icon={Sunrise}
              label={`next ${formatCompactDuration((nextReadyAt - now) / 1000)}`}
              title={`Next crop is ready at ${formatReadyClock(nextReadyAt, now)}`}
            />
          ) : null}
        </div>
      </div>

      {harvest ? (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-[10px] bg-xp/[0.08] px-3 py-2.5 sm:mx-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-xp/[0.12] text-xp">
            <PackageOpen className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <strong className="truncate text-sm">
                Harvesting {harvest.tileCount} crop
                {harvest.tileCount === 1 ? "" : "s"}
              </strong>
              <b className="shrink-0 text-xs tabular-nums text-xp">
                {formatRemaining(harvestRemaining)}
              </b>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-inset">
              <i
                className="block h-full bg-xp transition-[width] duration-1000 ease-linear"
                style={{ width: `${Math.floor(harvestProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-5">
        <button
          type="button"
          onClick={() => setSatchelOpen(true)}
          className={cn(
            "group flex h-12 shrink-0 items-center gap-2.5 rounded-[10px] pl-1.5 pr-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // Without a one-click plant, the satchel is where planting starts.
            showPlant && !plantAction && plantBlockedReason === null
              ? "bg-primary/15 text-primary hover:bg-primary/25"
              : "bg-surface-inset/70 hover:bg-secondary",
          )}
        >
          <Image
            src={SATCHEL_ART}
            alt=""
            width={48}
            height={48}
            className="h-11 w-11 object-contain transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105"
          />
          <span>
            <span className="block text-sm font-semibold">Seed satchel</span>
            <span className="block text-[11px] tabular-nums text-muted-foreground">
              {seedOptions.length === 0
                ? "Empty"
                : `${seedOptions.length} kind${seedOptions.length === 1 ? "" : "s"} · ${totalSeeds} seeds`}
            </span>
          </span>
        </button>

        <p
          className={cn(
            "min-w-0 flex-1 basis-40 text-xs",
            hoeMissing && selection.length === 0 && !isAnyActionActive
              ? "text-danger"
              : "text-muted-foreground",
          )}
        >
          {status}
          {selection.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="ml-2 inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 align-middle text-[11px] text-foreground/80 hover:bg-secondary"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </p>

        <div className="flex gap-2 max-sm:w-full">
          {plantAction ? (
            <Button
              title={plantAction.title}
              disabled={plantBlockedReason !== null || plantMutation.isPending}
              onClick={() =>
                plantMutation.mutate({
                  groups: plantAction.groups,
                  rememberSeedId: plantAction.rememberSeedId,
                })
              }
              {...hoverPreview(previewPlant(plantAction.groups))}
              variant={showHarvest ? "soft" : "default"}
              className="max-sm:flex-1"
            >
              <span className="flex -space-x-2" aria-hidden="true">
                {plantAction.sprites
                  .slice(0, 3)
                  .map((sprite, index) =>
                    sprite ? (
                      <Image
                        key={`${sprite}-${index}`}
                        src={sprite}
                        alt=""
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                      />
                    ) : null,
                  )}
              </span>
              {plantMutation.isPending ? "Planting…" : plantAction.label}
            </Button>
          ) : null}
          {showHarvest ? (
            <Button
              disabled={!canInteract || harvestMutation.isPending}
              onClick={() => harvestMutation.mutate(harvestTargets)}
              {...hoverPreview(
                new Map(harvestTargets.map((index) => [index, ""])),
              )}
              className="max-sm:flex-1"
            >
              <Wheat className="h-4 w-4" aria-hidden="true" />
              {harvestMutation.isPending
                ? "Starting…"
                : selectionKind === "READY" || harvestTargets.length === 1
                  ? `Harvest ${harvestTargets.length}`
                  : `Harvest all ${harvestTargets.length}`}
              <span className="font-normal opacity-70">
                · {formatCompactDuration(harvestSeconds)}
              </span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="px-3 pb-4 sm:px-5 sm:pb-5">
        <div
          className="gardening-grid mx-auto grid max-w-[980px] select-none grid-cols-6"
          role="group"
          aria-label="Garden plots"
          // Crop images would otherwise start a native drag and end drag-select.
          onDragStart={(event) => event.preventDefault()}
        >
          {grid.map((tile) => {
            const kind = resolvedKind(tile, now);
            const isSelected =
              selectionKind === kind && selection.includes(tile.tileIndex);
            const previewSprite = preview?.get(tile.tileIndex);
            const remaining =
              tile.state === "EMPTY"
                ? 0
                : Math.max(
                    0,
                    Math.ceil((new Date(tile.readyAt).getTime() - now) / 1000),
                  );
            const growth =
              tile.state === "EMPTY"
                ? 0
                : Math.max(
                    0,
                    Math.min(
                      1,
                      (now - new Date(tile.plantedAt).getTime()) /
                        Math.max(
                          1,
                          new Date(tile.readyAt).getTime() -
                            new Date(tile.plantedAt).getTime(),
                        ),
                    ),
                  );
            const cropName =
              tile.state === "EMPTY" ? "Empty plot" : tile.yieldItem.name;
            const description =
              tile.state === "EMPTY"
                ? "Empty plot"
                : kind === "READY"
                  ? `${cropName}, ready to harvest`
                  : `${cropName}, ready ${formatReadyClock(new Date(tile.readyAt).getTime(), now)} (${formatCompactDuration(remaining)}) · ${tile.yieldMin === tile.yieldMax ? tile.yieldMin : `${tile.yieldMin}–${tile.yieldMax}`} per plot`;
            const selectable = canInteract && kind !== "GROWING";
            return (
              <button
                key={tile.tileIndex}
                type="button"
                className={cn(
                  "gardening-plot max-sm:aspect-square",
                  kind === "GROWING" && "cursor-default",
                )}
                data-state={kind.toLowerCase()}
                data-selected={isSelected || previewSprite !== undefined}
                aria-pressed={kind === "GROWING" ? undefined : isSelected}
                aria-disabled={!selectable}
                aria-label={`Plot ${tile.tileIndex + 1}: ${description}`}
                title={description}
                disabled={!canInteract}
                onPointerDown={(event) => {
                  pointerTypeRef.current = event.pointerType;
                  if (
                    !selectable ||
                    event.pointerType !== "mouse" ||
                    event.button !== 0
                  )
                    return;
                  const add = !isSelected;
                  dragRef.current = { kind, add };
                  togglePlot(tile.tileIndex, kind, add);
                }}
                onPointerEnter={() => {
                  const drag = dragRef.current;
                  if (drag && selectable && drag.kind === kind)
                    togglePlot(tile.tileIndex, kind, drag.add);
                }}
                onClick={(event) => {
                  // Mouse presses were handled on pointer down (to allow
                  // dragging); taps and the keyboard toggle here.
                  if (pointerTypeRef.current === "mouse" && event.detail > 0)
                    return;
                  if (selectable) togglePlot(tile.tileIndex, kind, !isSelected);
                }}
              >
                <span className="absolute left-1.5 top-1 z-[3] text-[9px] tabular-nums text-muted-foreground/50 max-sm:hidden">
                  {tile.tileIndex + 1}
                </span>
                {isSelected ? (
                  <span className="absolute right-1.5 top-1.5 z-[5] grid h-[18px] w-[18px] place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" strokeWidth={2.6} />
                  </span>
                ) : null}
                {tile.state === "EMPTY" ? (
                  previewSprite ? (
                    <span className="absolute inset-[7px_7px_20px] z-[2] opacity-45">
                      <Image
                        src={previewSprite}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-contain"
                      />
                    </span>
                  ) : null
                ) : (
                  <>
                    <span
                      className="gardening-crop-art"
                      style={
                        {
                          // A fixed size: the seed sits in the soil until
                          // the plot is ripe, then the crop takes its place.
                          "--garden-growth": kind === "READY" ? 1 : 0.78,
                        } as React.CSSProperties
                      }
                    >
                      <Image
                        src={
                          kind === "READY"
                            ? tile.yieldItem.sprite
                            : tile.seed.sprite
                        }
                        alt=""
                        fill
                        sizes="96px"
                        className="object-contain"
                      />
                    </span>
                    <span
                      className={cn(
                        "absolute inset-x-1.5 bottom-1 z-[3] overflow-hidden bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)/0.82)_56%)] px-1 pb-0.5 pt-2 [text-shadow:0_1px_2px_hsl(var(--background))] max-sm:inset-x-0.5 max-sm:px-0.5 max-sm:text-center",
                        // Phones: the ripe crop art and glow say "ready".
                        kind === "READY" && "max-sm:hidden",
                      )}
                    >
                      <strong className="block truncate text-[11px] leading-tight max-sm:hidden">
                        {cropName}
                      </strong>
                      <small
                        className={cn(
                          "block truncate text-[10px] tabular-nums",
                          kind === "READY"
                            ? "font-bold uppercase text-xp"
                            : "text-muted-foreground",
                        )}
                      >
                        {kind === "READY" ? (
                          "Ready"
                        ) : (
                          <>
                            <span className="max-sm:hidden">
                              {formatCompactDuration(remaining)}
                            </span>
                            <span className="sm:hidden">
                              {formatCompactDuration(
                                remaining >= 3600
                                  ? Math.floor(remaining / 3600) * 3600
                                  : remaining,
                              ).replace(/ 0m$/, "")}
                            </span>
                          </>
                        )}
                      </small>
                    </span>
                    {kind === "GROWING" ? (
                      <span
                        className="absolute inset-x-1.5 bottom-0.5 z-[4] h-[3px] overflow-hidden rounded-full bg-border"
                        aria-hidden="true"
                      >
                        <i
                          className="block h-full bg-primary"
                          style={{ width: `${Math.floor(growth * 100)}%` }}
                        />
                      </span>
                    ) : null}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <SeedSatchelDialog
        open={satchelOpen}
        onOpenChange={setSatchelOpen}
        seeds={seedOptions}
        configs={seedConfigs}
        targetCount={plantTargets.length}
        fromSelection={selectionKind === "EMPTY"}
        blockedReason={plantBlockedReason}
        lastSeedId={lastSeed?.templateItemId ?? null}
        now={now}
        pending={plantMutation.isPending}
        onPlant={(seed, count) =>
          plantMutation.mutate({
            groups: [
              {
                seedItemId: seed.templateItemId,
                tileIndices: plantTargets.slice(0, count),
              },
            ],
            rememberSeedId: seed.templateItemId,
          })
        }
      />
    </section>
  );
}
