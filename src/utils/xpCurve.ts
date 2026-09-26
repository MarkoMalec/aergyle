import { buildCurve, type CurveDesign } from "~/game/balance/curve";

/**
 * The cumulative-XP level curve shared by the character level
 * (LevelXpThreshold) and every progression track (TrackXpThreshold). Both
 * tables are written only when an admin saves a curve on /admin/leveling.
 */

export type ThresholdRow = { level: number; xpTotal: bigint };

/** How stale a process's copy of a curve may get after an admin edit. */
export const CURVE_REFRESH_MS = 30_000;

/** Threshold rows for a design, for a database whose table is still empty. */
export function thresholdRowsFromDesign(design: CurveDesign): ThresholdRow[] {
  return buildCurve(design)
    .totals.slice(1)
    .map((total, index) => ({ level: index + 1, xpTotal: BigInt(total) }));
}
export type XpCurve = { byXp: ThresholdRow[]; byLevel: Map<number, bigint> };

export type LevelProgress = {
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  xpProgress: number; // 0-100 percentage
  xpRemaining: number;
};

export function clampToSafeNumber(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = -max;
  if (value > max) return Number.MAX_SAFE_INTEGER;
  if (value < min) return -Number.MAX_SAFE_INTEGER;
  return Number(value);
}

/** `rows` must be ordered by xpTotal ascending. */
export function toXpCurve(rows: ThresholdRow[]): XpCurve {
  return {
    byXp: rows,
    byLevel: new Map(rows.map((row) => [row.level, row.xpTotal])),
  };
}

/** Highest level whose cumulative requirement is already met. */
export function levelForTotalXp(curve: XpCurve, totalXp: bigint): number {
  if (totalXp <= 0n) return 1;
  const rows = curve.byXp;
  let lo = 0;
  let hi = rows.length - 1;
  let level = 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid];
    if (row && row.xpTotal <= totalXp) {
      level = row.level;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return level;
}

export function xpTotalForLevel(curve: XpCurve, level: number): bigint {
  if (level <= 1) return 0n;
  return curve.byLevel.get(level) ?? 0n;
}

/**
 * Progress through the current level. Without a (level + 1) row the player is
 * at the top of the generated curve, which reads as full rather than erroring.
 */
export function levelProgress(
  curve: XpCurve,
  level: number,
  totalXp: bigint,
): LevelProgress {
  const levelStartTotal = xpTotalForLevel(curve, level);
  const nextLevelStartTotal = curve.byLevel.get(level + 1);

  if (nextLevelStartTotal === undefined) {
    return {
      level,
      currentXp: clampToSafeNumber(totalXp - levelStartTotal),
      xpForNextLevel: 0,
      xpProgress: 100,
      xpRemaining: 0,
    };
  }

  const xpForNextLevelBig = nextLevelStartTotal - levelStartTotal;
  const xpIntoLevelBig = totalXp - levelStartTotal;
  const xpRemainingBig =
    nextLevelStartTotal > totalXp ? nextLevelStartTotal - totalXp : 0n;

  // Percentage in BigInt math (2dp), which avoids float overflow.
  const progressTimes100 =
    xpForNextLevelBig > 0n
      ? Number((xpIntoLevelBig * 10000n) / xpForNextLevelBig)
      : 0;

  return {
    level,
    currentXp: clampToSafeNumber(xpIntoLevelBig),
    xpForNextLevel: clampToSafeNumber(xpForNextLevelBig),
    xpProgress: Math.min(100, Math.max(0, progressTimes100 / 100)),
    xpRemaining: clampToSafeNumber(xpRemainingBig),
  };
}

/**
 * Caches each key's load and reloads it in the background once it is older
 * than `maxAgeMs`. Every process (the web server and the realtime daemon)
 * picks up an admin curve edit within that time, and hot paths never wait on
 * a reload. Concurrent callers share one in-flight load instead of racing.
 * `invalidate` drops everything, for the process that made the edit.
 */
export function refreshingCache<V, K = void>(
  load: (key: K) => Promise<V>,
  maxAgeMs: number,
): ((key: K) => Promise<V>) & { invalidate: () => void } {
  const loaded = new Map<K, { value: V; at: number }>();
  const pending = new Map<K, Promise<V>>();
  let generation = 0;

  const refresh = (key: K) => {
    let load$ = pending.get(key);
    if (!load$) {
      const started = generation;
      load$ = load(key)
        .then((value) => {
          // A load that began before an invalidation carries old data.
          if (started === generation) loaded.set(key, { value, at: Date.now() });
          return value;
        })
        .finally(() => pending.delete(key));
      pending.set(key, load$);
    }
    return load$;
  };

  const get = async (key: K) => {
    const entry = loaded.get(key);
    if (!entry) return refresh(key);
    if (Date.now() - entry.at > maxAgeMs) {
      // The stale copy answers this call; a failed reload retries next time.
      refresh(key).catch(() => undefined);
    }
    return entry.value;
  };

  return Object.assign(get, {
    invalidate: () => {
      generation += 1;
      loaded.clear();
      pending.clear();
    },
  });
}
