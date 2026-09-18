/**
 * Pure helpers for a garden harvest's tile queue (no DB access), shared by the garden
 * service and the realtime daemon. Tiles are harvested one after another; each pays
 * out when its own bar fills.
 */

/** One tile of a harvest, snapshotted at start so it survives the tile being cleared. */
export type HarvestScheduleTile = {
  tileIndex: number;
  harvestSeconds: number;
  yieldItemId: number;
  harvested: boolean;
};

/** A parsed entry; harvests started before per-tile payout only stored the tile index. */
export type ParsedHarvestTile = {
  tileIndex: number;
  harvestSeconds?: number;
  yieldItemId?: number;
  harvested: boolean;
};

export function parseHarvestSchedule(value: unknown): ParsedHarvestTile[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object") return [];
    const { tileIndex, harvestSeconds, yieldItemId, harvested } =
      entry as Record<string, unknown>;
    if (typeof tileIndex !== "number" || !Number.isInteger(tileIndex)) {
      return [];
    }

    return [
      {
        tileIndex,
        harvestSeconds:
          typeof harvestSeconds === "number" ? harvestSeconds : undefined,
        yieldItemId: typeof yieldItemId === "number" ? yieldItemId : undefined,
        harvested: harvested === true,
      },
    ];
  });
}

export function isCompleteHarvestSchedule(
  schedule: ParsedHarvestTile[],
): schedule is HarvestScheduleTile[] {
  return schedule.every(
    (tile) =>
      tile.harvestSeconds !== undefined && tile.yieldItemId !== undefined,
  );
}

/** How many tiles, in order, have finished by `now`. */
export function countFinishedHarvestTiles(
  schedule: ReadonlyArray<{ harvestSeconds: number }>,
  startedAt: Date,
  now: Date,
): number {
  // Whole seconds, matching the header's per-tile progress bar.
  const elapsedSeconds = Math.floor(
    (now.getTime() - startedAt.getTime()) / 1000,
  );

  let tileEndsAt = 0;
  let finished = 0;
  for (const tile of schedule) {
    tileEndsAt += Math.max(1, Math.floor(tile.harvestSeconds));
    if (elapsedSeconds < tileEndsAt) break;
    finished++;
  }
  return finished;
}

/** Whether a harvest has finished tiles that haven't been paid out (no transaction needed). */
export function hasDueHarvestTiles(
  harvest: { startedAt: Date; tiles: unknown },
  now = new Date(),
): boolean {
  const schedule = parseHarvestSchedule(harvest.tiles);
  // Legacy schedules need their timings backfilled, which settling does.
  if (schedule.length === 0 || !isCompleteHarvestSchedule(schedule)) {
    return true;
  }

  const finished = countFinishedHarvestTiles(schedule, harvest.startedAt, now);
  return schedule.slice(0, finished).some((tile) => !tile.harvested);
}
