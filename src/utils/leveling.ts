import { prisma } from "~/lib/prisma";
import { XpActionType } from "@prisma/client";

/**
 * Calculate XP required for a specific level based on active config
 */
export async function getXpRequiredForLevel(level: number): Promise<number> {
  const config = await getActiveXpConfig();
  
  if (level <= 1) return 0;
  if (level > config.hardCapLevel) return Infinity;
  
  // Base XP calculation: baseXp * (level ^ exponentMultiplier) * levelMultiplier
  let xpRequired = config.baseXp * Math.pow(level, config.exponentMultiplier) * config.levelMultiplier;
  
  // Apply difficulty bracket multipliers
  let bracketMultiplier = 1.0;
  
  if (level <= config.easyLevelCap) {
    bracketMultiplier = config.easyMultiplier;
  } else if (level <= config.normalLevelCap) {
    bracketMultiplier = config.normalMultiplier;
  } else if (level <= config.hardLevelCap) {
    bracketMultiplier = config.hardMultiplier;
  } else if (level <= config.veryHardLevelCap) {
    bracketMultiplier = config.veryHardMultiplier;
  } else if (level <= config.extremeLevelCap) {
    bracketMultiplier = config.extremeMultiplier;
  }
  
  // Apply soft cap multiplier (makes it nearly impossible)
  if (level > config.softCapLevel) {
    bracketMultiplier *= config.softCapMultiplier;
  }
  
  xpRequired *= bracketMultiplier;
  
  // Apply seasonal bonus (reduces XP needed)
  if (config.seasonalBonus > 0) {
    xpRequired *= (1 - config.seasonalBonus);
  }
  
  return Math.round(xpRequired);
}

/**
 * Calculate cumulative XP required to reach a level
 */
export async function getCumulativeXpForLevel(level: number): Promise<number> {
  let totalXp = 0;
  for (let i = 2; i <= level; i++) {
    totalXp += await getXpRequiredForLevel(i);
  }
  return totalXp;
}

/**
 * Get active XP configuration
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
  actionType?: XpActionType
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
        actionType ? {
          OR: [
            { actionType: null },
            { actionType }
          ]
        } : {}
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
  description?: string,
  metadata?: any
): Promise<{
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  oldXp: number;
  newXp: number;
  xpGained: number;
  xpMultiplier: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true, experience: true }
  });
  
  if (!user) throw new Error("User not found");
  
  const config = await getActiveXpConfig();
  
  // Check hard cap
  if (user.level >= config.hardCapLevel) {
    return {
      leveledUp: false,
      oldLevel: user.level,
      newLevel: user.level,
      oldXp: user.experience,
      newXp: user.experience,
      xpGained: 0,
      xpMultiplier: 0,
    };
  }
  
  // Get multipliers
  const xpMultiplier = await getUserXpMultipliers(userId, actionType);
  const finalAmount = baseAmount * xpMultiplier;
  
  let newExperience = user.experience + finalAmount;
  let newLevel = user.level;
  let leveledUp = false;
  
  // Check for level ups
  while (newLevel < config.hardCapLevel) {
    const xpForNextLevel = await getXpRequiredForLevel(newLevel + 1);
    if (newExperience >= xpForNextLevel) {
      newExperience -= xpForNextLevel;
      newLevel++;
      leveledUp = true;
    } else {
      break;
    }
  }
  
  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      level: newLevel,
      experience: newExperience
    }
  });
  
  // Log transaction
  await prisma.xpTransaction.create({
    data: {
      userId,
      amount: baseAmount,
      finalAmount,
      actionType,
      baseMultiplier: xpMultiplier,
      levelBefore: user.level,
      levelAfter: newLevel,
      experienceBefore: user.experience,
      experienceAfter: newExperience,
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
    oldLevel: user.level,
    newLevel,
    oldXp: user.experience,
    newXp: newExperience,
    xpGained: finalAmount,
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
  
  const xpForNextLevel = await getXpRequiredForLevel(user.level + 1);
  const xpProgress = (user.experience / xpForNextLevel) * 100;
  const xpRemaining = xpForNextLevel - user.experience;
  
  return {
    level: user.level,
    currentXp: user.experience,
    xpForNextLevel,
    xpProgress: Math.min(100, xpProgress),
    xpRemaining: Math.max(0, xpRemaining),
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
    durationMinutes?: number;
    uses?: number;
    stackable?: boolean;
  }
): Promise<void> {
  const expiresAt = options?.durationMinutes
    ? new Date(Date.now() + options.durationMinutes * 60 * 1000)
    : null;
  
  await prisma.xpMultiplier.create({
    data: {
      userId,
      name,
      multiplier,
      actionType: options?.actionType,
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
  const config = await getActiveXpConfig();
  const table = [];
  let cumulativeXp = 0;
  
  for (let level = 1; level <= maxLevel; level++) {
    const xpRequired = await getXpRequiredForLevel(level);
    cumulativeXp += xpRequired;
    
    let bracket = "Max Level";
    if (level <= config.easyLevelCap) bracket = "Easy";
    else if (level <= config.normalLevelCap) bracket = "Normal";
    else if (level <= config.hardLevelCap) bracket = "Hard";
    else if (level <= config.veryHardLevelCap) bracket = "Very Hard";
    else if (level <= config.extremeLevelCap) bracket = "Extreme";
    else if (level > config.softCapLevel) bracket = "Soft Cap";
    
    table.push({
      level,
      xpRequired,
      cumulativeXp,
      bracket,
    });
  }
  
  return table;
}
