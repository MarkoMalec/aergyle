import type { ItemRarity } from "~/generated/prisma/enums";
import type { InventorySlotWithItem } from "~/types/inventory";

export type GardenTile =
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

export type GardenStateResponse = {
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

export type SeedOption = {
  templateItemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

export type SeedConfigResponse = {
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

/** One plant request: a single seed type into some empty plots. */
export type PlantGroup = { seedItemId: number; tileIndices: number[] };

export type PlotKind = "EMPTY" | "GROWING" | "READY";

/** A plot's time on a small tile: "2h 5m", "5m" or "40s". */
export function formatCompactDuration(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total % 60}s`;
}

/** A ready time in local wall-clock terms: day is null today, else "tomorrow" or "Sat". */
export function readyClockParts(readyAtMs: number, now: number) {
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(readyAtMs);
  const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0);
  const days = Math.round(
    (startOfDay(readyAtMs) - startOfDay(now)) / 86_400_000,
  );
  const day =
    days <= 0
      ? null
      : days === 1
        ? "tomorrow"
        : new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
            readyAtMs,
          );
  return { day, time };
}

/** "21:45", "tomorrow 03:10", "Sat 09:00". */
export function formatReadyClock(readyAtMs: number, now: number) {
  const { day, time } = readyClockParts(readyAtMs, now);
  return day ? `${day} ${time}` : time;
}

export function buildSeedOptions(inventory: InventorySlotWithItem[]) {
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
        rarity: item.rarity,
        quantity: item.quantity ?? 0,
      });
    }
  }
  return [...byTemplate.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function resolvedKind(tile: GardenTile, now: number): PlotKind {
  if (tile.state === "EMPTY") return "EMPTY";
  return tile.state === "READY" || new Date(tile.readyAt).getTime() <= now
    ? "READY"
    : "GROWING";
}

/** "Tomato seeds" -> "Tomato", for when the crop item isn't loaded. */
export function cropNameOf(seed: SeedOption, config?: SeedConfigResponse) {
  return config?.seedYieldItem?.name ?? seed.name.replace(/ seeds?$/i, "");
}

export async function fetchSeedConfig(
  seedItemId: number,
): Promise<SeedConfigResponse> {
  const response = await fetch(`/api/items/${seedItemId}`, {
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
}

/**
 * Per-device memory, keyed by player: the last seed planted and which seed
 * last grew in each plot (so a harvested garden can be replanted in one go).
 * Storage can be missing or blocked; the garden works without it.
 */
export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the memory is a convenience only.
  }
}
