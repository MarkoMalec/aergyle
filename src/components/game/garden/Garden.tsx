"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { useOptionalDndContext } from "~/components/dnd/DnDContext";
import type { InventorySlotWithItem } from "~/types/inventory";
import { useUserContext } from "~/context/userContext";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import {
  addActiveActionEventListener,
  dispatchActiveActionEvent,
} from "~/components/game/actions/activeActionEvents";

type GardenStateResponse = {
  gridSize: number;
  tiles: Array<
    | { tileIndex: number; state: "EMPTY" }
    | {
        tileIndex: number;
        state: "GROWING" | "READY";
        seed: { id: number; name: string; sprite: string };
        readyAt: string;
        yieldItem: { id: number; name: string; sprite: string };
        yieldMin: number;
        yieldMax: number;
        harvestSeconds: number;
      }
  >;
  harvest:
    | null
    | { id: number; startedAt: string; endsAt: string; tileCount: number };
  harvestProgress:
    | null
    | {
        progress: number;
        remainingSeconds: number;
        isComplete: boolean;
      };
};

function formatHms(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}h ${mm}m ${ss}s`;
}

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
  itemType: string;
  seedGrowSeconds: number | null;
  seedHarvestSeconds: number | null;
  seedYieldMin: number | null;
  seedYieldMax: number | null;
  seedYieldItem: null | { id: number; name: string; sprite: string };
};

function buildSeedOptions(inventory: InventorySlotWithItem[]): SeedOption[] {
  const byTemplate = new Map<number, SeedOption>();
  for (const slot of inventory) {
    const item = slot.item;
    if (!item) continue;
    if (item.itemType !== "SEED") continue;
    const qty = item.quantity ?? 0;
    if (qty <= 0) continue;

    const templateItemId = item.itemId;
    const prev = byTemplate.get(templateItemId);
    if (prev) {
      prev.quantity += qty;
    } else {
      byTemplate.set(templateItemId, {
        templateItemId,
        name: item.name,
        sprite: item.sprite,
        quantity: qty,
      });
    }
  }

  return [...byTemplate.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function Garden() {
  const queryClient = useQueryClient();
  const { user } = useUserContext();
  const { active: isAnyActionActive } = useVocationalActiveActionContext();
  const dnd = useOptionalDndContext();

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    return addActiveActionEventListener(() => {
      void queryClient.invalidateQueries({ queryKey: ["garden"] });
    });
  }, [queryClient]);

  const gardenQuery = useQuery({
    queryKey: ["garden"],
    queryFn: async (): Promise<GardenStateResponse> => {
      const res = await fetch("/api/garden/state", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to load garden");
      }
      return (await res.json()) as GardenStateResponse;
    },
    enabled: Boolean(user?.id),
    staleTime: 0,
  });

  // When a harvest action completes, ensure the garden state (and inventory) refreshes
  // immediately so tiles become available again without a manual reload.
  useEffect(() => {
    const harvest = gardenQuery.data?.harvest;
    if (!harvest) return;

    const endsAtMs = new Date(harvest.endsAt).getTime();
    const msToEnd = Math.max(0, endsAtMs - Date.now()) + 250;

    const t = window.setTimeout(() => {
      // Triggers the active-action provider to refresh its status too.
      dispatchActiveActionEvent({ kind: "changed" });
      void queryClient.invalidateQueries({ queryKey: ["garden"] });
      void queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() });
    }, msToEnd);

    return () => window.clearTimeout(t);
  }, [gardenQuery.data?.harvest?.endsAt, queryClient]);

  const tileByIndex = useMemo(() => {
    const map = new Map<number, GardenStateResponse["tiles"][number]>();
    for (const tile of gardenQuery.data?.tiles ?? []) {
      map.set(tile.tileIndex, tile);
    }
    return map;
  }, [gardenQuery.data?.tiles]);

  const gridSize = gardenQuery.data?.gridSize ?? 6;
  const tilesCount = gridSize * gridSize;

  const [selected, setSelected] = useState<number[]>([]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const clearSelection = useCallback(() => setSelected([]), []);

  const selectedTiles = useMemo(() => {
    return selected
      .map((idx) => tileByIndex.get(idx))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  }, [selected, tileByIndex]);

  const canInteractWithGarden = !isAnyActionActive;

  const isHarvesting = Boolean(gardenQuery.data?.harvest);

  const selectionIsAllEmpty =
    selectedTiles.length > 0 && selectedTiles.every((t) => t.state === "EMPTY");

  const selectionIsAllReady = useMemo(() => {
    if (selectedTiles.length === 0) return false;
    return selectedTiles.every((t) => {
      if (t.state === "EMPTY") return false;
      if (t.state === "READY") return true;
      const ms = new Date(t.readyAt).getTime();
      return ms <= nowMs;
    });
  }, [selectedTiles, nowMs]);

  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [selectedSeedTemplateId, setSelectedSeedTemplateId] = useState<
    number | null
  >(null);

  const needsInventory = seedDialogOpen && !dnd;
  const fallbackInventoryQuery = useQuery({
    queryKey: inventoryQueryKeys.byUser(user?.id),
    enabled: needsInventory && Boolean(user?.id),
    queryFn: async (): Promise<{ slots: InventorySlotWithItem[] }> => {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Error fetching inventory");
      }
      const data = await response.json();
      return { slots: (data.slots ?? []) as InventorySlotWithItem[] };
    },
    staleTime: 0,
  });

  const inventory = dnd?.inventory ?? fallbackInventoryQuery.data?.slots ?? [];
  const seedOptions = useMemo(() => buildSeedOptions(inventory), [inventory]);

  const selectedSeed = useMemo(() => {
    if (selectedSeedTemplateId == null) return null;
    return seedOptions.find((s) => s.templateItemId === selectedSeedTemplateId) ?? null;
  }, [seedOptions, selectedSeedTemplateId]);

  const seedConfigQuery = useQuery({
    queryKey: ["seed-config", selectedSeedTemplateId],
    enabled: seedDialogOpen && selectedSeedTemplateId != null,
    queryFn: async (): Promise<SeedConfigResponse> => {
      const id = selectedSeedTemplateId;
      if (id == null) throw new Error("No seed selected");

      const res = await fetch(`/api/items/${id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load seed config");
      return json as SeedConfigResponse;
    },
    staleTime: 0,
  });

  const plantMutation = useMutation({
    mutationFn: async (payload: { seedItemId: number; tileIndices: number[] }) => {
      const res = await fetch("/api/garden/plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to plant");
      return json as { planted: number };
    },
    onSuccess: async (data) => {
      toast.success(`Planted ${data.planted} seed${data.planted === 1 ? "" : "s"}.`);
      setSeedDialogOpen(false);
      setSelectedSeedTemplateId(null);
      clearSelection();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      ]);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to plant");
    },
  });

  const harvestMutation = useMutation({
    mutationFn: async (tileIndices: number[]) => {
      const res = await fetch("/api/garden/harvest/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileIndices }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to harvest");
      return json as { harvest: { id: number } };
    },
    onSuccess: async () => {
      dispatchActiveActionEvent({ kind: "changed" });
      clearSelection();
      await queryClient.invalidateQueries({ queryKey: ["garden"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to harvest");
    },
  });

  const handleTileClick = useCallback(
    (tileIndex: number, ev: React.MouseEvent) => {
      if (!canInteractWithGarden) return;
      if (isHarvesting) return;

      const tile = tileByIndex.get(tileIndex);
      if (!tile) return;

      const isShift = ev.shiftKey;

      const getKind = (t: GardenStateResponse["tiles"][number]) => {
        if (t.state === "EMPTY") return "EMPTY" as const;
        if (t.state === "READY") return "READY" as const;
        const ms = new Date(t.readyAt).getTime();
        return ms <= Date.now() ? ("READY" as const) : ("GROWING" as const);
      };

      const clickedKind = getKind(tile);

      setSelected((prev) => {
        const prevTiles = prev
          .map((idx) => tileByIndex.get(idx))
          .filter((t): t is NonNullable<typeof t> => Boolean(t));

        const prevKinds = new Set(prevTiles.map(getKind));
        const prevSelectionKind =
          prevKinds.size === 1 ? ([...prevKinds][0] as ReturnType<typeof getKind>) : null;

        const shouldAdditivelyToggle =
          !isShift &&
          prev.length > 0 &&
          prevSelectionKind != null &&
          (prevSelectionKind === "READY" || prevSelectionKind === "EMPTY") &&
          clickedKind === prevSelectionKind;

        if (isShift || shouldAdditivelyToggle) {
          const set = new Set(prev);
          if (set.has(tileIndex)) set.delete(tileIndex);
          else set.add(tileIndex);
          return [...set.values()].sort((a, b) => a - b);
        }

        return [tileIndex];
      });
    },
    [
      canInteractWithGarden,
      isHarvesting,
      tileByIndex,
      setSelected,
      clearSelection,
    ],
  );

  const openSeedsDialog = () => {
    setSelectedSeedTemplateId(null);
    setSeedDialogOpen(true);
  };

  const canPlant =
    selectionIsAllEmpty &&
    selected.length > 0 &&
    selectedSeed != null &&
    selectedSeed.quantity >= selected.length &&
    !plantMutation.isPending;

  const plantSelected = async () => {
    if (!selectedSeed) return;
    await plantMutation.mutateAsync({
      seedItemId: selectedSeed.templateItemId,
      tileIndices: selected,
    });
  };

  const canHarvest =
    selectionIsAllReady &&
    selected.length > 0 &&
    !isHarvesting &&
    canInteractWithGarden &&
    !harvestMutation.isPending;

  const harvestSelected = async () => {
    await harvestMutation.mutateAsync(selected);
  };


  const grid = useMemo(() => {
    const arr: GardenStateResponse["tiles"] = [];
    for (let i = 0; i < tilesCount; i++) {
      arr.push(tileByIndex.get(i) ?? { tileIndex: i, state: "EMPTY" });
    }
    return arr;
  }, [tileByIndex, tilesCount]);

  const harvestBanner = gardenQuery.data?.harvest
    ? (() => {
        const endsAtMs = new Date(gardenQuery.data.harvest.endsAt).getTime();
        const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
        return `Harvesting… ${formatHms(remainingSeconds)}`;
      })()
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          6×6 garden
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!selectionIsAllEmpty || selected.length === 0 || isHarvesting || !canInteractWithGarden}
            onClick={openSeedsDialog}
          >
            Seeds
          </Button>
        </div>
      </div>

      {harvestBanner ? (
        <div className="rounded-md border bg-background px-3 py-2 text-sm">
          {harvestBanner}
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-2",
          gridSize === 6 ? "grid-cols-6" : "grid-cols-6",
        )}
      >
        {grid.map((tile) => {
          const isSelected = selectedSet.has(tile.tileIndex);

          const readyAtMs =
            tile.state === "EMPTY" ? null : new Date(tile.readyAt).getTime();
          const isReady =
            tile.state === "READY" ||
            (tile.state === "GROWING" && readyAtMs != null && readyAtMs <= nowMs);
          const isGrowing = tile.state === "GROWING";
          const remainingGrowSeconds =
            readyAtMs == null ? null : Math.max(0, Math.ceil((readyAtMs - nowMs) / 1000));

          const showSprite =
            tile.state === "EMPTY"
              ? null
              : isReady
                ? tile.yieldItem.sprite
                : tile.seed.sprite;

          const title =
            tile.state === "EMPTY"
              ? "Empty"
              : isReady
                ? `Ready: ${tile.yieldItem.name}`
                : `Growing: ${tile.seed.name}`;

          return (
            <button
              key={tile.tileIndex}
              type="button"
              title={title}
              aria-pressed={isSelected}
              className={cn(
                "relative aspect-square rounded-md border p-1 text-left",
                isSelected ? "bg-accent ring-2 ring-primary" : "bg-background hover:bg-accent",
                !canInteractWithGarden || isHarvesting ? "opacity-60" : "",
              )}
              onClick={(ev) => handleTileClick(tile.tileIndex, ev)}
              disabled={!canInteractWithGarden || isHarvesting}
            >
              {isSelected ? (
                <div className="absolute right-1 top-1 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-foreground">
                  ✓
                </div>
              ) : null}

              {showSprite ? (
                <div className="relative h-full w-full">
                  <Image
                    src={showSprite}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className="h-full w-full" />
              )}

              {isGrowing && remainingGrowSeconds != null ? (
                <div className="absolute bottom-1 left-1 right-1 rounded bg-background/80 px-1 py-0.5 text-[10px] text-muted-foreground">
                  {formatHms(remainingGrowSeconds)}
                </div>
              ) : null}

              {isReady ? (
                <div className="absolute bottom-1 left-1 right-1 rounded bg-background/80 px-1 py-0.5 text-[10px]">
                  Ready
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && selectionIsAllReady ? (
        <div className="flex items-center gap-2">
          <Button type="button" onClick={harvestSelected} disabled={!canHarvest}>
            Harvest
          </Button>
        </div>
      ) : null}

      <Dialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Seeds</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Select a seed to plant on {selected.length} tile{selected.length === 1 ? "" : "s"}.
            </div>

            {seedOptions.length === 0 ? (
              <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                You have no seeds in your inventory.
              </div>
            ) : (
              <div className="grid gap-2">
                {seedOptions.map((s) => (
                  <button
                    key={s.templateItemId}
                    type="button"
                    className={cn(
                      "flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm",
                      selectedSeedTemplateId === s.templateItemId ? "ring-2 ring-primary" : "",
                    )}
                    onClick={() => setSelectedSeedTemplateId(s.templateItemId)}
                  >
                    <span className="flex items-center gap-2">
                      <Image
                        src={s.sprite}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 object-contain"
                      />
                      <span className="font-medium">{s.name}</span>
                    </span>

                    <span className="text-muted-foreground">{s.quantity}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedSeedTemplateId != null ? (
              <div className="rounded-md border bg-background p-3 text-sm">
                {seedConfigQuery.isLoading ? (
                  <div className="text-muted-foreground">Loading seed details…</div>
                ) : seedConfigQuery.isError ? (
                  <div className="text-destructive">
                    {seedConfigQuery.error instanceof Error
                      ? seedConfigQuery.error.message
                      : "Failed to load seed details"}
                  </div>
                ) : seedConfigQuery.data ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Image
                          src={seedConfigQuery.data.sprite}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 object-contain"
                        />
                        <div className="font-medium">{seedConfigQuery.data.name}</div>
                      </div>
                      <div className="text-muted-foreground">
                        Uses {selected.length} seed{selected.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="grid gap-1 text-muted-foreground">
                      <div>
                        Grow time: {seedConfigQuery.data.seedGrowSeconds != null
                          ? formatHms(seedConfigQuery.data.seedGrowSeconds)
                          : "—"}
                      </div>
                      <div>
                        Harvest time (per tile): {seedConfigQuery.data.seedHarvestSeconds != null
                          ? formatHms(seedConfigQuery.data.seedHarvestSeconds)
                          : "—"}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Yield:</span>
                        {seedConfigQuery.data.seedYieldItem ? (
                          <span className="inline-flex items-center gap-2 text-white/80">
                            <Image
                              src={seedConfigQuery.data.seedYieldItem.sprite}
                              alt=""
                              width={18}
                              height={18}
                              className="h-4.5 w-4.5 object-contain"
                            />
                            <span>
                              {seedConfigQuery.data.seedYieldMin ?? "?"}–{seedConfigQuery.data.seedYieldMax ?? "?"} {seedConfigQuery.data.seedYieldItem.name}
                            </span>
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </div>

                      {seedConfigQuery.data.seedYieldMin != null && seedConfigQuery.data.seedYieldMax != null ? (
                        <div>
                          Total yield (selected): {seedConfigQuery.data.seedYieldMin * selected.length}–{seedConfigQuery.data.seedYieldMax * selected.length}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {selectedSeed && selectedSeed.quantity < selected.length ? (
              <div className="text-sm text-destructive">
                Not enough seeds: need {selected.length}, have {selectedSeed.quantity}.
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSeedDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={plantSelected} disabled={!canPlant}>
              Plant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
