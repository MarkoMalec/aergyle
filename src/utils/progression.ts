import type { PrismaClient } from "~/generated/prisma/client";
import { ProgressionTrackType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";

/**
 * The writes here can be handed a transaction client so a track-XP award commits
 * together with the loot that earned it. Reads of the threshold tables always go
 * through the global client: they are static reference data and there is no
 * reason to hold a transaction open for them.
 */
type TrackDb = Pick<PrismaClient, "userTrackProgress">;

function clampToSafeNumber(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = -max;
  if (value > max) return Number.MAX_SAFE_INTEGER;
  if (value < min) return -Number.MAX_SAFE_INTEGER;
  return Number(value);
}

const TRACK_XP_SCALE: Record<ProgressionTrackType, bigint> = {
  SKILL: 10n,
  VOCATION: 10n,
  DUNGEON: 10n,
  COMBAT: 10n,
};

type ThresholdRow = { level: number; xpTotal: bigint };

/**
 * TrackXpThreshold is seeded once and never written at runtime, so it is cached
 * for the life of the process. Regenerating thresholds ships as a deploy, which
 * restarts the process and drops the cache. Without this, every award ran a
 * COUNT plus a lookup against a table that cannot change.
 */
const trackThresholdCache = new Map<ProgressionTrackType, ThresholdRow[]>();
const trackThresholdLoads = new Map<ProgressionTrackType, Promise<ThresholdRow[]>>();

async function fetchTrackThresholds(
  trackType: ProgressionTrackType,
): Promise<ThresholdRow[]> {
  let rows = await prisma.trackXpThreshold.findMany({
    where: { trackType },
    select: { level: true, xpTotal: true },
    orderBy: { xpTotal: "asc" },
  });

  if (rows.length === 0) {
    // Derive from the existing player thresholds (same curve, scaled harder).
    const base = await prisma.levelXpThreshold.findMany({
      select: { level: true, xpTotal: true },
      orderBy: { level: "asc" },
    });

    if (base.length === 0) {
      throw new Error(
        "Missing LevelXpThreshold rows. Generate them first (scripts/generateLevelThresholds.ts).",
      );
    }

    const scale = TRACK_XP_SCALE[trackType] ?? 10n;
    await prisma.trackXpThreshold.createMany({
      data: base.map((row) => ({
        trackType,
        level: row.level,
        xpTotal: row.xpTotal * scale,
      })),
      skipDuplicates: true,
    });

    rows = await prisma.trackXpThreshold.findMany({
      where: { trackType },
      select: { level: true, xpTotal: true },
      orderBy: { xpTotal: "asc" },
    });
  }

  return rows;
}

/** Single-flight: concurrent settlements share one load instead of racing. */
async function loadTrackThresholds(
  trackType: ProgressionTrackType,
): Promise<ThresholdRow[]> {
  const cached = trackThresholdCache.get(trackType);
  if (cached) return cached;

  let pending = trackThresholdLoads.get(trackType);
  if (!pending) {
    pending = fetchTrackThresholds(trackType)
      .then((rows) => {
        trackThresholdCache.set(trackType, rows);
        return rows;
      })
      .finally(() => {
        trackThresholdLoads.delete(trackType);
      });
    trackThresholdLoads.set(trackType, pending);
  }
  return pending;
}

/** Highest level whose cumulative requirement is already met. */
function levelForTotalXp(rows: ThresholdRow[], totalXp: bigint): number {
  if (totalXp <= 0n) return 1;
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

function xpTotalForLevel(rows: ThresholdRow[], level: number): bigint {
  if (level <= 1) return 0n;
  return rows.find((row) => row.level === level)?.xpTotal ?? 0n;
}

export async function awardTrackXp(params: {
  userId: string;
  trackType: ProgressionTrackType;
  trackKey: string;
  amount: number;
  description?: string;
  /** Pass a transaction client to commit this with the reward that earned it. */
  db?: TrackDb;
}): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  oldXp: string;
  newXp: string;
  xpGained: number;
}> {
  const { userId, trackType, trackKey, amount } = params;
  const db = params.db ?? prisma;
  const baseXpInt = Math.max(0, Math.floor(amount));

  if (baseXpInt <= 0) {
    const existing = await db.userTrackProgress.findUnique({
      where: { userId_trackType_trackKey: { userId, trackType, trackKey } },
      select: { level: true, experience: true },
    });

    return {
      leveledUp: false,
      oldLevel: existing?.level ?? 1,
      newLevel: existing?.level ?? 1,
      oldXp: (existing?.experience ?? 0n).toString(),
      newXp: (existing?.experience ?? 0n).toString(),
      xpGained: 0,
    };
  }

  const thresholds = await loadTrackThresholds(trackType);

  const current = await db.userTrackProgress.upsert({
    where: { userId_trackType_trackKey: { userId, trackType, trackKey } },
    create: {
      userId,
      trackType,
      trackKey,
      level: 1,
      experience: 0n,
    },
    update: {},
    select: { id: true, level: true, experience: true },
  });

  const oldLevel = current.level;
  const oldXp = current.experience;
  const newXp = oldXp + BigInt(baseXpInt);

  const newLevel = levelForTotalXp(thresholds, newXp);
  const leveledUp = newLevel > oldLevel;

  await db.userTrackProgress.update({
    where: { id: current.id },
    data: { level: newLevel, experience: newXp },
  });

  return {
    leveledUp,
    oldLevel,
    newLevel,
    oldXp: oldXp.toString(),
    newXp: newXp.toString(),
    xpGained: baseXpInt,
  };
}

export async function getTrackXpProgress(params: {
  userId: string;
  trackType: ProgressionTrackType;
  trackKey: string;
}): Promise<{
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  xpProgress: number; // 0-100
  xpRemaining: number;
}> {
  const { userId, trackType, trackKey } = params;

  const [row, thresholds] = await Promise.all([
    prisma.userTrackProgress.upsert({
      where: { userId_trackType_trackKey: { userId, trackType, trackKey } },
      create: { userId, trackType, trackKey, level: 1, experience: 0n },
      update: {},
      select: { level: true, experience: true },
    }),
    loadTrackThresholds(trackType),
  ]);

  const level = row.level;
  const totalXp = row.experience;

  const levelStartTotal = xpTotalForLevel(thresholds, level);
  const nextLevelStartTotal = thresholds.find(
    (threshold) => threshold.level === level + 1,
  )?.xpTotal;

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

  const progressTimes100 =
    xpForNextLevelBig > 0n
      ? Number((xpIntoLevelBig * 10000n) / xpForNextLevelBig)
      : 0;
  const xpProgress = Math.min(100, Math.max(0, progressTimes100 / 100));

  return {
    level,
    currentXp: clampToSafeNumber(xpIntoLevelBig),
    xpForNextLevel: clampToSafeNumber(xpForNextLevelBig),
    xpProgress,
    xpRemaining: clampToSafeNumber(xpRemainingBig),
  };
}
