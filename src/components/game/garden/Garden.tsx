"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleDashed,
  Clock3,
  PackageOpen,
  Sprout,
  Wheat,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import { gardenQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import { useOptionalDndContext } from "~/components/dnd/DnDContext";
import type { InventorySlotWithItem } from "~/types/inventory";
import { useUserContext } from "~/context/userContext";
import { formatRemaining } from "~/components/game/actions/format";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import {
  addActiveActionEventListener,
  dispatchActiveActionEvent,
} from "~/components/game/actions/activeActionEvents";
import { dispatchSkillProgressEvent } from "~/components/game/skills/skillProgressEvents";
import { ItemInfoPopover } from "~/components/game/items/ItemInfoPopover";
import type { ItemRarity } from "~/generated/prisma/enums";

type GardenTile =
  | { tileIndex: number; state: "EMPTY" }
  | {
      tileIndex: number;
      state: "GROWING" | "READY";
      seed: { id: number; name: string; sprite: string };
      plantedAt: string;
      readyAt: string;
      yieldItem: { id: number; name: string; sprite: string };
      yieldMin: number;
      yieldMax: number;
      harvestSeconds: number;
    };

type GardenStateResponse = {
  gridSize: number;
  tiles: GardenTile[];
  harvest: null | {
    id: number;
    startedAt: string;
    endsAt: string;
    tileCount: number;
  };
  harvestProgress: null | {
    progress: number;
    remainingSeconds: number;
    isComplete: boolean;
  };
};

type SeedOption = {
  templateItemId: number;
  name: string;
  sprite: string;
  quantity: number;
};
type SeedConfigResponse = {
  id: number;
  name: string;
  sprite: string;
  seedGrowSeconds: number | null;
  seedHarvestSeconds: number | null;
  seedYieldMin: number | null;
  seedYieldMax: number | null;
  seedXp: number | null;
  seedYieldItem: null | {
    id: number;
    name: string;
    sprite: string;
    rarity: ItemRarity;
  };
};

/** A plot's time on a small tile: "2h 5m", "5m" or "40s". */
function formatCompactDuration(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total % 60}s`;
}

function buildSeedOptions(inventory: InventorySlotWithItem[]) {
  const byTemplate = new Map<number, SeedOption>();
  for (const slot of inventory) {
    const item = slot.item;
    if (!item || item.itemType !== "SEED" || (item.quantity ?? 0) <= 0)
      continue;
    const current = byTemplate.get(item.itemId);
    if (current) current.quantity += item.quantity ?? 0;
    else {
      byTemplate.set(item.itemId, {
        templateItemId: item.itemId,
        name: item.name,
        sprite: item.sprite,
        quantity: item.quantity ?? 0,
      });
    }
  }
  return [...byTemplate.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function resolvedKind(tile: GardenTile, now: number) {
  if (tile.state === "EMPTY") return "EMPTY" as const;
  return tile.state === "READY" || new Date(tile.readyAt).getTime() <= now
    ? ("READY" as const)
    : ("GROWING" as const);
}

export default function Garden() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();
  const { active: isAnyActionActive } = useVocationalActiveActionContext();
  const dnd = useOptionalDndContext();
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedSeedTemplateId, setSelectedSeedTemplateId] = useState<
    number | null
  >(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

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
  const selectedSeed =
    seedOptions.find(
      (seed) => seed.templateItemId === selectedSeedTemplateId,
    ) ?? null;

  useEffect(() => {
    if (selectedSeedTemplateId === null && seedOptions[0]) {
      setSelectedSeedTemplateId(seedOptions[0].templateItemId);
    } else if (
      selectedSeedTemplateId !== null &&
      seedOptions.length > 0 &&
      !seedOptions.some(
        (seed) => seed.templateItemId === selectedSeedTemplateId,
      )
    ) {
      setSelectedSeedTemplateId(seedOptions[0]?.templateItemId ?? null);
    }
  }, [seedOptions, selectedSeedTemplateId]);

  const seedConfigQuery = useQuery({
    queryKey: gardenQueryKeys.seedConfig(selectedSeedTemplateId),
    enabled: selectedSeedTemplateId !== null,
    queryFn: async (): Promise<SeedConfigResponse> => {
      const response = await fetch(`/api/items/${selectedSeedTemplateId}`, {
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as
        | SeedConfigResponse
        | { error?: string }
        | null;
      if (!response.ok || !body || "error" in body) {
        throw new Error(
          body && "error" in body ? body.error : "Failed to load seed details",
        );
      }
      return body as SeedConfigResponse;
    },
  });

  const tiles = useMemo(
    () => gardenQuery.data?.tiles ?? [],
    [gardenQuery.data?.tiles],
  );
  const tileByIndex = useMemo(
    () => new Map(tiles.map((tile) => [tile.tileIndex, tile])),
    [tiles],
  );
  const gridSize = gardenQuery.data?.gridSize ?? 6;
  const grid = useMemo(
    () =>
      Array.from(
        { length: gridSize * gridSize },
        (_, tileIndex) =>
          tileByIndex.get(tileIndex) ??
          ({ tileIndex, state: "EMPTY" } as const),
      ),
    [gridSize, tileByIndex],
  );
  const counts = useMemo(
    () =>
      grid.reduce(
        (result, tile) => {
          result[resolvedKind(tile, now)] += 1;
          return result;
        },
        { EMPTY: 0, GROWING: 0, READY: 0 },
      ),
    [grid, now],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedTiles = selected.map(
    (index) =>
      tileByIndex.get(index) ?? ({ tileIndex: index, state: "EMPTY" } as const),
  );
  const selectedKinds = new Set(
    selectedTiles.map((tile) => resolvedKind(tile, now)),
  );
  const selectionKind = selectedKinds.size === 1 ? [...selectedKinds][0] : null;
  const isHarvesting = Boolean(gardenQuery.data?.harvest);
  const canInteract = !isAnyActionActive && !isHarvesting;

  const selectKind = useCallback(
    (kind: "EMPTY" | "READY") => {
      if (!canInteract) return;
      setSelected(
        grid
          .filter((tile) => resolvedKind(tile, Date.now()) === kind)
          .map((tile) => tile.tileIndex),
      );
    },
    [canInteract, grid],
  );

  const handleTileClick = useCallback(
    (tile: GardenTile) => {
      if (!canInteract) return;
      const kind = resolvedKind(tile, Date.now());
      if (kind === "GROWING") {
        setSelected([tile.tileIndex]);
        return;
      }
      setSelected((previous) => {
        const previousKinds = new Set(
          previous.map((index) =>
            resolvedKind(
              tileByIndex.get(index) ??
                ({ tileIndex: index, state: "EMPTY" } as const),
              Date.now(),
            ),
          ),
        );
        if (previousKinds.size !== 1 || !previousKinds.has(kind))
          return [tile.tileIndex];
        const next = new Set(previous);
        if (next.has(tile.tileIndex)) next.delete(tile.tileIndex);
        else next.add(tile.tileIndex);
        return [...next].sort((a, b) => a - b);
      });
    },
    [canInteract, tileByIndex],
  );

  const plantMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSeed) throw new Error("Choose a seed first");
      const response = await fetch("/api/garden/plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedItemId: selectedSeed.templateItemId,
          tileIndices: selected,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        planted?: number;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Failed to plant");
      return body?.planted ?? selected.length;
    },
    onSuccess: async (planted) => {
      toast.success(`Planted ${planted} plot${planted === 1 ? "" : "s"}`);
      setSelected([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: gardenQueryKeys.all() }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to plant"),
  });

  const harvestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/garden/harvest/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileIndices: selected }),
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
      dispatchActiveActionEvent({ kind: "changed" });
      await queryClient.invalidateQueries({ queryKey: gardenQueryKeys.all() });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to harvest"),
  });

  if (gardenQuery.isLoading)
    return (
      <div className="game-panel game-empty-state">
        Walking out to the garden…
      </div>
    );
  if (gardenQuery.isError) {
    return (
      <div className="game-panel game-empty-state">
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

  const canPlant =
    canInteract &&
    selectionKind === "EMPTY" &&
    selected.length > 0 &&
    selectedSeed !== null &&
    selectedSeed.quantity >= selected.length &&
    !plantMutation.isPending;
  const canHarvest =
    canInteract &&
    selectionKind === "READY" &&
    selected.length > 0 &&
    !harvestMutation.isPending;
  const harvestRemaining = gardenQuery.data?.harvest
    ? Math.max(
        0,
        Math.ceil(
          (new Date(gardenQuery.data.harvest.endsAt).getTime() - now) / 1000,
        ),
      )
    : 0;

  return (
    <div className="gardening-layout">
      <section
        className="game-panel gardening-stage"
        aria-labelledby="garden-title"
      >
        <div className="gardening-header">
          <div>
            <p className="game-eyebrow">Thirty-six growing plots</p>
            <h2 id="garden-title" className="game-section-title">
              Your garden
            </h2>
          </div>
          <div className="gardening-counts" aria-label="Plot summary">
            <span data-kind="empty">
              <CircleDashed /> {counts.EMPTY} empty
            </span>
            <span data-kind="growing">
              <Sprout /> {counts.GROWING} growing
            </span>
            <span data-kind="ready">
              <Wheat /> {counts.READY} ready
            </span>
          </div>
        </div>

        {gardenQuery.data?.harvest ? (
          <div className="gardening-harvest-banner">
            <span>
              <PackageOpen aria-hidden="true" />
            </span>
            <div>
              <strong>Harvesting the ripe plots</strong>
              <small>
                {gardenQuery.data.harvest.tileCount} crops are being packed into
                your inventory.
              </small>
            </div>
            <b>{formatRemaining(harvestRemaining)}</b>
          </div>
        ) : null}

        <div className="gardening-toolbar">
          <p>
            {selected.length === 0
              ? "Choose matching plots to act on them together."
              : `${selected.length} ${selectionKind?.toLowerCase() ?? "mixed"} plot${selected.length === 1 ? "" : "s"} selected`}
          </p>
          <div>
            <Button
              size="sm"
              variant="ghost"
              disabled={!canInteract || counts.EMPTY === 0}
              onClick={() => selectKind("EMPTY")}
            >
              Select empty
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!canInteract || counts.READY === 0}
              onClick={() => selectKind("READY")}
            >
              Select ready
            </Button>
            {selected.length > 0 ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Clear plot selection"
                onClick={() => setSelected([])}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="gardening-grid-scroll">
          <div className="game-garden-grid gardening-grid">
            {grid.map((tile) => {
              const kind = resolvedKind(tile, now);
              const selectedTile = selectedSet.has(tile.tileIndex);
              const remaining =
                tile.state === "EMPTY"
                  ? 0
                  : Math.max(
                      0,
                      Math.ceil(
                        (new Date(tile.readyAt).getTime() - now) / 1000,
                      ),
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
              return (
                <button
                  key={tile.tileIndex}
                  type="button"
                  className="game-garden-tile gardening-plot"
                  data-state={kind.toLowerCase()}
                  data-selected={selectedTile}
                  aria-pressed={selectedTile}
                  aria-label={`Plot ${tile.tileIndex + 1}: ${kind === "EMPTY" ? "empty" : kind === "READY" ? `${cropName}, ready to harvest` : `${cropName}, ${formatCompactDuration(remaining)} remaining`}`}
                  disabled={!canInteract}
                  onClick={() => handleTileClick(tile)}
                >
                  <span className="gardening-plot-number">
                    {tile.tileIndex + 1}
                  </span>
                  {selectedTile ? (
                    <span className="gardening-plot-check">
                      <Check />
                    </span>
                  ) : null}
                  {tile.state === "EMPTY" ? (
                    <span className="gardening-empty-mark">
                      <span />
                      <small>Empty</small>
                    </span>
                  ) : (
                    <>
                      <span
                        className="gardening-crop-art"
                        style={
                          {
                            "--garden-growth": Math.max(0.48, growth),
                          } as React.CSSProperties
                        }
                      >
                        <Image
                          src={tile.yieldItem.sprite}
                          alt=""
                          fill
                          sizes="72px"
                          className="object-contain"
                        />
                      </span>
                      <span className="gardening-plot-label">
                        <strong>{cropName}</strong>
                        <small>
                          {kind === "READY"
                            ? "Ready"
                            : formatCompactDuration(remaining)}
                        </small>
                      </span>
                      {kind === "GROWING" ? (
                        <span
                          className="gardening-growth-track"
                          aria-hidden="true"
                        >
                          <i
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
      </section>

      <aside
        className="game-panel gardening-seed-shelf"
        aria-labelledby="seed-shelf-title"
      >
        <div className="game-panel-header">
          <div>
            <p className="game-eyebrow">Seed satchel</p>
            <h2 id="seed-shelf-title" className="game-section-title">
              What to plant next
            </h2>
          </div>
        </div>
        <div className="game-panel-body">
          {seedOptions.length === 0 ? (
            <div className="gardening-no-seeds">
              <Sprout aria-hidden="true" />
              <strong>Your seed satchel is empty</strong>
              <p>
                Seeds found or purchased will appear here, ready for any empty
                plot.
              </p>
            </div>
          ) : (
            <div className="gardening-seed-list">
              {seedOptions.map((seed) => (
                <button
                  type="button"
                  key={seed.templateItemId}
                  data-selected={selectedSeedTemplateId === seed.templateItemId}
                  onClick={() => setSelectedSeedTemplateId(seed.templateItemId)}
                >
                  <span>
                    <Image src={seed.sprite} alt="" width={46} height={46} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong>{seed.name.replace(/ seeds$/i, "")}</strong>
                    <small>
                      {seed.quantity} seed{seed.quantity === 1 ? "" : "s"}{" "}
                      available
                    </small>
                  </span>
                  {selectedSeedTemplateId === seed.templateItemId ? (
                    <Check />
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {selectedSeed && seedConfigQuery.data ? (
            <div className="gardening-seed-details">
              <div>
                {seedConfigQuery.data.seedYieldItem ? (
                  <ItemInfoPopover
                    itemId={seedConfigQuery.data.seedYieldItem.id}
                    rarity={seedConfigQuery.data.seedYieldItem.rarity}
                    name={seedConfigQuery.data.seedYieldItem.name}
                  >
                    <Image
                      src={seedConfigQuery.data.seedYieldItem.sprite}
                      alt=""
                      width={62}
                      height={62}
                    />
                  </ItemInfoPopover>
                ) : (
                  <Image
                    src={selectedSeed.sprite}
                    alt=""
                    width={62}
                    height={62}
                  />
                )}
                <span>
                  <p className="game-eyebrow">Expected crop</p>
                  <strong>
                    {seedConfigQuery.data.seedYieldItem?.name ??
                      selectedSeed.name}
                  </strong>
                </span>
              </div>
              <dl>
                <div>
                  <dt>
                    <Clock3 /> Grows in
                  </dt>
                  <dd>
                    {seedConfigQuery.data.seedGrowSeconds
                      ? formatCompactDuration(
                          seedConfigQuery.data.seedGrowSeconds,
                        )
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <PackageOpen /> Per plot
                  </dt>
                  <dd>
                    {seedConfigQuery.data.seedYieldMin ?? "?"}–
                    {seedConfigQuery.data.seedYieldMax ?? "?"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Wheat /> Gardening XP
                  </dt>
                  <dd>+{seedConfigQuery.data.seedXp ?? 1}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div
            className="gardening-action-card"
            data-kind={selectionKind?.toLowerCase() ?? "none"}
          >
            {selected.length === 0 ? (
              <p>
                Select one or more empty plots to plant, or ripe plots to
                harvest.
              </p>
            ) : selectionKind === "GROWING" ? (
              <p>
                That crop is still growing. Its plot timer shows when it will be
                ready.
              </p>
            ) : selectionKind === "EMPTY" ? (
              <>
                <div>
                  <strong>
                    Plant {selected.length} plot
                    {selected.length === 1 ? "" : "s"}
                  </strong>
                  <small>
                    {selectedSeed
                      ? `${selectedSeed.name} · ${selectedSeed.quantity} owned`
                      : "Choose a seed"}
                  </small>
                </div>
                <Button
                  className="w-full"
                  disabled={!canPlant}
                  onClick={() => plantMutation.mutate()}
                >
                  <Sprout className="mr-2 h-4 w-4" />
                  {plantMutation.isPending
                    ? "Planting…"
                    : "Plant selected plots"}
                </Button>
                {selectedSeed && selectedSeed.quantity < selected.length ? (
                  <p className="text-destructive">
                    You need {selected.length - selectedSeed.quantity} more seed
                    {selected.length - selectedSeed.quantity === 1 ? "" : "s"}.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <div>
                  <strong>
                    {selected.length} crop
                    {selected.length === 1 ? " is" : "s are"} ready
                  </strong>
                  <small>Harvest time is based on the selected plots.</small>
                </div>
                <Button
                  className="w-full"
                  disabled={!canHarvest}
                  onClick={() => harvestMutation.mutate()}
                >
                  <Wheat className="mr-2 h-4 w-4" />
                  {harvestMutation.isPending
                    ? "Preparing…"
                    : "Harvest selected crops"}
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
