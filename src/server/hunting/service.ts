import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "~/generated/prisma/client";
import {
  CreatureKind,
  StatType,
  VocationalActionType,
  XpActionType,
} from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { assertNoOtherActivity } from "~/server/activity";
import {
  calculateHealthAfterDamage,
  getCharacterVitalsFromSnapshot,
  writeCharacterHealth,
} from "~/server/combat";
import {
  applyLiveHuntingSafety,
  resolveHuntingExpedition,
  type HuntingCreaturePoolEntry,
  type HuntingReport,
  type HuntingReward,
} from "~/server/hunting/resolver";
import {
  getCharacterStatSnapshot,
  type CharacterStatSnapshot,
} from "~/server/stats";
import {
  CREATURE_ATTACK_SELECT,
  parseCreatureAttackProfile,
  toCreatureAttackProfile,
} from "~/server/creatures/attackProfile";
import {
  buildCreatureDropPool,
  CREATURE_DROP_SELECT,
  parseCreatureDropPool,
  parseLootRewards,
} from "~/server/creatures/loot";
import { createExpeditionRandom } from "~/server/expeditions/random";
import { recordQuestProgress } from "~/server/settlements/quests";
import { grantStackableItemToInventory } from "~/server/items/grantItem";
import { awardXp } from "~/utils/leveling";
import { awardTrackXp, getTrackXpProgress } from "~/utils/progression";
import { recordSkillWork } from "~/server/skills/metrics";
import { finiteNumber } from "~/server/expeditions/rewards";

const MAX_EXPEDITION_SECONDS = 7 * 24 * 60 * 60;

type HuntingRiskSnapshot = {
  damageEnabled: boolean;
  globalDangerMultiplier: number;
  maxHealthLossPercent: number;
  minimumRemainingHealthPercent: number;
  accidentChance: number;
  accidentDamageMin: number;
  accidentDamageMax: number;
};

type ClaimedHuntingReport = HuntingReport & {
  potentialDamage?: number;
  health?: {
    before: number;
    after: number;
    max: number;
  };
};

export type HuntingExpeditionStatus = {
  expedition: null | {
    id: number;
    status: "ACTIVE" | "READY" | "CLAIMED";
    startedAt: string;
    endsAt: string;
    claimedAt: string | null;
    durationSeconds: number;
    ground: {
      id: number;
      name: string;
      location: { id: number; name: string };
    };
    rewards: HuntingReward[];
    report: ClaimedHuntingReport | null;
  };
};

const DEFAULT_HUNTING_CONFIG = {
  damageEnabled: true,
  globalDangerMultiplier: 1,
  maxHealthLossPercent: 30,
  minimumRemainingHealthPercent: 5,
  minimumHealthToStartPercent: 25,
} as const;

async function getHuntingConfig() {
  return (
    (await prisma.huntingConfig.findUnique({ where: { id: 1 } })) ??
    DEFAULT_HUNTING_CONFIG
  );
}

function modifierSnapshot(character: CharacterStatSnapshot) {
  const activeEffect = character.activeEffect;
  return {
    luck: character.finalStats.luck,
    huntingEfficiency: character.finalStats.huntingEfficiency,
    defenses: {
      armor: character.finalStats.armor,
      magicResist: character.finalStats.magicResist,
      evasionMelee: character.finalStats.evasionMelee,
      evasionRanged: character.finalStats.evasionRanged,
      evasionMagic: character.finalStats.evasionMagic,
      blockChance: character.finalStats.blockChance,
      movementSpeed: character.finalStats.movementSpeed,
      maxHealth: character.finalStats.health,
      fireResist: character.finalStats.fireResist,
      coldResist: character.finalStats.coldResist,
      lightningResist: character.finalStats.lightningResist,
      poisonResist: character.finalStats.poisonResist,
    },
    sources: {
      equipmentLuck: character.equipmentBonuses[StatType.LUCK],
      equipmentHuntingEfficiency:
        character.equipmentBonuses[StatType.HUNTING_EFFICIENCY],
      activeEffect: activeEffect
        ? {
            itemId: activeEffect.item.id,
            name: activeEffect.item.name,
            sprite: activeEffect.item.sprite,
            endsAt: activeEffect.endsAt.toISOString(),
            luck: character.temporaryBonuses[StatType.LUCK],
            huntingEfficiency:
              character.temporaryBonuses[StatType.HUNTING_EFFICIENCY],
          }
        : null,
    },
  };
}

function parseReport(value: unknown): ClaimedHuntingReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const encounters = Array.isArray(row.encounters)
    ? row.encounters.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const event = entry as Record<string, unknown>;
        if (
          typeof event.creatureId !== "number" ||
          typeof event.name !== "string" ||
          typeof event.asset !== "string"
        ) {
          return [];
        }
        return [
          {
            creatureId: event.creatureId,
            name: event.name,
            asset: event.asset,
            count: Math.max(0, Math.floor(finiteNumber(event.count))),
            attacks: Math.max(0, Math.floor(finiteNumber(event.attacks))),
            evaded: Math.max(0, Math.floor(finiteNumber(event.evaded))),
            blocked: Math.max(0, Math.floor(finiteNumber(event.blocked))),
            damageTaken: Math.max(0, finiteNumber(event.damageTaken)),
          },
        ];
      })
    : [];
  const accidentRow =
    row.accidents && typeof row.accidents === "object"
      ? (row.accidents as Record<string, unknown>)
      : {};
  const modifiersRow =
    row.modifiers && typeof row.modifiers === "object"
      ? (row.modifiers as Record<string, unknown>)
      : {};
  const healthRow =
    row.health && typeof row.health === "object"
      ? (row.health as Record<string, unknown>)
      : null;

  return {
    encounters,
    accidents: {
      attempts: Math.max(0, Math.floor(finiteNumber(accidentRow.attempts))),
      injuries: Math.max(0, Math.floor(finiteNumber(accidentRow.injuries))),
      damageTaken: Math.max(0, finiteNumber(accidentRow.damageTaken)),
    },
    totalDamage: Math.max(0, finiteNumber(row.totalDamage)),
    modifiers: {
      findModifierPercent: finiteNumber(modifiersRow.findModifierPercent),
      quantityModifierPercent: finiteNumber(
        modifiersRow.quantityModifierPercent,
      ),
      quantityScale: Math.max(0, finiteNumber(modifiersRow.quantityScale, 1)),
    },
    potentialDamage:
      typeof row.potentialDamage === "number"
        ? Math.max(0, row.potentialDamage)
        : undefined,
    health: healthRow
      ? {
          before: Math.max(0, finiteNumber(healthRow.before)),
          after: Math.max(0, finiteNumber(healthRow.after)),
          max: Math.max(1, finiteNumber(healthRow.max, 1)),
        }
      : undefined,
  };
}

function parseCreaturePool(value: unknown): HuntingCreaturePoolEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const attack = parseCreatureAttackProfile(row);
    if (
      !attack ||
      typeof row.creatureId !== "number" ||
      typeof row.name !== "string" ||
      typeof row.asset !== "string" ||
      !Array.isArray(row.drops)
    ) {
      return [];
    }
    const drops = parseCreatureDropPool(row.drops);
    return [
      {
        creatureId: row.creatureId,
        name: row.name,
        asset: row.asset,
        encounterWeight: finiteNumber(row.encounterWeight, 1),
        ...attack,
        attackChance: finiteNumber(row.attackChance),
        drops,
      },
    ];
  });
}

function parseRiskConfig(value: unknown): HuntingRiskSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.damageEnabled !== "boolean") return null;
  return {
    damageEnabled: row.damageEnabled,
    globalDangerMultiplier: Math.max(
      0,
      finiteNumber(row.globalDangerMultiplier, 1),
    ),
    maxHealthLossPercent: Math.max(
      0,
      finiteNumber(row.maxHealthLossPercent, 30),
    ),
    minimumRemainingHealthPercent: Math.max(
      0,
      finiteNumber(row.minimumRemainingHealthPercent, 5),
    ),
    accidentChance: Math.max(0, finiteNumber(row.accidentChance)),
    accidentDamageMin: Math.max(
      0,
      Math.floor(finiteNumber(row.accidentDamageMin)),
    ),
    accidentDamageMax: Math.max(
      0,
      Math.floor(finiteNumber(row.accidentDamageMax)),
    ),
  };
}

function applyHealthFloorToReport(
  report: HuntingReport,
  appliedDamage: number,
): HuntingReport {
  if (report.totalDamage <= 0 || appliedDamage >= report.totalDamage) {
    return { ...report, totalDamage: appliedDamage };
  }
  const scale = appliedDamage / report.totalDamage;
  return {
    ...report,
    encounters: report.encounters.map((encounter) => ({
      ...encounter,
      damageTaken: encounter.damageTaken * scale,
    })),
    accidents: {
      ...report.accidents,
      damageTaken: report.accidents.damageTaken * scale,
    },
    totalDamage: appliedDamage,
  };
}

function toStatus(
  expedition: {
    id: number;
    startedAt: Date;
    endsAt: Date;
    claimedAt: Date | null;
    durationSeconds: number;
    rewards: unknown;
    report: unknown;
    ground: {
      id: number;
      name: string;
      location: { id: number; name: string };
    };
  } | null,
): HuntingExpeditionStatus {
  if (!expedition) return { expedition: null };
  return {
    expedition: {
      id: expedition.id,
      status: expedition.claimedAt
        ? "CLAIMED"
        : expedition.endsAt.getTime() <= Date.now()
          ? "READY"
          : "ACTIVE",
      startedAt: expedition.startedAt.toISOString(),
      endsAt: expedition.endsAt.toISOString(),
      claimedAt: expedition.claimedAt?.toISOString() ?? null,
      durationSeconds: expedition.durationSeconds,
      ground: expedition.ground,
      rewards: parseLootRewards(expedition.rewards),
      report: parseReport(expedition.report),
    },
  };
}

export async function getHuntingExpeditionStatus(
  userId: string,
): Promise<HuntingExpeditionStatus> {
  const expedition = await prisma.userHuntingExpedition.findUnique({
    where: { userId },
    select: {
      id: true,
      startedAt: true,
      endsAt: true,
      claimedAt: true,
      durationSeconds: true,
      rewards: true,
      report: true,
      ground: {
        select: {
          id: true,
          name: true,
          location: { select: { id: true, name: true } },
        },
      },
    },
  });
  return toStatus(expedition);
}

export async function getHuntingPageData(userId: string) {
  const [user, skillProgress, durations, config, character, status] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          level: true,
          currentLocation: {
            select: {
              id: true,
              name: true,
              requiredLevel: true,
              huntingGrounds: {
                where: { enabled: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                select: {
                  id: true,
                  name: true,
                  description: true,
                  requiredHuntingLevel: true,
                  accidentChance: true,
                  accidentDamageMin: true,
                  accidentDamageMax: true,
                  creatures: {
                    where: {
                      enabled: true,
                      creature: { enabled: true, kind: CreatureKind.ANIMAL },
                    },
                    orderBy: [{ encounterWeight: "desc" }],
                    select: {
                      encounterWeight: true,
                      creature: {
                        select: {
                          id: true,
                          name: true,
                          description: true,
                          asset: true,
                          ...CREATURE_ATTACK_SELECT,
                          attackChance: true,
                          drops: {
                            where: { enabled: true },
                            orderBy: [{ baseChance: "desc" }],
                            select: CREATURE_DROP_SELECT,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      getTrackXpProgress({
        userId,
        trackType: "SKILL",
        trackKey: VocationalActionType.HUNTING,
      }),
      prisma.huntingDuration.findMany({
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { durationSeconds: "asc" }],
        select: {
          id: true,
          label: true,
          durationSeconds: true,
          encounterRolls: true,
          dangerMultiplier: true,
          xpReward: true,
          requiredHuntingLevel: true,
        },
      }),
      getHuntingConfig(),
      getCharacterStatSnapshot(userId),
      getHuntingExpeditionStatus(userId),
    ]);
  if (!user) throw new Error("User not found");
  const vitals = await getCharacterVitalsFromSnapshot(userId, character);
  const modifiers = modifierSnapshot(character);

  return {
    skillProgress: {
      trackKey: VocationalActionType.HUNTING,
      ...skillProgress,
    },
    modifiers,
    vitals,
    safety: {
      damageEnabled: config.damageEnabled,
      globalDangerMultiplier: config.globalDangerMultiplier,
      maxHealthLossPercent: config.maxHealthLossPercent,
      minimumRemainingHealthPercent: config.minimumRemainingHealthPercent,
      minimumHealthToStartPercent: config.minimumHealthToStartPercent,
    },
    durations: durations.map((duration) => ({
      ...duration,
      unlocked: skillProgress.level >= duration.requiredHuntingLevel,
    })),
    location: user.currentLocation
      ? {
          id: user.currentLocation.id,
          name: user.currentLocation.name,
          unlocked: user.level >= user.currentLocation.requiredLevel,
          grounds: user.currentLocation.huntingGrounds.map((ground) => ({
            id: ground.id,
            name: ground.name,
            description: ground.description,
            requiredHuntingLevel: ground.requiredHuntingLevel,
            unlocked: skillProgress.level >= ground.requiredHuntingLevel,
            accidentChance: ground.accidentChance,
            accidentDamage: {
              min: ground.accidentDamageMin,
              max: ground.accidentDamageMax,
            },
            creatures: ground.creatures.map(
              ({ creature, encounterWeight }) => ({
                id: creature.id,
                name: creature.name,
                description: creature.description,
                asset: creature.asset,
                encounterWeight,
                ...toCreatureAttackProfile(creature),
                attackChance: creature.attackChance,
                drops: creature.drops.map((drop) =>
                  skillProgress.level >= drop.requiredLevel
                    ? {
                        unlocked: true as const,
                        id: drop.id,
                        baseChance: drop.baseChance,
                        minQuantity: drop.minQuantity,
                        maxQuantity: drop.maxQuantity,
                        requiredHuntingLevel: drop.requiredLevel,
                        item: drop.item,
                      }
                    : {
                        unlocked: false as const,
                        requiredHuntingLevel: drop.requiredLevel,
                      },
                ),
              }),
            ),
          })),
        }
      : null,
    ...status,
  };
}

export async function startHuntingExpedition(params: {
  userId: string;
  groundId: number;
  durationId: number;
}) {
  const { userId, groundId, durationId } = params;
  if (!Number.isInteger(groundId) || !Number.isInteger(durationId)) {
    throw new Error("Choose a valid hunting ground and duration");
  }

  const [, existing, user, ground, duration, skillProgress, config, character] =
    await Promise.all([
      assertNoOtherActivity(userId, "hunting"),
      prisma.userHuntingExpedition.findUnique({
        where: { userId },
        select: { id: true, claimedAt: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { level: true, currentLocationId: true },
      }),
      prisma.huntingGround.findUnique({
        where: { id: groundId },
        select: {
          id: true,
          locationId: true,
          name: true,
          enabled: true,
          requiredHuntingLevel: true,
          accidentChance: true,
          accidentDamageMin: true,
          accidentDamageMax: true,
          location: { select: { name: true, requiredLevel: true } },
          creatures: {
            where: {
              enabled: true,
              creature: { enabled: true, kind: CreatureKind.ANIMAL },
            },
            select: {
              encounterWeight: true,
              creature: {
                select: {
                  id: true,
                  name: true,
                  asset: true,
                  ...CREATURE_ATTACK_SELECT,
                  attackChance: true,
                  drops: {
                    where: { enabled: true },
                    select: CREATURE_DROP_SELECT,
                  },
                },
              },
            },
          },
        },
      }),
      prisma.huntingDuration.findUnique({ where: { id: durationId } }),
      getTrackXpProgress({
        userId,
        trackType: "SKILL",
        trackKey: VocationalActionType.HUNTING,
      }),
      getHuntingConfig(),
      getCharacterStatSnapshot(userId),
    ]);

  if (existing?.claimedAt === null) {
    throw new Error("You already have an active activity");
  }
  if (!user) throw new Error("User not found");
  if (!user.currentLocationId)
    throw new Error("Travel to a location before hunting");
  if (!ground?.enabled || ground.locationId !== user.currentLocationId) {
    throw new Error("That hunting ground is not available at your location");
  }
  if (user.level < ground.location.requiredLevel) {
    throw new Error(
      `Requires character level ${ground.location.requiredLevel}`,
    );
  }
  if (skillProgress.level < ground.requiredHuntingLevel) {
    throw new Error(`Requires Hunting level ${ground.requiredHuntingLevel}`);
  }
  if (!duration?.enabled)
    throw new Error("That expedition duration is unavailable");
  if (
    duration.durationSeconds < 60 ||
    duration.durationSeconds > MAX_EXPEDITION_SECONDS ||
    duration.encounterRolls < 1 ||
    duration.quantityMultiplier <= 0 ||
    duration.dangerMultiplier < 0
  ) {
    throw new Error("That expedition duration is not configured correctly");
  }
  if (skillProgress.level < duration.requiredHuntingLevel) {
    throw new Error(
      `Requires Hunting level ${duration.requiredHuntingLevel} for that duration`,
    );
  }

  const pool: HuntingCreaturePoolEntry[] = ground.creatures.flatMap(
    ({ creature, encounterWeight }) => {
      const drops = buildCreatureDropPool(creature.drops, skillProgress.level);
      return encounterWeight > 0 && drops.length > 0
        ? [
            {
              creatureId: creature.id,
              name: creature.name,
              asset: creature.asset,
              encounterWeight,
              ...toCreatureAttackProfile(creature),
              attackChance: Math.min(1, Math.max(0, creature.attackChance)),
              drops,
            },
          ]
        : [];
    },
  );
  if (pool.length === 0) {
    throw new Error("No animals with obtainable materials are available here");
  }

  const vitals = await getCharacterVitalsFromSnapshot(userId, character);
  if (vitals.percent < config.minimumHealthToStartPercent) {
    throw new Error(
      `Recover to ${config.minimumHealthToStartPercent}% health before hunting`,
    );
  }
  const modifiers = modifierSnapshot(character);
  const riskConfig: HuntingRiskSnapshot = {
    damageEnabled: config.damageEnabled,
    globalDangerMultiplier: config.globalDangerMultiplier,
    maxHealthLossPercent: config.maxHealthLossPercent,
    minimumRemainingHealthPercent: config.minimumRemainingHealthPercent,
    accidentChance: ground.accidentChance,
    accidentDamageMin: ground.accidentDamageMin,
    accidentDamageMax: ground.accidentDamageMax,
  };
  const now = new Date();
  const endsAt = new Date(now.getTime() + duration.durationSeconds * 1_000);

  await prisma.$transaction(async (tx) => {
    if (existing?.claimedAt) {
      await tx.userHuntingExpedition.delete({ where: { id: existing.id } });
    }
    await tx.userHuntingExpedition.create({
      data: {
        userId,
        groundId: ground.id,
        durationId: duration.id,
        startedAt: now,
        endsAt,
        durationSeconds: duration.durationSeconds,
        encounterRolls: duration.encounterRolls,
        quantityMultiplier: duration.quantityMultiplier,
        dangerMultiplier: duration.dangerMultiplier,
        xpReward: Math.max(0, duration.xpReward),
        skillLevelSnapshot: skillProgress.level,
        luckSnapshot: modifiers.luck,
        huntingEfficiencySnapshot: modifiers.huntingEfficiency,
        armorSnapshot: modifiers.defenses.armor,
        magicResistSnapshot: modifiers.defenses.magicResist,
        evasionMeleeSnapshot: modifiers.defenses.evasionMelee,
        evasionRangedSnapshot: modifiers.defenses.evasionRanged,
        evasionMagicSnapshot: modifiers.defenses.evasionMagic,
        blockChanceSnapshot: modifiers.defenses.blockChance,
        movementSpeedSnapshot: modifiers.defenses.movementSpeed,
        maxHealthSnapshot: modifiers.defenses.maxHealth,
        fireResistSnapshot: modifiers.defenses.fireResist,
        coldResistSnapshot: modifiers.defenses.coldResist,
        lightningResistSnapshot: modifiers.defenses.lightningResist,
        poisonResistSnapshot: modifiers.defenses.poisonResist,
        resolutionSeed: randomUUID(),
        creaturePool: pool as unknown as Prisma.InputJsonValue,
        riskConfig: riskConfig as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return getHuntingExpeditionStatus(userId);
}

export async function claimHuntingExpedition(userId: string) {
  const [expedition, liveConfig] = await Promise.all([
    prisma.userHuntingExpedition.findUnique({
      where: { userId },
      select: {
        id: true,
        endsAt: true,
        claimedAt: true,
        encounterRolls: true,
        quantityMultiplier: true,
        dangerMultiplier: true,
        xpReward: true,
        skillLevelSnapshot: true,
        luckSnapshot: true,
        huntingEfficiencySnapshot: true,
        armorSnapshot: true,
        magicResistSnapshot: true,
        evasionMeleeSnapshot: true,
        evasionRangedSnapshot: true,
        evasionMagicSnapshot: true,
        blockChanceSnapshot: true,
        movementSpeedSnapshot: true,
        maxHealthSnapshot: true,
        fireResistSnapshot: true,
        coldResistSnapshot: true,
        lightningResistSnapshot: true,
        poisonResistSnapshot: true,
        resolutionSeed: true,
        durationSeconds: true,
        creaturePool: true,
        riskConfig: true,
      },
    }),
    getHuntingConfig(),
  ]);
  if (!expedition) throw new Error("No hunting expedition to claim");
  if (expedition.claimedAt)
    throw new Error("This expedition was already claimed");
  if (expedition.endsAt.getTime() > Date.now()) {
    throw new Error("Your character has not returned yet");
  }

  const pool = parseCreaturePool(expedition.creaturePool);
  const risk = parseRiskConfig(expedition.riskConfig);
  if (pool.length === 0 || !risk) {
    throw new Error("This expedition has no valid encounter snapshot");
  }
  // Departure snapshots prevent balance changes from moving the goalposts.
  // Live global controls may only make an active hunt safer, never harsher.
  const effectiveRisk: HuntingRiskSnapshot = {
    ...risk,
    ...applyLiveHuntingSafety(risk, liveConfig),
  };
  const resolution = resolveHuntingExpedition({
    pool,
    encounterRolls: expedition.encounterRolls,
    quantityMultiplier: expedition.quantityMultiplier,
    dangerMultiplier: expedition.dangerMultiplier,
    globalDangerMultiplier: effectiveRisk.globalDangerMultiplier,
    damageEnabled: effectiveRisk.damageEnabled,
    maxHealthLossPercent: effectiveRisk.maxHealthLossPercent,
    accidentChance: effectiveRisk.accidentChance,
    accidentDamageMin: effectiveRisk.accidentDamageMin,
    accidentDamageMax: effectiveRisk.accidentDamageMax,
    skillLevel: expedition.skillLevelSnapshot,
    luck: expedition.luckSnapshot,
    huntingEfficiency: expedition.huntingEfficiencySnapshot,
    defenses: {
      armor: expedition.armorSnapshot,
      magicResist: expedition.magicResistSnapshot,
      evasionMelee: expedition.evasionMeleeSnapshot,
      evasionRanged: expedition.evasionRangedSnapshot,
      evasionMagic: expedition.evasionMagicSnapshot,
      blockChance: expedition.blockChanceSnapshot,
      movementSpeed: expedition.movementSpeedSnapshot,
      maxHealth: expedition.maxHealthSnapshot,
      fireResist: expedition.fireResistSnapshot,
      coldResist: expedition.coldResistSnapshot,
      lightningResist: expedition.lightningResistSnapshot,
      poisonResist: expedition.poisonResistSnapshot,
    },
    random: createExpeditionRandom(expedition.resolutionSeed),
  });
  if (resolution.rewards.length === 0) {
    throw new Error("The expedition returned no materials");
  }

  const character = await getCharacterStatSnapshot(userId);
  const vitals = await getCharacterVitalsFromSnapshot(userId, character);
  const health = calculateHealthAfterDamage({
    currentHealth: vitals.currentHealth,
    maxHealth: vitals.maxHealth,
    requestedDamage: resolution.report.totalDamage,
    minimumRemainingHealthPercent: effectiveRisk.minimumRemainingHealthPercent,
  });
  const claimedAt = new Date();
  const appliedReport = applyHealthFloorToReport(
    resolution.report,
    health.appliedDamage,
  );
  const report: ClaimedHuntingReport = {
    ...appliedReport,
    potentialDamage: resolution.report.totalDamage,
    health: {
      before: vitals.currentHealth,
      after: health.currentHealth,
      max: vitals.maxHealth,
    },
  };

  const awarded = await prisma.$transaction(async (tx) => {
    const claimed = await tx.userHuntingExpedition.updateMany({
      where: {
        id: expedition.id,
        userId,
        claimedAt: null,
        endsAt: { lte: claimedAt },
      },
      data: {
        claimedAt,
        rewards: resolution.rewards as unknown as Prisma.InputJsonValue,
        report: report as unknown as Prisma.InputJsonValue,
      },
    });
    if (claimed.count !== 1)
      throw new Error("This expedition was already claimed");

    for (const reward of resolution.rewards) {
      const grant = await grantStackableItemToInventory({
        db: tx,
        userId,
        itemId: reward.itemId,
        rarity: reward.rarity,
        quantity: reward.quantity,
      });
      if (grant.remainingQuantity > 0) {
        throw new Error(
          "Make room in your inventory before claiming this hunt",
        );
      }
    }
    await writeCharacterHealth({
      db: tx,
      userId,
      currentHealth: health.currentHealth,
      at: claimedAt,
    });
    // Every hunting encounter is a kill.
    await recordQuestProgress({
      db: tx,
      userId,
      kills: resolution.report.encounters,
    });

    // XP and metrics commit with the loot. Sequential rather than Promise.all:
    // they share one transaction client, which runs on a single connection.
    await recordSkillWork({
      db: tx,
      userId,
      actionType: VocationalActionType.HUNTING,
      items: resolution.rewards.reduce(
        (total, reward) => total + reward.quantity,
        0,
      ),
      seconds: expedition.durationSeconds,
    });

    const playerXp = await awardXp(
      userId,
      expedition.xpReward,
      XpActionType.VOCATION,
      VocationalActionType.HUNTING,
      "Hunting expedition",
      { expeditionId: expedition.id },
      { db: tx },
    );
    const huntingXp = await awardTrackXp({
      db: tx,
      userId,
      trackType: "SKILL",
      trackKey: VocationalActionType.HUNTING,
      amount: expedition.xpReward,
      description: "Hunting expedition",
    });

    return { playerXp, huntingXp };
  });

  return {
    rewards: resolution.rewards,
    report,
    vitals: {
      ...vitals,
      currentHealth: health.currentHealth,
      percent: (health.currentHealth / vitals.maxHealth) * 100,
      regeneratedAt: claimedAt.toISOString(),
    },
    xp: {
      character: awarded.playerXp.xpGained,
      hunting: awarded.huntingXp.xpGained,
    },
    ...(await getHuntingExpeditionStatus(userId)),
  };
}

export async function cancelHuntingExpedition(userId: string) {
  const expedition = await prisma.userHuntingExpedition.findUnique({
    where: { userId },
    select: { id: true, endsAt: true, claimedAt: true },
  });
  if (!expedition || expedition.claimedAt) {
    throw new Error("No active Hunting expedition");
  }
  if (expedition.endsAt.getTime() <= Date.now()) {
    throw new Error("Your hunter has returned; claim the expedition instead");
  }
  await prisma.userHuntingExpedition.delete({ where: { id: expedition.id } });
  return { ok: true };
}
