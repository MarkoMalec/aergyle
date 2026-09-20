import type { PrismaClient } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import { VocationalActionType, XpActionType } from "~/generated/prisma/enums";

/**
 * Writes accept a transaction client so an XP award commits together with the
 * loot that earned it. Threshold reads always use the global client: they are
 * static reference data and must not hold a transaction open.
 */
type LevelingDb = Pick<PrismaClient, "user" | "xpTransaction" | "xpMultiplier">;

/** Controls whether this award writes an XpTransaction audit row. */
export type XpLogMode =
  /** Default: one audit row per award. */
  | "always"
  /** For high-frequency payouts: only record the interesting event. */
  | "levelUpOnly"
  | "never";

function clampToSafeNumber(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = -max;
  if (value > max) return Number.MAX_SAFE_INTEGER;
  if (value < min) return -Number.MAX_SAFE_INTEGER;
  return Number(value);
}

type ThresholdRow = { level: number; xpTotal: bigint };
type Thresholds = { byXp: ThresholdRow[]; byLevel: Map<number, bigint> };

/**
 * LevelXpThreshold is seeded by scripts/generateLevelThresholds.ts and never
 * written at runtime, so it is cached for the life of the process. Regenerating
 * it ships as a deploy, which restarts the process and drops the cache.
 *
 * Before this, every XP award and every page load spent 3-6 queries walking a
 * table that cannot change.
 */
let thresholdCache: Thresholds | null = null;
let thresholdLoad: Promise<Thresholds> | null = null;

async function loadThresholds(): Promise<Thresholds> {
  if (thresholdCache) return thresholdCache;

  // Single-flight: concurrent settlements share one load instead of racing.
  if (!thresholdLoad) {
    thresholdLoad = prisma.levelXpThreshold
      .findMany({ select: { level: true, xpTotal: true }, orderBy: { xpTotal: "asc" } })
      .then((rows) => {
        const loaded: Thresholds = {
          byXp: rows,
          byLevel: new Map(rows.map((row) => [row.level, row.xpTotal])),
        };
        thresholdCache = loaded;
        return loaded;
      })
      .finally(() => {
        thresholdLoad = null;
      });
  }
  return thresholdLoad;
}

/** Highest level whose cumulative requirement is already met. */
function levelForTotalXp(thresholds: Thresholds, totalXp: bigint): number {
  if (totalXp <= 0n) return 1;
  const rows = thresholds.byXp;
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

function xpTotalForLevel(thresholds: Thresholds, level: number): bigint {
  if (level <= 1) return 0n;
  return thresholds.byLevel.get(level) ?? 0n;
}

function assertThresholdCoversLevel(thresholds: Thresholds, level: number) {
  if (level <= 1) return;
  if (!thresholds.byLevel.has(level)) {
    throw new Error(
      `Missing LevelXpThreshold for level ${level}. Generate thresholds (e.g. tsx scripts/generateLevelThresholds.ts --maxLevel <N>).`,
    );
  }
}

async function normalizeUserTotalXp(params: {
  userId: string;
  storedLevel: number;
  storedXp: bigint;
  thresholds: Thresholds;
  db: LevelingDb;
}): Promise<{ totalXp: bigint; level: number }> {
  const { userId, storedLevel, storedXp, thresholds, db } = params;

  // If the DB still contains legacy "XP within level" values, they'll be smaller than
  // the cumulative threshold for the stored level. We convert lazily and fix the row.
  assertThresholdCoversLevel(thresholds, storedLevel);
  const minTotalForStoredLevel = xpTotalForLevel(thresholds, storedLevel);
  const isLegacyWithinLevelXp = storedXp < minTotalForStoredLevel;
  const totalXp = isLegacyWithinLevelXp
    ? minTotalForStoredLevel + storedXp
    : storedXp;

  const derivedLevel = levelForTotalXp(thresholds, totalXp);
  const shouldUpdate = isLegacyWithinLevelXp || derivedLevel !== storedLevel;
  if (shouldUpdate) {
    await db.user.update({
      where: { id: userId },
      data: { experience: totalXp, level: derivedLevel },
    });
  }

  return { totalXp, level: derivedLevel };
}

/**
 * Total XP required to reach a level (cumulative threshold).
 * Example: if level 2 starts at 6 XP, then this returns 6 for level=2.
 */
export async function getXpRequiredForLevel(level: number): Promise<number> {
  const thresholds = await loadThresholds();
  return clampToSafeNumber(xpTotalForLevel(thresholds, level));
}

/**
 * Calculate cumulative XP required to reach a level
 */
export async function getCumulativeXpForLevel(level: number): Promise<number> {
  return await getXpRequiredForLevel(level);
}

/**
 * Deprecated: legacy formula-based leveling config.
 * Leveling now uses `LevelXpThreshold`.
 */
export async function getActiveXpConfig() {
  let config = await prisma.xpConfig.findFirst({
    where: { isActive: true },
  });

  // If no active config, create a default one
  if (!config) {
    config = await prisma.xpConfig.create({
      data: {
        configName: "default",
        isActive: true,
        baseXp: 100,
        exponentMultiplier: 1.5,
        levelMultiplier: 1.0,
        easyLevelCap: 5,
        easyMultiplier: 0.8,
        normalLevelCap: 15,
        normalMultiplier: 1.0,
        hardLevelCap: 30,
        hardMultiplier: 1.3,
        veryHardLevelCap: 50,
        veryHardMultiplier: 1.8,
        extremeLevelCap: 62,
        extremeMultiplier: 3.0,
        softCapLevel: 62,
        softCapMultiplier: 10.0,
        hardCapLevel: 70,
        seasonalBonus: 0,
      },
    });
  }

  return config;
}

type ActiveMultiplier = {
  multiplier: number;
  stackable: boolean;
  usesRemaining: number | null;
  actionType: XpActionType | null;
  vocationalActionType: VocationalActionType | null;
  expiresAt: Date | null;
};

/**
 * One read of the player's active multipliers. Filtering happens in JS so the
 * same rows can also answer "does anything need its uses decremented?" without
 * a second round trip.
 */
async function readActiveMultipliers(
  db: LevelingDb,
  userId: string,
): Promise<ActiveMultiplier[]> {
  const rows = await db.xpMultiplier.findMany({
    where: { userId, isActive: true },
    select: {
      multiplier: true,
      stackable: true,
      usesRemaining: true,
      actionType: true,
      vocationalActionType: true,
      expiresAt: true,
    },
  });
  const now = Date.now();
  return rows.filter(
    (row) => row.expiresAt === null || row.expiresAt.getTime() > now,
  );
}

function combineMultipliers(
  rows: ActiveMultiplier[],
  filters?: {
    actionType?: XpActionType;
    vocationalActionType?: VocationalActionType;
  },
): number {
  const applicable = rows.filter((row) => {
    if (
      filters?.actionType !== undefined &&
      row.actionType !== null &&
      row.actionType !== filters.actionType
    ) {
      return false;
    }
    if (
      filters?.vocationalActionType !== undefined &&
      row.vocationalActionType !== null &&
      row.vocationalActionType !== filters.vocationalActionType
    ) {
      return false;
    }
    return true;
  });

  // Stackable: 1.1 * 1.2 = 1.32 (32% more XP)
  // Non-stackable: take highest
  let totalMultiplier = 1.0;
  for (const row of applicable.filter((row) => row.stackable)) {
    totalMultiplier *= row.multiplier;
  }

  const nonStackable = applicable.filter((row) => !row.stackable);
  if (nonStackable.length > 0) {
    totalMultiplier *= Math.max(...nonStackable.map((row) => row.multiplier));
  }

  return totalMultiplier;
}

/**
 * Get all active XP multipliers for a user
 */
export async function getUserXpMultipliers(
  userId: string,
  filters?: {
    actionType?: XpActionType;
    vocationalActionType?: VocationalActionType;
  },
): Promise<number> {
  return combineMultipliers(await readActiveMultipliers(prisma, userId), filters);
}

/**
 * Award XP to a user and handle level ups
 */
export async function awardXp(
  userId: string,
  baseAmount: number,
  actionType: XpActionType,
  vocationalActionType?: VocationalActionType,
  description?: string,
  metadata?: any,
  options?: {
    /** Commit this award inside a caller's transaction. */
    db?: LevelingDb;
    /** Default "always". High-frequency payouts pass "levelUpOnly". */
    log?: XpLogMode;
  },
): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  oldXp: string;
  newXp: string;
  xpGained: number;
  xpMultiplier: number;
}> {
  const db = options?.db ?? prisma;
  const log: XpLogMode = options?.log ?? "always";

  if (actionType === "VOCATION" && !vocationalActionType) {
    throw new Error("vocationalActionType is required when actionType is VOCATION");
  }
  if (actionType !== "VOCATION" && vocationalActionType) {
    throw new Error("vocationalActionType is only valid when actionType is VOCATION");
  }

  const [user, thresholds] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { level: true, experience: true },
    }),
    loadThresholds(),
  ]);

  if (!user) throw new Error("User not found");

  // Normalize legacy "within-level" XP to total XP if needed.
  const normalized = await normalizeUserTotalXp({
    userId,
    storedLevel: user.level,
    storedXp: user.experience,
    thresholds,
    db,
  });
  const oldLevel = normalized.level;
  const oldTotalXp = normalized.totalXp;

  const multiplierRows = await readActiveMultipliers(db, userId);
  const xpMultiplier = combineMultipliers(multiplierRows, {
    actionType,
    vocationalActionType:
      actionType === "VOCATION" ? vocationalActionType : undefined,
  });

  const baseXpInt = Math.max(0, Math.floor(baseAmount));
  const finalXpInt = Math.max(0, Math.floor(baseAmount * xpMultiplier));
  const xpToAdd = BigInt(finalXpInt);

  const newTotalXp = oldTotalXp + xpToAdd;
  const newLevel = levelForTotalXp(thresholds, newTotalXp);
  const leveledUp = newLevel > oldLevel;

  // Update user
  await db.user.update({
    where: { id: userId },
    data: {
      level: newLevel,
      experience: newTotalXp,
    },
  });

  // Log transaction. Vocation ticks fire every few seconds per player, which
  // grew this table by hundreds of MB a day for data nothing reads; those
  // callers pass "levelUpOnly" so only the interesting event is recorded.
  const shouldLog =
    log === "always" || (log === "levelUpOnly" && leveledUp);

  if (shouldLog) {
    await db.xpTransaction.create({
      data: {
        userId,
        amount: BigInt(baseXpInt),
        finalAmount: BigInt(finalXpInt),
        actionType,
        vocationalActionType:
          actionType === "VOCATION" ? vocationalActionType : null,
        baseMultiplier: xpMultiplier,
        levelBefore: oldLevel,
        levelAfter: newLevel,
        experienceBefore: oldTotalXp,
        experienceAfter: newTotalXp,
        description,
        metadata: metadata || undefined,
      },
    });
  }

  // Only touch the multiplier rows when the player actually has limited-use
  // ones; most players have none, and these were two writes every payout.
  const hasLimitedUses = multiplierRows.some(
    (row) => row.usesRemaining !== null,
  );
  if (hasLimitedUses) {
    // Decrement uses for multipliers with limited uses
    await db.xpMultiplier.updateMany({
      where: { userId, isActive: true, usesRemaining: { not: null, gt: 0 } },
      data: { usesRemaining: { decrement: 1 } },
    });

    // Deactivate multipliers with 0 uses
    await db.xpMultiplier.updateMany({
      where: { userId, usesRemaining: 0 },
      data: { isActive: false },
    });
  }

  return {
    leveledUp,
    oldLevel,
    newLevel,
    oldXp: oldTotalXp.toString(),
    newXp: newTotalXp.toString(),
    xpGained: finalXpInt,
    xpMultiplier,
  };
}

/**
 * Get XP progress for current level
 */
export async function getXpProgress(userId: string): Promise<{
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  xpProgress: number; // 0-100 percentage
  xpRemaining: number;
}> {
  const [user, thresholds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, experience: true },
    }),
    loadThresholds(),
  ]);

  if (!user) throw new Error("User not found");

  const normalized = await normalizeUserTotalXp({
    userId,
    storedLevel: user.level,
    storedXp: user.experience,
    thresholds,
    db: prisma,
  });

  const level = normalized.level;
  const totalXp = normalized.totalXp;
  const levelStartTotal = xpTotalForLevel(thresholds, level);
  const nextLevelStartTotal = thresholds.byLevel.get(level + 1);

  // If there's no (level + 1) threshold row, we're at the highest generated level.
  // Treat it as "max for current table" instead of erroring.
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

  // Progress percentage using BigInt math (2dp), avoids float overflow.
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

/**
 * Add temporary XP multiplier to user
 */
export async function addXpMultiplier(
  userId: string,
  name: string,
  multiplier: number,
  options?: {
    actionType?: XpActionType;
    vocationalActionType?: VocationalActionType;
    durationMinutes?: number;
    uses?: number;
    stackable?: boolean;
  },
): Promise<void> {
  if (options?.vocationalActionType && options?.actionType !== "VOCATION") {
    throw new Error("vocationalActionType is only valid when actionType is VOCATION");
  }

  const expiresAt = options?.durationMinutes
    ? new Date(Date.now() + options.durationMinutes * 60 * 1000)
    : null;

  await prisma.xpMultiplier.create({
    data: {
      userId,
      name,
      multiplier,
      actionType: options?.actionType,
      vocationalActionType: options?.vocationalActionType,
      expiresAt,
      usesRemaining: options?.uses,
      stackable: options?.stackable ?? true,
    },
  });
}

/**
 * Calculate XP table for reference (useful for admin/debugging)
 */
export async function generateXpTable(maxLevel: number = 70): Promise<Array<{
  level: number;
  xpRequired: number;
  cumulativeXp: number;
  bracket: string;
}>> {
  // Was 2 queries per level (140 for the default table); now a cached lookup.
  const thresholds = await loadThresholds();
  const table = [];
  for (let level = 1; level <= maxLevel; level++) {
    const cumulativeXp = clampToSafeNumber(xpTotalForLevel(thresholds, level));
    const nextCumulative = clampToSafeNumber(
      xpTotalForLevel(thresholds, level + 1),
    );
    table.push({
      level,
      xpRequired: Math.max(0, nextCumulative - cumulativeXp),
      cumulativeXp,
      bracket: "",
    });
  }

  return table;
}
