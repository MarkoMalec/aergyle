import type { PrismaClient } from "~/generated/prisma/client";
import type { ProgressionTrackType } from "~/generated/prisma/enums";
import { DEFAULT_CURVE_DESIGNS } from "~/game/balance/curve";
import { prisma } from "~/lib/prisma";
import {
  CURVE_REFRESH_MS,
  levelForTotalXp,
  levelProgress,
  refreshingCache,
  thresholdRowsFromDesign,
  toXpCurve,
  type LevelProgress,
} from "~/utils/xpCurve";

/**
 * The writes here can be handed a transaction client so a track-XP award commits
 * together with the loot that earned it. Reads of the threshold tables always go
 * through the global client: they are reference data and there is no reason to
 * hold a transaction open for them.
 */
type TrackDb = Pick<PrismaClient, "userTrackProgress">;

/**
 * Written by /admin/leveling (skills are the SKILL track); an empty table
 * falls back to the default skill design. Cached so an award doesn't read
 * the table, and refreshed so an admin edit reaches every process.
 */
const loadTrackThresholds = refreshingCache(
  async (trackType: ProgressionTrackType) => {
    const rows = await prisma.trackXpThreshold.findMany({
      where: { trackType },
      select: { level: true, xpTotal: true },
      orderBy: { xpTotal: "asc" },
    });
    return toXpCurve(
      rows.length > 0 ? rows : thresholdRowsFromDesign(DEFAULT_CURVE_DESIGNS.SKILL),
    );
  },
  CURVE_REFRESH_MS,
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

  // Derived from XP, so a curve edit applies before the stored level catches up.
  return levelProgress(
    thresholds,
    levelForTotalXp(thresholds, row.experience),
    row.experience,
  );
}
