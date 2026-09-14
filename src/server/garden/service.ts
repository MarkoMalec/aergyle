import { prisma } from "~/lib/prisma";
import { ItemRarity, ItemStatus, ItemType } from "~/generated/prisma/enums";
import { grantStackableItemToInventory } from "~/server/vocations/grantItem";

const GRID_SIZE = 6;
const TILE_COUNT = GRID_SIZE * GRID_SIZE;

export type GardenTileState =
  | {
      tileIndex: number;
      state: "EMPTY";
    }
  | {
      tileIndex: number;
      state: "GROWING";
      seed: { id: number; name: string; sprite: string };
      readyAt: string;
      yieldItem: { id: number; name: string; sprite: string };
      yieldMin: number;
      yieldMax: number;
      harvestSeconds: number;
    }
  | {
      tileIndex: number;
      state: "READY";
      seed: { id: number; name: string; sprite: string };
      readyAt: string;
      yieldItem: { id: number; name: string; sprite: string };
      yieldMin: number;
      yieldMax: number;
      harvestSeconds: number;
    };

export type GardenState = {
  gridSize: number;
  tiles: GardenTileState[];
  harvest:
    | null
    | {
        id: number;
        startedAt: string;
        endsAt: string;
        tileCount: number;
      };
  harvestProgress:
    | null
    | {
        progress: number;
        remainingSeconds: number;
        isComplete: boolean;
      };
};

function assertValidTileIndices(tileIndices: number[]) {
  if (!Array.isArray(tileIndices) || tileIndices.length === 0) {
    throw new Error("No tiles selected");
  }

  const unique = new Set<number>();
  for (const idx of tileIndices) {
    if (!Number.isInteger(idx)) {
      throw new Error("Invalid tile index");
    }
    if (idx < 0 || idx >= TILE_COUNT) {
      throw new Error("Tile out of bounds");
    }
    unique.add(idx);
  }

  return [...unique.values()].sort((a, b) => a - b);
}

async function assertNoGardenHarvestActive(userId: string) {
  const harvest = await prisma.userGardenHarvestActivity.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (harvest) {
    throw new Error("You already have an active gardening action");
  }
}

export async function getGardenState(userId: string): Promise<GardenState> {
  let [tiles, harvest] = await Promise.all([
    prisma.userGardenTile.findMany({
      where: { userId },
      select: {
        tileIndex: true,
        readyAt: true,
        yieldMin: true,
        yieldMax: true,
        harvestSeconds: true,
        seedItem: { select: { id: true, name: true, sprite: true } },
        yieldItem: { select: { id: true, name: true, sprite: true } },
      },
    }),
    prisma.userGardenHarvestActivity.findUnique({
      where: { userId },
      select: { id: true, startedAt: true, endsAt: true, tiles: true },
    }),
  ]);

  const now = Date.now();

  // Keep the garden UI responsive: if a harvest has ended, auto-complete it here as well
  // (grant items + clear tiles + clear activity), so the garden unlocks without requiring
  // some other polling endpoint to be hit.
  if (harvest && harvest.endsAt.getTime() <= now) {
    await getGardenHarvestStatus(userId);
    tiles = await prisma.userGardenTile.findMany({
      where: { userId },
      select: {
        tileIndex: true,
        readyAt: true,
        yieldMin: true,
        yieldMax: true,
        harvestSeconds: true,
        seedItem: { select: { id: true, name: true, sprite: true } },
        yieldItem: { select: { id: true, name: true, sprite: true } },
      },
    });
    harvest = null;
  }
  const byIndex = new Map<number, (typeof tiles)[number]>();
  for (const t of tiles) byIndex.set(t.tileIndex, t);

  const resolvedTiles: GardenTileState[] = [];
  for (let tileIndex = 0; tileIndex < TILE_COUNT; tileIndex++) {
    const row = byIndex.get(tileIndex);
    if (!row) {
      resolvedTiles.push({ tileIndex, state: "EMPTY" });
      continue;
    }

    const readyAtMs = new Date(row.readyAt).getTime();
    const state = readyAtMs <= now ? "READY" : "GROWING";

    resolvedTiles.push({
      tileIndex,
      state,
      seed: row.seedItem,
      readyAt: row.readyAt.toISOString(),
      yieldItem: row.yieldItem,
      yieldMin: row.yieldMin,
      yieldMax: row.yieldMax,
      harvestSeconds: row.harvestSeconds,
    });
  }

  if (!harvest) {
    return {
      gridSize: GRID_SIZE,
      tiles: resolvedTiles,
      harvest: null,
      harvestProgress: null,
    };
  }

  const startedAtMs = new Date(harvest.startedAt).getTime();
  const endsAtMs = new Date(harvest.endsAt).getTime();
  const durationSeconds = Math.max(1, Math.round((endsAtMs - startedAtMs) / 1000));
  const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - now) / 1000));
  const progress = Math.max(0, Math.min(1, 1 - remainingSeconds / durationSeconds));

  const tilesJson = (harvest.tiles ?? []) as Array<{ tileIndex: number }>;

  return {
    gridSize: GRID_SIZE,
    tiles: resolvedTiles,
    harvest: {
      id: harvest.id,
      startedAt: harvest.startedAt.toISOString(),
      endsAt: harvest.endsAt.toISOString(),
      tileCount: Array.isArray(tilesJson) ? tilesJson.length : 0,
    },
    harvestProgress: {
      progress,
      remainingSeconds,
      isComplete: remainingSeconds <= 0,
    },
  };
}

export async function plantSeeds(params: {
  userId: string;
  seedItemId: number;
  tileIndices: number[];
}) {
  const { userId, seedItemId } = params;
  const tileIndices = assertValidTileIndices(params.tileIndices);

  // Planting is instant, but we still disallow it during an active garden harvest.
  await assertNoGardenHarvestActive(userId);

  const seed = await prisma.item.findUnique({
    where: { id: seedItemId },
    select: {
      id: true,
      name: true,
      itemType: true,
      seedGrowSeconds: true,
      seedYieldItemId: true,
      seedYieldMin: true,
      seedYieldMax: true,
      seedHarvestSeconds: true,
      seedYieldItem: { select: { id: true, name: true, sprite: true, rarity: true } },
    },
  });

  if (!seed) throw new Error("Seed not found");
  if (seed.itemType !== ItemType.SEED) throw new Error("Item is not a seed");

  const growSeconds = seed.seedGrowSeconds ?? null;
  const yieldItemId = seed.seedYieldItemId ?? null;
  const yieldMin = seed.seedYieldMin ?? null;
  const yieldMax = seed.seedYieldMax ?? null;
  const harvestSeconds = seed.seedHarvestSeconds ?? null;

  if (!growSeconds || growSeconds <= 0) throw new Error("Seed grow time not configured");
  if (!yieldItemId) throw new Error("Seed yield item not configured");
  if (!yieldMin || yieldMin <= 0) throw new Error("Seed yield min not configured");
  if (!yieldMax || yieldMax < yieldMin) throw new Error("Seed yield max not configured");
  if (!harvestSeconds || harvestSeconds <= 0) throw new Error("Seed harvest time not configured");

  const now = new Date();
  const readyAt = new Date(now.getTime() + growSeconds * 1000);

  return await prisma.$transaction(async (tx) => {
    const existingTiles = await tx.userGardenTile.findMany({
      where: { userId, tileIndex: { in: tileIndices } },
      select: { tileIndex: true },
    });
    if (existingTiles.length > 0) {
      throw new Error("Some selected tiles are not empty");
    }

    // Consume seeds from inventory stacks.
    const inventory = await tx.inventory.findUnique({
      where: { userId },
      select: { slots: true },
    });
    if (!inventory) throw new Error("Inventory not found");

    const slots = (inventory.slots ?? []) as Array<
      { slotIndex: number; item: { id: number } | null }
    >;

    const userItems = await tx.userItem.findMany({
      where: { userId, status: ItemStatus.IN_INVENTORY },
      select: { id: true, itemId: true, quantity: true },
    });

    const userItemById = new Map<number, (typeof userItems)[number]>();
    for (const ui of userItems) userItemById.set(ui.id, { ...ui });

    let remainingToConsume = tileIndices.length;
    const updatedSlots = [...slots];
    let slotsChanged = false;

    for (let i = 0; i < updatedSlots.length && remainingToConsume > 0; i++) {
      const userItemId = updatedSlots[i]?.item?.id;
      if (typeof userItemId !== "number") continue;

      const ui = userItemById.get(userItemId);
      if (!ui) continue;
      if (ui.itemId !== seedItemId) continue;

      const take = Math.min(ui.quantity, remainingToConsume);
      remainingToConsume -= take;

      const newQty = ui.quantity - take;
      if (newQty <= 0) {
        await tx.userItem.delete({ where: { id: userItemId } });
        userItemById.delete(userItemId);
        const currentSlot = updatedSlots[i];
        if (currentSlot) updatedSlots[i] = { ...currentSlot, item: null };
        slotsChanged = true;
      } else {
        await tx.userItem.update({ where: { id: userItemId }, data: { quantity: newQty } });
        ui.quantity = newQty;
      }
    }

    if (remainingToConsume > 0) {
      throw new Error("Not enough seeds in inventory");
    }

    if (slotsChanged) {
      await tx.inventory.update({ where: { userId }, data: { slots: updatedSlots } });
    }

    await tx.userGardenTile.createMany({
      data: tileIndices.map((tileIndex) => ({
        userId,
        tileIndex,
        seedItemId: seedItemId,
        plantedAt: now,
        readyAt,
        yieldItemId,
        yieldMin,
        yieldMax,
        harvestSeconds,
      })),
    });

    return { planted: tileIndices.length };
  });
}

export async function startGardenHarvest(params: {
  userId: string;
  tileIndices: number[];
}) {
  const { userId } = params;
  const tileIndices = assertValidTileIndices(params.tileIndices);

  await assertNoGardenHarvestActive(userId);

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const tiles = await tx.userGardenTile.findMany({
      where: { userId, tileIndex: { in: tileIndices } },
      select: {
        id: true,
        tileIndex: true,
        readyAt: true,
        harvestSeconds: true,
      },
    });

    if (tiles.length !== tileIndices.length) {
      throw new Error("Some selected tiles are missing");
    }

    const notReady = tiles.find((t) => t.readyAt.getTime() > now.getTime());
    if (notReady) {
      throw new Error("Some selected tiles are not ready yet");
    }

    const byIndex = new Map<number, (typeof tiles)[number]>();
    for (const t of tiles) byIndex.set(t.tileIndex, t);

    // Harvesting time scales with the number of tiles selected.
    // If you harvest 10 tiles, total time = sum(harvestSeconds per tile).
    const durationSeconds = Math.max(
      1,
      tileIndices.reduce(
        (sum, idx) => sum + Math.max(1, byIndex.get(idx)?.harvestSeconds ?? 1),
        0,
      ),
    );

    const endsAt = new Date(now.getTime() + durationSeconds * 1000);

    const created = await tx.userGardenHarvestActivity.create({
      data: {
        userId,
        startedAt: now,
        endsAt,
        // Preserve deterministic order (tileIndices is already validated + sorted).
        tiles: tileIndices.map((tileIndex) => ({ tileIndex })),
      },
      select: { id: true, startedAt: true, endsAt: true },
    });

    return {
      id: created.id,
      startedAt: created.startedAt.toISOString(),
      endsAt: created.endsAt.toISOString(),
      tileCount: tiles.length,
    };
  });
}

export async function cancelGardenHarvest(userId: string) {
  await prisma.userGardenHarvestActivity.delete({ where: { userId } });
  return { ok: true };
}

function rollIntInclusive(min: number, max: number) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export async function getGardenHarvestStatus(userId: string) {
  const activity = await prisma.userGardenHarvestActivity.findUnique({
    where: { userId },
    select: { id: true, startedAt: true, endsAt: true, tiles: true },
  });

  if (!activity) {
    return { harvest: null, progress: null } as const;
  }

  const now = new Date();
  const startedAtMs = activity.startedAt.getTime();
  const endsAtMs = activity.endsAt.getTime();
  const durationSeconds = Math.max(1, Math.round((endsAtMs - startedAtMs) / 1000));
  const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - now.getTime()) / 1000));
  const progress = Math.max(0, Math.min(1, 1 - remainingSeconds / durationSeconds));
  const isComplete = remainingSeconds <= 0;

  // Auto-complete: when the timer is done, pay out and clear.
  if (isComplete) {
    const tilesJson = (activity.tiles ?? []) as Array<{ tileIndex: number }>;
    const tileIndices = Array.isArray(tilesJson)
      ? tilesJson
          .map((t) => t.tileIndex)
          .filter((n) => Number.isInteger(n))
      : [];

    await prisma.$transaction(async (tx) => {
      const tiles = await tx.userGardenTile.findMany({
        where: { userId, tileIndex: { in: tileIndices } },
        select: {
          id: true,
          tileIndex: true,
          yieldItemId: true,
          yieldMin: true,
          yieldMax: true,
          yieldItem: { select: { id: true, rarity: true } },
        },
      });

      // Aggregate yields by item.
      const totalsByItemId = new Map<number, { quantity: number; rarity: ItemRarity }>();
      for (const t of tiles) {
        const qty = rollIntInclusive(t.yieldMin, t.yieldMax);
        const prev = totalsByItemId.get(t.yieldItemId);
        if (prev) {
          prev.quantity += qty;
        } else {
          totalsByItemId.set(t.yieldItemId, {
            quantity: qty,
            rarity: t.yieldItem.rarity,
          });
        }
      }

      // Grant items.
      for (const [itemId, payload] of totalsByItemId.entries()) {
        await grantStackableItemToInventory({
          db: tx,
          userId,
          itemId,
          rarity: payload.rarity,
          quantity: payload.quantity,
        });
      }

      // Clear harvested tiles.
      if (tiles.length > 0) {
        await tx.userGardenTile.deleteMany({
          where: { userId, tileIndex: { in: tiles.map((t) => t.tileIndex) } },
        });
      }

      await tx.userGardenHarvestActivity.delete({ where: { userId } });
    });

    return { harvest: null, progress: null } as const;
  }

  const tilesJson = (activity.tiles ?? []) as Array<{ tileIndex: number }>;
  const tileIndices = Array.isArray(tilesJson)
    ? tilesJson
        .map((t) => t.tileIndex)
        .filter((n) => Number.isInteger(n))
    : [];

  const tileRows = await prisma.userGardenTile.findMany({
    where: { userId, tileIndex: { in: tileIndices } },
    select: {
      tileIndex: true,
      harvestSeconds: true,
      yieldItem: { select: { id: true, name: true, sprite: true } },
    },
  });

  const byIndex = new Map<number, (typeof tileRows)[number]>();
  for (const r of tileRows) byIndex.set(r.tileIndex, r);

  const tiles = tileIndices
    .map((tileIndex) => {
      const row = byIndex.get(tileIndex);
      if (!row) return null;
      return {
        tileIndex,
        harvestSeconds: Math.max(1, row.harvestSeconds),
        yieldItem: row.yieldItem,
      };
    })
    .filter(
      (t): t is { tileIndex: number; harvestSeconds: number; yieldItem: { id: number; name: string; sprite: string } } =>
        Boolean(t),
    );

  return {
    harvest: {
      id: activity.id,
      startedAt: activity.startedAt.toISOString(),
      endsAt: activity.endsAt.toISOString(),
      tileCount: tileIndices.length,
      tiles,
    },
    progress: {
      progress,
      remainingSeconds,
      isComplete,
    },
  } as const;
}
