import type { PrismaClient } from "~/generated/prisma/client";
import { ProgressionTrackType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import {
  cacheForever,
  levelForTotalXp,
  levelProgress,
  toXpCurve,
  type LevelProgress,
  type ThresholdRow,
} from "~/utils/xpCurve";

/**
 * The writes here can be handed a transaction client so a track-XP award commits
 * together with the loot that earned it. Reads of the threshold tables always go
 * through the global client: they are static reference data and there is no
 * reason to hold a transaction open for them.
 */
type TrackDb = Pick<PrismaClient, "userTrackProgress">;

const TRACK_XP_SCALE: Record<ProgressionTrackType, bigint> = {
  SKILL: 10n,
  VOCATION: 10n,
  DUNGEON: 10n,
  COMBAT: 10n,
};

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

/**
 * TrackXpThreshold is seeded once and never written at runtime. Without the
 * cache every award ran a COUNT plus a lookup against a table that cannot
 * change.
 */
const loadTrackThresholds = cacheForever(
  async (trackType: ProgressionTrackType) =>
    toXpCurve(await fetchTrackThresholds(trackType)),
);

/** A track's level curve, for code that sets a level or XP directly. */
export const getTrackCurve = loadTrackThresholds;

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
}): Promise<LevelProgress> {
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

  return levelProgress(thresholds, row.level, row.experience);
}
