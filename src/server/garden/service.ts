import { prisma } from "~/lib/prisma";
import { assertNoOtherActivity } from "~/server/activity";
import {
  ItemType,
  VocationalActionType,
  XpActionType,
} from "~/generated/prisma/enums";
import type { ActivityStopReason, ItemQuantityChange } from "~/realtime/events";
import {
  countFinishedHarvestTiles,
  hasDueHarvestTiles,
  parseHarvestSchedule,
  type HarvestScheduleTile,
} from "~/server/garden/harvestSchedule";
import { consumeInventoryItems } from "~/server/items/consumeItems";
import { grantStackableItemToInventory } from "~/server/items/grantItem";
import { assertRequiredToolEquipped } from "~/server/vocations/toolRules";
import { awardXp } from "~/utils/leveling";
import { awardTrackXp } from "~/utils/progression";
import { recordSkillWork } from "~/server/skills/metrics";

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
      plantedAt: string;
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
      plantedAt: string;
      readyAt: string;
      yieldItem: { id: number; name: string; sprite: string };
      yieldMin: number;
      yieldMax: number;
      harvestSeconds: number;
    };

export type GardenState = {
  gridSize: number;
  tiles: GardenTileState[];
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
  const readGarden = () =>
    Promise.all([
      prisma.userGardenTile.findMany({
        where: { userId },
        select: {
          tileIndex: true,
          plantedAt: true,
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

  let [tiles, harvest] = await readGarden();

  // Keep the garden UI responsive: pay out harvest tiles that finished since the last
  // check, so the grid shows them cleared without waiting on another endpoint.
  if (harvest && hasDueHarvestTiles(harvest)) {
    await settleGardenHarvest(userId);
    [tiles, harvest] = await readGarden();
  }

  const now = Date.now();
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
      plantedAt: row.plantedAt.toISOString(),
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
  const durationSeconds = Math.max(
    1,
    Math.round((endsAtMs - startedAtMs) / 1000),
  );
  const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - now) / 1000));
  const progress = Math.max(
    0,
    Math.min(1, 1 - remainingSeconds / durationSeconds),
  );

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
  await Promise.all([
    assertNoGardenHarvestActive(userId),
    assertNoOtherActivity(userId, "garden"),
    assertRequiredToolEquipped(userId, VocationalActionType.GARDENING),
  ]);

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
      seedXp: true,
      seedYieldItem: {
        select: { id: true, name: true, sprite: true, rarity: true },
      },
    },
  });

  if (!seed) throw new Error("Seed not found");
  if (seed.itemType !== ItemType.SEED) throw new Error("Item is not a seed");

  const growSeconds = seed.seedGrowSeconds ?? null;
  const yieldItemId = seed.seedYieldItemId ?? null;
  const yieldMin = seed.seedYieldMin ?? null;
  const yieldMax = seed.seedYieldMax ?? null;
  const harvestSeconds = seed.seedHarvestSeconds ?? null;
  const xpReward = Math.max(0, seed.seedXp ?? 1);

  if (!growSeconds || growSeconds <= 0)
    throw new Error("Seed grow time not configured");
  if (!yieldItemId) throw new Error("Seed yield item not configured");
  if (!yieldMin || yieldMin <= 0)
    throw new Error("Seed yield min not configured");
  if (!yieldMax || yieldMax < yieldMin)
    throw new Error("Seed yield max not configured");
  if (!harvestSeconds || harvestSeconds <= 0)
    throw new Error("Seed harvest time not configured");

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

    await consumeInventoryItems({
      db: tx,
      userId,
      items: [{ itemId: seedItemId, quantity: tileIndices.length }],
    });

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
        xpReward,
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

  await Promise.all([
    assertNoGardenHarvestActive(userId),
    assertNoOtherActivity(userId, "garden"),
  ]);

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    const tiles = await tx.userGardenTile.findMany({
      where: { userId, tileIndex: { in: tileIndices } },
      select: {
        id: true,
        tileIndex: true,
        readyAt: true,
        harvestSeconds: true,
        yieldItemId: true,
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

    // Preserve deterministic order (tileIndices is already validated + sorted). Each tile
    // is cleared when it pays out, so the schedule keeps what the timeline needs.
    const schedule: HarvestScheduleTile[] = tiles
      .sort((a, b) => a.tileIndex - b.tileIndex)
      .map((tile) => ({
        tileIndex: tile.tileIndex,
        harvestSeconds: Math.max(1, tile.harvestSeconds),
        yieldItemId: tile.yieldItemId,
        harvested: false,
      }));

    const created = await tx.userGardenHarvestActivity.create({
      data: {
        userId,
        startedAt: now,
        endsAt,
        tiles: schedule,
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
  // Keep the crops of tiles that already finished; the rest stay planted.
  await settleGardenHarvest(userId);
  await prisma.userGardenHarvestActivity.deleteMany({ where: { userId } });
  return { ok: true };
}

function rollIntInclusive(min: number, max: number) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi <= lo) return lo;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

export type GardenSettlement = {
  harvestedTiles: number;
  /** Crops added to the inventory, for the skill's lifetime metrics. */
  cropsHarvested: number;
  /** Growing time those crops represent, for the skill's lifetime metrics. */
  secondsHarvested: number;
  xpGained: number;
  itemChanges: ItemQuantityChange[];
  newStacks: boolean;
  /** Set when this settlement ended the harvest. */
  stopReason: ActivityStopReason | null;
};

/**
 * Pays out every harvest tile that finished since the last settlement. A tile pays its
 * whole rolled yield and is cleared; if that doesn't fit, the harvest stops and the tile
 * stays planted. Called by status checks and the realtime daemon, so keep this module
 * free of `server-only` imports.
 */
export async function settleGardenHarvest(
  userId: string,
): Promise<GardenSettlement> {
  const settlement = await prisma.$transaction(async (tx) => {
    // Status checks and the daemon can settle at the same moment; make them take turns.
    await tx.$queryRaw`SELECT id FROM UserGardenHarvestActivity WHERE userId = ${userId} FOR UPDATE`;

    const activity = await tx.userGardenHarvestActivity.findUnique({
      where: { userId },
      select: { startedAt: true, tiles: true },
    });
    if (!activity) {
      return {
        harvestedTiles: 0,
        cropsHarvested: 0,
        secondsHarvested: 0,
        xpGained: 0,
        itemChanges: [] as ItemQuantityChange[],
        newStacks: false,
        stopReason: null,
      };
    }

    const parsed = parseHarvestSchedule(activity.tiles);
    const rows = await tx.userGardenTile.findMany({
      where: {
        userId,
        tileIndex: {
          in: parsed
            .filter((tile) => !tile.harvested)
            .map((tile) => tile.tileIndex),
        },
      },
      select: {
        id: true,
        tileIndex: true,
        harvestSeconds: true,
        yieldItemId: true,
        yieldMin: true,
        yieldMax: true,
        xpReward: true,
        yieldItem: { select: { rarity: true } },
      },
    });
    const rowByIndex = new Map(rows.map((row) => [row.tileIndex, row]));

    // Harvests started before per-tile payout only stored tile indices; fill in the
    // timings from their tiles, which are still planted.
    let scheduleChanged = false;
    const schedule: HarvestScheduleTile[] = parsed.map((tile) => {
      if (tile.harvestSeconds !== undefined && tile.yieldItemId !== undefined) {
        return {
          tileIndex: tile.tileIndex,
          harvestSeconds: tile.harvestSeconds,
          yieldItemId: tile.yieldItemId,
          harvested: tile.harvested,
        };
      }
      scheduleChanged = true;
      const row = rowByIndex.get(tile.tileIndex);
      return {
        tileIndex: tile.tileIndex,
        harvestSeconds: Math.max(1, row?.harvestSeconds ?? 1),
        yieldItemId: row?.yieldItemId ?? 0,
        harvested: tile.harvested,
      };
    });

    const finished = countFinishedHarvestTiles(
      schedule,
      activity.startedAt,
      new Date(),
    );
    const itemChanges = new Map<number, number>();
    let newStacks = false;
    let xpGained = 0;
    let harvestedTiles = 0;
    let cropsHarvested = 0;
    let secondsHarvested = 0;
    let stopReason: ActivityStopReason | null = null;

    for (const tile of schedule.slice(0, finished)) {
      if (tile.harvested) continue;

      const row = rowByIndex.get(tile.tileIndex);
      if (row) {
        const quantity = rollIntInclusive(row.yieldMin, row.yieldMax);
        const grant = await grantStackableItemToInventory({
          db: tx,
          userId,
          itemId: row.yieldItemId,
          rarity: row.yieldItem.rarity,
          quantity,
          unitSize: quantity,
        });
        if (grant.addedQuantity < quantity) {
          stopReason = "INVENTORY_FULL";
          break;
        }

        for (const change of grant.itemChanges) {
          itemChanges.set(change.userItemId, change.quantity);
        }
        newStacks ||= grant.newStacks;
        cropsHarvested += quantity;
        secondsHarvested += Math.max(0, tile.harvestSeconds);
        xpGained += Math.max(0, row.xpReward);
        await tx.userGardenTile.delete({ where: { id: row.id } });
      }

      tile.harvested = true;
      harvestedTiles++;
    }

    if (stopReason !== null || schedule.every((tile) => tile.harvested)) {
      await tx.userGardenHarvestActivity.delete({ where: { userId } });
      stopReason ??= "COMPLETED";
    } else if (harvestedTiles > 0 || scheduleChanged) {
      await tx.userGardenHarvestActivity.update({
        where: { userId },
        data: { tiles: schedule },
      });
    }

    // Commit XP and metrics with the harvest itself: running them after the
    // transaction left a window where the tiles were marked harvested but the
    // XP was lost.
    if (cropsHarvested > 0 || secondsHarvested > 0) {
      await recordSkillWork({
        db: tx,
        userId,
        actionType: VocationalActionType.GARDENING,
        items: cropsHarvested,
        seconds: secondsHarvested,
      });
    }

    if (xpGained > 0) {
      await awardXp(
        userId,
        xpGained,
        XpActionType.VOCATION,
        VocationalActionType.GARDENING,
        "Gardening harvest",
        undefined,
        // Harvest ticks are high frequency; only a level-up earns an audit row.
        { db: tx, log: "levelUpOnly" },
      );
      await awardTrackXp({
        db: tx,
        userId,
        trackType: "SKILL",
        trackKey: VocationalActionType.GARDENING,
        amount: xpGained,
        description: "Gardening harvest",
      });
    }

    return {
      harvestedTiles,
      cropsHarvested,
      secondsHarvested,
      xpGained,
      itemChanges: [...itemChanges].map(([userItemId, quantity]) => ({
        userItemId,
        quantity,
      })),
      newStacks,
      stopReason,
    };
  });

  return settlement;
}

export async function getGardenHarvestStatus(userId: string) {
  const readHarvest = () =>
    prisma.userGardenHarvestActivity.findUnique({
      where: { userId },
      select: { id: true, startedAt: true, endsAt: true, tiles: true },
    });

  let activity = await readHarvest();
  if (!activity) {
    return { harvest: null, progress: null } as const;
  }

  // Pay out tiles that finished since the last check (the daemon usually got there first).
  if (hasDueHarvestTiles(activity)) {
    const settlement = await settleGardenHarvest(userId);
    activity = settlement.stopReason ? null : await readHarvest();
    if (!activity) {
      return {
        harvest: null,
        progress: null,
        completion: {
          xpGained: settlement.xpGained,
          stopReason: settlement.stopReason,
        },
      } as const;
    }
  }

  const now = new Date();
  const startedAtMs = activity.startedAt.getTime();
  const endsAtMs = activity.endsAt.getTime();
  const durationSeconds = Math.max(
    1,
    Math.round((endsAtMs - startedAtMs) / 1000),
  );
  const remainingSeconds = Math.max(
    0,
    Math.ceil((endsAtMs - now.getTime()) / 1000),
  );
  const progress = Math.max(
    0,
    Math.min(1, 1 - remainingSeconds / durationSeconds),
  );
  const isComplete = remainingSeconds <= 0;

  const schedule = parseHarvestSchedule(activity.tiles);
  const yieldItemIds = [
    ...new Set(
      schedule.flatMap((tile) =>
        tile.yieldItemId === undefined ? [] : [tile.yieldItemId],
      ),
    ),
  ];
  const yieldItems = await prisma.item.findMany({
    where: { id: { in: yieldItemIds } },
    select: { id: true, name: true, sprite: true },
  });
  const yieldItemById = new Map(yieldItems.map((item) => [item.id, item]));

  // Harvested tiles stay in the timeline so the header's per-tile bar lines up with
  // the server's schedule.
  const tiles = schedule.flatMap((tile) => {
    const yieldItem =
      tile.yieldItemId === undefined
        ? undefined
        : yieldItemById.get(tile.yieldItemId);
    if (!yieldItem) return [];
    return [
      {
        tileIndex: tile.tileIndex,
        harvestSeconds: Math.max(1, tile.harvestSeconds ?? 1),
        yieldItem,
      },
    ];
  });

  return {
    harvest: {
      id: activity.id,
      startedAt: activity.startedAt.toISOString(),
      endsAt: activity.endsAt.toISOString(),
      tileCount: schedule.length,
      tiles,
    },
    progress: {
      progress,
      remainingSeconds,
      isComplete,
    },
  } as const;
}
