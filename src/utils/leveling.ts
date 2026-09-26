import type { PrismaClient } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import { VocationalActionType, XpActionType } from "~/generated/prisma/enums";
import { DEFAULT_CURVE_DESIGNS } from "~/game/balance/curve";
import {
  CURVE_REFRESH_MS,
  levelForTotalXp,
  levelProgress,
  refreshingCache,
  thresholdRowsFromDesign,
  toXpCurve,
  type LevelProgress,
  type XpCurve,
} from "~/utils/xpCurve";

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

// Written by /admin/leveling; an empty table falls back to the default design.
const loadThresholds = refreshingCache(async () => {
  const rows = await prisma.levelXpThreshold.findMany({
    select: { level: true, xpTotal: true },
    orderBy: { xpTotal: "asc" },
  });
  return toXpCurve(
    rows.length > 0
      ? rows
      : thresholdRowsFromDesign(DEFAULT_CURVE_DESIGNS.CHARACTER),
  );
}, CURVE_REFRESH_MS);

/** The character level curve, for code that sets a level or XP directly. */
export const getLevelCurve = loadThresholds;

/**
 * `experience` is the character's lifetime XP and the level is derived from
 * it. A stored level can lag behind the curve for a moment after an admin
 * changes it (another process may still hold the old curve), so it is
 * corrected whenever it is read here.
 */
async function syncStoredLevel(params: {
  userId: string;
  storedLevel: number;
  totalXp: bigint;
  thresholds: XpCurve;
  db: LevelingDb;
}): Promise<number> {
  const { userId, storedLevel, totalXp, thresholds, db } = params;
  const level = levelForTotalXp(thresholds, totalXp);
  if (level !== storedLevel) {
    await db.user.update({ where: { id: userId }, data: { level } });
  }
  return level;
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
      select: { experience: true },
    }),
    loadThresholds(),
  ]);

  if (!user) throw new Error("User not found");

  // The update below also corrects a stored level the curve has moved.
  const oldTotalXp = user.experience;
  const oldLevel = levelForTotalXp(thresholds, oldTotalXp);

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
export async function getXpProgress(userId: string): Promise<LevelProgress> {
  const [user, thresholds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, experience: true },
    }),
    loadThresholds(),
  ]);

  if (!user) throw new Error("User not found");

  const level = await syncStoredLevel({
    userId,
    storedLevel: user.level,
    totalXp: user.experience,
    thresholds,
    db: prisma,
  });

  return levelProgress(thresholds, level, user.experience);
}
