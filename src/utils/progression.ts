import { ProgressionTrackType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";

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

async function ensureTrackThresholds(trackType: ProgressionTrackType) {
  const existing = await prisma.trackXpThreshold.count({ where: { trackType } });
  if (existing > 0) return;

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
}

async function getTrackXpTotalForLevel(params: {
  trackType: ProgressionTrackType;
  level: number;
}): Promise<bigint> {
  const { trackType, level } = params;
  if (level <= 1) return 0n;

  await ensureTrackThresholds(trackType);

  const row = await prisma.trackXpThreshold.findUnique({
    where: { trackType_level: { trackType, level } },
    select: { xpTotal: true },
  });
  return row?.xpTotal ?? 0n;
}

async function getTrackLevelForTotalXp(params: {
  trackType: ProgressionTrackType;
  totalXp: bigint;
}): Promise<number> {
  const { trackType, totalXp } = params;
  if (totalXp <= 0n) return 1;

  await ensureTrackThresholds(trackType);

  const row = await prisma.trackXpThreshold.findFirst({
    where: { trackType, xpTotal: { lte: totalXp } },
    orderBy: { xpTotal: "desc" },
    select: { level: true },
  });

  return row?.level ?? 1;
}

export async function awardTrackXp(params: {
  userId: string;
  trackType: ProgressionTrackType;
  trackKey: string;
  amount: number;
  description?: string;
}): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  oldXp: string;
  newXp: string;
  xpGained: number;
}> {
  const { userId, trackType, trackKey, amount } = params;
  const baseXpInt = Math.max(0, Math.floor(amount));
  if (baseXpInt <= 0) {
    const existing = await prisma.userTrackProgress.findUnique({
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

  const current = await prisma.userTrackProgress.upsert({
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

  const newLevel = await getTrackLevelForTotalXp({ trackType, totalXp: newXp });
  const leveledUp = newLevel > oldLevel;

  await prisma.userTrackProgress.update({
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

  const row = await prisma.userTrackProgress.upsert({
    where: { userId_trackType_trackKey: { userId, trackType, trackKey } },
    create: { userId, trackType, trackKey, level: 1, experience: 0n },
    update: {},
    select: { level: true, experience: true },
  });

  const level = row.level;
  const totalXp = row.experience;

  const levelStartTotal = await getTrackXpTotalForLevel({ trackType, level });

  await ensureTrackThresholds(trackType);
  const nextRow = await prisma.trackXpThreshold.findUnique({
    where: { trackType_level: { trackType, level: level + 1 } },
    select: { xpTotal: true },
  });

  if (!nextRow) {
    return {
      level,
      currentXp: clampToSafeNumber(totalXp - levelStartTotal),
      xpForNextLevel: 0,
      xpProgress: 100,
      xpRemaining: 0,
    };
  }

  const nextLevelStartTotal = nextRow.xpTotal;
  const xpForNextLevelBig = nextLevelStartTotal - levelStartTotal;
  const xpIntoLevelBig = totalXp - levelStartTotal;
  const xpRemainingBig = nextLevelStartTotal > totalXp ? nextLevelStartTotal - totalXp : 0n;

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
