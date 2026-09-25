/**
 * The cumulative-XP level curve shared by the character level
 * (LevelXpThreshold) and every progression track (TrackXpThreshold). Both
 * tables are seeded and never written at runtime.
 */

export type ThresholdRow = { level: number; xpTotal: bigint };
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
 * Caches each key's load for the life of the process. Threshold tables only
 * change with a deploy, which restarts the process and drops the cache.
 * Concurrent callers share one in-flight load instead of racing.
 */
export function cacheForever<V, K = void>(
  load: (key: K) => Promise<V>,
): (key: K) => Promise<V> {
  const loaded = new Map<K, V>();
  const pending = new Map<K, Promise<V>>();
  return async (key) => {
    if (loaded.has(key)) return loaded.get(key)!;
    let load$ = pending.get(key);
    if (!load$) {
      load$ = load(key)
        .then((value) => {
          loaded.set(key, value);
          return value;
        })
        .finally(() => pending.delete(key));
      pending.set(key, load$);
    }
    return load$;
  };
}
