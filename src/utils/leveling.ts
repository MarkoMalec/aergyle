import { prisma } from "~/lib/prisma";
import { VocationalActionType, XpActionType } from "@prisma/client";

function clampToSafeNumber(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = -max;
  if (value > max) return Number.MAX_SAFE_INTEGER;
  if (value < min) return -Number.MAX_SAFE_INTEGER;
  return Number(value);
}

async function getXpTotalForLevel(level: number): Promise<bigint> {
  if (level <= 1) return 0n;
  const row = await prisma.levelXpThreshold.findUnique({
    where: { level },
    select: { xpTotal: true },
  });
  return row?.xpTotal ?? 0n;
}

async function getLevelForTotalXp(totalXp: bigint): Promise<number> {
  if (totalXp <= 0n) return 1;
  const row = await prisma.levelXpThreshold.findFirst({
    where: { xpTotal: { lte: totalXp } },
    orderBy: { xpTotal: "desc" },
    select: { level: true },
  });
  return row?.level ?? 1;
}

async function ensureThresholdsCoverLevel(level: number) {
  if (level <= 1) return;
  const row = await prisma.levelXpThreshold.findUnique({ where: { level }, select: { level: true } });
  if (!row) {
    throw new Error(
      `Missing LevelXpThreshold for level ${level}. Generate thresholds (e.g. tsx scripts/generateLevelThresholds.ts --maxLevel <N>).`,
    );
  }
}

async function normalizeUserTotalXp(params: {
  userId: string;
  storedLevel: number;
  storedXp: bigint;
}): Promise<{ totalXp: bigint; level: number }> {
  const { userId, storedLevel, storedXp } = params;

  // If the DB still contains legacy "XP within level" values, they'll be smaller than
  // the cumulative threshold for the stored level. We convert lazily and fix the row.
  await ensureThresholdsCoverLevel(storedLevel);
  const minTotalForStoredLevel = await getXpTotalForLevel(storedLevel);
  const isLegacyWithinLevelXp = storedXp < minTotalForStoredLevel;
  const totalXp = isLegacyWithinLevelXp ? minTotalForStoredLevel + storedXp : storedXp;

  const derivedLevel = await getLevelForTotalXp(totalXp);
  const shouldUpdate = isLegacyWithinLevelXp || derivedLevel !== storedLevel;
  if (shouldUpdate) {
    await prisma.user.update({
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
  const xpTotal = await getXpTotalForLevel(level);
  return clampToSafeNumber(xpTotal);
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
    where: { isActive: true }
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
      }
    });
  }
  
  return config;
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
  const now = new Date();
  
  const multipliers = await prisma.xpMultiplier.findMany({
    where: {
      userId,
      isActive: true,
      AND: [
        {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } }
          ]
        },
        filters?.actionType
          ? {
              OR: [{ actionType: null }, { actionType: filters.actionType }],
            }
          : {},
        filters?.vocationalActionType
          ? {
              OR: [
                { vocationalActionType: null },
                { vocationalActionType: filters.vocationalActionType },
              ],
            }
          : {},
      ]
    }
  });
  
  // Calculate total multiplier
  // Stackable: 1.1 * 1.2 = 1.32 (32% more XP)
  // Non-stackable: take highest
  const stackableMultipliers = multipliers.filter(m => m.stackable);
  const nonStackableMultipliers = multipliers.filter(m => !m.stackable);
  
  let totalMultiplier = 1.0;
  
  // Apply stackable multipliers (multiplicative)
  stackableMultipliers.forEach(m => {
    totalMultiplier *= m.multiplier;
  });
  
  // Apply highest non-stackable multiplier (additive)
  if (nonStackableMultipliers.length > 0) {
    const highestNonStackable = Math.max(...nonStackableMultipliers.map(m => m.multiplier));
    totalMultiplier *= highestNonStackable;
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
  metadata?: any
): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  oldXp: string;
  newXp: string;
  xpGained: number;
  xpMultiplier: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true, experience: true }
  });
  
  if (!user) throw new Error("User not found");

  // Normalize legacy "within-level" XP to total XP if needed.
  const normalized = await normalizeUserTotalXp({
    userId,
    storedLevel: user.level,
    storedXp: user.experience,
  });
  const oldLevel = normalized.level;
  const oldTotalXp = normalized.totalXp;
  
  // Get multipliers
  if (actionType === "VOCATION" && !vocationalActionType) {
    throw new Error("vocationalActionType is required when actionType is VOCATION");
  }

  if (actionType !== "VOCATION" && vocationalActionType) {
    throw new Error("vocationalActionType is only valid when actionType is VOCATION");
  }

  const xpMultiplier = await getUserXpMultipliers(userId, {
    actionType,
    vocationalActionType: actionType === "VOCATION" ? vocationalActionType : undefined,
  });

  const baseXpInt = Math.max(0, Math.floor(baseAmount));
  const finalXpInt = Math.max(0, Math.floor(baseAmount * xpMultiplier));
  const xpToAdd = BigInt(finalXpInt);

  const newTotalXp = oldTotalXp + xpToAdd;
  const newLevel = await getLevelForTotalXp(newTotalXp);
  const leveledUp = newLevel > oldLevel;
  
  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      level: newLevel,
      experience: newTotalXp
    }
  });
  
  // Log transaction
  await prisma.xpTransaction.create({
    data: {
      userId,
      amount: BigInt(baseXpInt),
      finalAmount: BigInt(finalXpInt),
      actionType,
      vocationalActionType: actionType === "VOCATION" ? vocationalActionType : null,
      baseMultiplier: xpMultiplier,
      levelBefore: oldLevel,
      levelAfter: newLevel,
      experienceBefore: oldTotalXp,
      experienceAfter: newTotalXp,
      description,
      metadata: metadata || undefined,
    }
  });
  
  // Decrement uses for multipliers with limited uses
  await prisma.xpMultiplier.updateMany({
    where: {
      userId,
      isActive: true,
      usesRemaining: { not: null, gt: 0 }
    },
    data: {
      usesRemaining: { decrement: 1 }
    }
  });
  
  // Deactivate multipliers with 0 uses
  await prisma.xpMultiplier.updateMany({
    where: {
      userId,
      usesRemaining: 0
    },
    data: {
      isActive: false
    }
  });
  
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true, experience: true }
  });
  
  if (!user) throw new Error("User not found");

  const normalized = await normalizeUserTotalXp({
    userId,
    storedLevel: user.level,
    storedXp: user.experience,
  });

  const level = normalized.level;
  const totalXp = normalized.totalXp;
  const levelStartTotal = await getXpTotalForLevel(level);
  const nextRow = await prisma.levelXpThreshold.findUnique({
    where: { level: level + 1 },
    select: { xpTotal: true },
  });

  // If there's no (level + 1) threshold row, we're at the highest generated level.
  // Treat it as "max for current table" instead of erroring.
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
  }
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
    }
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
  const table = [];
  for (let level = 1; level <= maxLevel; level++) {
    const cumulativeXp = await getXpRequiredForLevel(level);
    const nextCumulative = await getXpRequiredForLevel(level + 1);
    const xpRequired = Math.max(0, nextCumulative - cumulativeXp);

    table.push({
      level,
      xpRequired,
      cumulativeXp,
      bracket: "",
    });
  }

  return table;
}
