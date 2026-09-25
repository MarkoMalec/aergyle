import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "~/generated/prisma/client";
import {
  CreatureKind,
  XpActionType,
  type DungeonDifficulty,
} from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { assertNoOtherActivity } from "~/server/activity";
import {
  getCharacterVitalsFromSnapshot,
  writeCharacterHealth,
} from "~/server/combat";
import {
  CREATURE_ATTACK_SELECT,
  parseCreatureAttackProfile,
  toCreatureAttackProfile,
} from "~/server/creatures/attackProfile";
import {
  buildCreatureDropPool,
  CREATURE_DROP_SELECT,
  type CreatureLootReward,
  parseCreatureDropPool,
  parseLootRewards,
} from "~/server/creatures/loot";
import { createExpeditionRandom } from "~/server/expeditions/random";
import { recordQuestProgress } from "~/server/settlements/quests";
import { getCharacterStatSnapshot } from "~/server/stats";
import { grantStackableItemToInventory } from "~/server/items/grantItem";
import { awardXp } from "~/utils/leveling";
import {
  combatSnapshotFromStats,
  isFightableMonster,
  resolveDungeonRun,
  type DungeonCombatSnapshot,
  type DungeonDeathRules,
  type DungeonMonsterPoolEntry,
  type DungeonReport,
} from "./resolver";
import { estimateRecommendedHealth } from "./simulator";
import { finiteNumber } from "~/server/expeditions/rewards";

const MAX_RUN_SECONDS = 7 * 24 * 60 * 60;

const DEFAULT_DUNGEON_CONFIG = {
  minimumHealthToStartPercent: 25,
  deathLootKeepChance: 0.35,
  deathLootQuantityPercent: 25,
} as const;

type ClaimedDungeonReport = DungeonReport & {
  xp?: number;
  health?: { before: number; after: number; max: number };
};

export type DungeonRunStatus = {
  run: null | {
    id: number;
    status: "ACTIVE" | "READY" | "CLAIMED";
    startedAt: string;
    endsAt: string;
    claimedAt: string | null;
    durationSeconds: number;
    dungeon: {
      id: number;
      name: string;
      difficulty: DungeonDifficulty;
      location: { id: number; name: string };
    };
    rewards: CreatureLootReward[];
    report: ClaimedDungeonReport | null;
  };
};

const COMBAT_SNAPSHOT_KEYS = [
  "maxHealth",
  "physicalDamageMin",
  "physicalDamageMax",
  "magicDamageMin",
  "magicDamageMax",
  "criticalChance",
  "criticalDamage",
  "attackSpeed",
  "armor",
  "magicResist",
  "evasionMelee",
  "evasionRanged",
  "evasionMagic",
  "blockChance",
  "fireResist",
  "coldResist",
  "lightningResist",
  "poisonResist",
  "luck",
] as const satisfies readonly (keyof DungeonCombatSnapshot)[];

const MONSTER_COMBAT_SELECT = {
  id: true,
  name: true,
  asset: true,
  ...CREATURE_ATTACK_SELECT,
  health: true,
  armor: true,
  magicResist: true,
  evasion: true,
  blockChance: true,
} satisfies Prisma.CreatureSelect;

type MonsterCombatRow = Prisma.CreatureGetPayload<{
  select: typeof MONSTER_COMBAT_SELECT;
}>;

// Only enabled monsters are ever part of a dungeon population.
const ACTIVE_MONSTERS_WHERE = {
  enabled: true,
  creature: { enabled: true, kind: CreatureKind.MONSTER },
} satisfies Prisma.DungeonMonsterWhereInput;

async function getDungeonConfig() {
  return (
    (await prisma.dungeonConfig.findUnique({ where: { id: 1 } })) ??
    DEFAULT_DUNGEON_CONFIG
  );
}

function toMonsterPoolEntry(
  row: { minCount: number; maxCount: number; creature: MonsterCombatRow },
  drops: DungeonMonsterPoolEntry["drops"],
): DungeonMonsterPoolEntry {
  const { creature } = row;
  return {
    creatureId: creature.id,
    name: creature.name,
    asset: creature.asset,
    minCount: Math.max(0, row.minCount),
    maxCount: Math.max(0, row.maxCount),
    ...toCreatureAttackProfile(creature),
    health: Math.max(0, creature.health),
    armor: Math.max(0, creature.armor),
    magicResist: Math.max(0, creature.magicResist),
    evasion: Math.max(0, creature.evasion),
    blockChance: Math.max(0, creature.blockChance),
    drops,
  };
}

function parseMonsterPool(value: unknown): DungeonMonsterPoolEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const attack = parseCreatureAttackProfile(row);
    if (
      !attack ||
      typeof row.creatureId !== "number" ||
      typeof row.name !== "string" ||
      typeof row.asset !== "string"
    ) {
      return [];
    }
    const whole = (key: string) =>
      Math.max(0, Math.floor(finiteNumber(row[key])));
    const positive = (key: string) => Math.max(0, finiteNumber(row[key]));
    return [
      {
        creatureId: row.creatureId,
        name: row.name,
        asset: row.asset,
        minCount: whole("minCount"),
        maxCount: whole("maxCount"),
        ...attack,
        health: positive("health"),
        armor: positive("armor"),
        magicResist: positive("magicResist"),
        evasion: positive("evasion"),
        blockChance: positive("blockChance"),
        drops: parseCreatureDropPool(row.drops),
      },
    ];
  });
}

function parseCombatSnapshot(value: unknown): DungeonCombatSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const snapshot = Object.fromEntries(
    COMBAT_SNAPSHOT_KEYS.map((key) => [key, finiteNumber(row[key])]),
  ) as DungeonCombatSnapshot;
  return snapshot.maxHealth > 0 ? snapshot : null;
}

function parseDeathRules(value: unknown): DungeonDeathRules | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.keepChance !== "number" ||
    typeof row.quantityPercent !== "number"
  ) {
    return null;
  }
  return { keepChance: row.keepChance, quantityPercent: row.quantityPercent };
}

function parseReport(value: unknown): ClaimedDungeonReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.outcome !== "CLEARED" && row.outcome !== "DEFEATED") return null;
  const creatureRef = (entry: unknown) => {
    if (!entry || typeof entry !== "object") return null;
    const creature = entry as Record<string, unknown>;
    return typeof creature.creatureId === "number" &&
      typeof creature.name === "string" &&
      typeof creature.asset === "string"
      ? {
          creatureId: creature.creatureId,
          name: creature.name,
          asset: creature.asset,
          damageTaken: Math.max(0, finiteNumber(creature.damageTaken)),
        }
      : null;
  };
  const defeatedBy = creatureRef(row.defeatedBy);
  const healthRow =
    row.health && typeof row.health === "object"
      ? (row.health as Record<string, unknown>)
      : null;
  return {
    outcome: row.outcome,
    encounters: Array.isArray(row.encounters)
      ? row.encounters.flatMap((entry) => creatureRef(entry) ?? [])
      : [],
    defeatedBy: defeatedBy
      ? {
          creatureId: defeatedBy.creatureId,
          name: defeatedBy.name,
          asset: defeatedBy.asset,
        }
      : null,
    damageTaken: Math.max(0, finiteNumber(row.damageTaken)),
    evaded: Math.max(0, Math.floor(finiteNumber(row.evaded))),
    blocked: Math.max(0, Math.floor(finiteNumber(row.blocked))),
    criticalHits: Math.max(0, Math.floor(finiteNumber(row.criticalHits))),
    xp: typeof row.xp === "number" ? Math.max(0, row.xp) : undefined,
    health: healthRow
      ? {
          before: Math.max(0, finiteNumber(healthRow.before)),
          after: Math.max(0, finiteNumber(healthRow.after)),
          max: Math.max(1, finiteNumber(healthRow.max, 1)),
        }
      : undefined,
  };
}

export async function getDungeonRunStatus(
  userId: string,
): Promise<DungeonRunStatus> {
  const run = await prisma.userDungeonRun.findUnique({
    where: { userId },
    select: {
      id: true,
      startedAt: true,
      endsAt: true,
      claimedAt: true,
      durationSeconds: true,
      rewards: true,
      report: true,
      dungeon: {
        select: {
          id: true,
          name: true,
          difficulty: true,
          location: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!run) return { run: null };
  return {
    run: {
      id: run.id,
      status: run.claimedAt
        ? "CLAIMED"
        : run.endsAt.getTime() <= Date.now()
          ? "READY"
          : "ACTIVE",
      startedAt: run.startedAt.toISOString(),
      endsAt: run.endsAt.toISOString(),
      claimedAt: run.claimedAt?.toISOString() ?? null,
      durationSeconds: run.durationSeconds,
      dungeon: run.dungeon,
      rewards: parseLootRewards(run.rewards),
      report: parseReport(run.report),
    },
  };
}

export async function getDungeonPageData(userId: string) {
  const [user, config, character, status] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        level: true,
        currentLocation: {
          select: {
            id: true,
            name: true,
            requiredLevel: true,
            dungeons: {
              where: { enabled: true },
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
              select: {
                id: true,
                name: true,
                description: true,
                difficulty: true,
                requiredLevel: true,
                durationSeconds: true,
                packSize: true,
                xpReward: true,
                monsters: {
                  where: ACTIVE_MONSTERS_WHERE,
                  orderBy: { creature: { name: "asc" } },
                  select: {
                    minCount: true,
                    maxCount: true,
                    creature: { select: MONSTER_COMBAT_SELECT },
                  },
                },
              },
            },
          },
        },
      },
    }),
    getDungeonConfig(),
    getCharacterStatSnapshot(userId),
    getDungeonRunStatus(userId),
  ]);
  if (!user) throw new Error("User not found");
  const vitals = await getCharacterVitalsFromSnapshot(userId, character);
  const combat = combatSnapshotFromStats(character.finalStats);
  const location = user.currentLocation;

  return {
    level: user.level,
    vitals,
    combat,
    minimumHealthToStartPercent: config.minimumHealthToStartPercent,
    location: location
      ? {
          id: location.id,
          name: location.name,
          unlocked: user.level >= location.requiredLevel,
          dungeons: location.dungeons.map((dungeon) => {
            const pool = dungeon.monsters
              .map((row) => toMonsterPoolEntry(row, []))
              .filter(isFightableMonster);
            return {
              id: dungeon.id,
              name: dungeon.name,
              description: dungeon.description,
              difficulty: dungeon.difficulty,
              requiredLevel: dungeon.requiredLevel,
              unlocked: user.level >= dungeon.requiredLevel,
              durationSeconds: dungeon.durationSeconds,
              packSize: dungeon.packSize,
              xpReward: dungeon.xpReward,
              recommendedHealth:
                pool.length > 0
                  ? estimateRecommendedHealth({
                      pool,
                      combat,
                      packSize: dungeon.packSize,
                      seed: `recommended-health:${dungeon.id}`,
                    })
                  : null,
              // Monster identities only; population counts stay server-side.
              monsters: pool.map((monster) => ({
                id: monster.creatureId,
                name: monster.name,
                asset: monster.asset,
                attackStyle: monster.attackStyle,
                damageType: monster.damageType,
              })),
            };
          }),
        }
      : null,
    ...status,
  };
}

export async function startDungeonRun(params: {
  userId: string;
  dungeonId: number;
}) {
  const { userId, dungeonId } = params;
  if (!Number.isInteger(dungeonId)) throw new Error("Choose a valid dungeon");

  const [, existing, user, dungeon, config, character] = await Promise.all([
    assertNoOtherActivity(userId, "dungeon"),
    prisma.userDungeonRun.findUnique({
      where: { userId },
      select: { id: true, claimedAt: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, currentLocationId: true },
    }),
    prisma.dungeon.findUnique({
      where: { id: dungeonId },
      select: {
        id: true,
        locationId: true,
        name: true,
        enabled: true,
        requiredLevel: true,
        durationSeconds: true,
        packSize: true,
        xpReward: true,
        location: { select: { requiredLevel: true } },
        monsters: {
          where: ACTIVE_MONSTERS_WHERE,
          select: {
            minCount: true,
            maxCount: true,
            creature: {
              select: {
                ...MONSTER_COMBAT_SELECT,
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
    getDungeonConfig(),
    getCharacterStatSnapshot(userId),
  ]);

  if (existing?.claimedAt === null) {
    throw new Error("You already have an active activity");
  }
  if (!user) throw new Error("User not found");
  if (!user.currentLocationId) {
    throw new Error("Travel to a location before entering a dungeon");
  }
  if (!dungeon?.enabled || dungeon.locationId !== user.currentLocationId) {
    throw new Error("That dungeon is not available at your location");
  }
  const requiredLevel = Math.max(
    dungeon.requiredLevel,
    dungeon.location.requiredLevel,
  );
  if (user.level < requiredLevel) {
    throw new Error(`Requires character level ${requiredLevel}`);
  }
  if (
    dungeon.durationSeconds < 60 ||
    dungeon.durationSeconds > MAX_RUN_SECONDS
  ) {
    throw new Error("That dungeon is not configured correctly");
  }

  const pool = dungeon.monsters
    .map((row) =>
      toMonsterPoolEntry(
        row,
        buildCreatureDropPool(row.creature.drops, user.level),
      ),
    )
    .filter(isFightableMonster);
  if (pool.length === 0) {
    throw new Error("No monsters are lurking in this dungeon right now");
  }

  const vitals = await getCharacterVitalsFromSnapshot(userId, character);
  if (
    vitals.currentHealth <= 0 ||
    vitals.percent < config.minimumHealthToStartPercent
  ) {
    throw new Error(
      `Recover to ${config.minimumHealthToStartPercent}% health before entering a dungeon`,
    );
  }
  const deathRules: DungeonDeathRules = {
    keepChance: config.deathLootKeepChance,
    quantityPercent: config.deathLootQuantityPercent,
  };
  const now = new Date();
  const endsAt = new Date(now.getTime() + dungeon.durationSeconds * 1_000);

  await prisma.$transaction(async (tx) => {
    if (existing?.claimedAt) {
      await tx.userDungeonRun.delete({ where: { id: existing.id } });
    }
    await tx.userDungeonRun.create({
      data: {
        userId,
        dungeonId: dungeon.id,
        startedAt: now,
        endsAt,
        durationSeconds: dungeon.durationSeconds,
        xpReward: Math.max(0, dungeon.xpReward),
        packSize: dungeon.packSize,
        startingHealth: vitals.currentHealth,
        combatSnapshot: combatSnapshotFromStats(
          character.finalStats,
        ) as unknown as Prisma.InputJsonValue,
        monsterPool: pool as unknown as Prisma.InputJsonValue,
        deathRules: deathRules as unknown as Prisma.InputJsonValue,
        resolutionSeed: randomUUID(),
      },
    });
  });

  return getDungeonRunStatus(userId);
}

export async function claimDungeonRun(userId: string) {
  const run = await prisma.userDungeonRun.findUnique({
    where: { userId },
    select: {
      id: true,
      endsAt: true,
      claimedAt: true,
      xpReward: true,
      packSize: true,
      startingHealth: true,
      combatSnapshot: true,
      monsterPool: true,
      deathRules: true,
      resolutionSeed: true,
      dungeonId: true,
      dungeon: { select: { name: true } },
    },
  });
  if (!run) throw new Error("No dungeon run to claim");
  if (run.claimedAt) throw new Error("This dungeon run was already claimed");
  if (run.endsAt.getTime() > Date.now()) {
    throw new Error("Your character is still inside the dungeon");
  }

  const pool = parseMonsterPool(run.monsterPool);
  const combat = parseCombatSnapshot(run.combatSnapshot);
  const deathRules = parseDeathRules(run.deathRules);
  if (pool.length === 0 || !combat || !deathRules) {
    throw new Error("This dungeon run has no valid combat snapshot");
  }
  // The seed makes a retry (e.g. after a full inventory) resolve identically.
  const resolution = resolveDungeonRun({
    pool,
    combat,
    startingHealth: run.startingHealth,
    packSize: run.packSize,
    deathRules,
    random: createExpeditionRandom(run.resolutionSeed),
  });
  const cleared = resolution.report.outcome === "CLEARED";

  const character = await getCharacterStatSnapshot(userId);
  const vitals = await getCharacterVitalsFromSnapshot(userId, character);
  // A cleared run always leaves the character standing, even if a timed food
  // bonus to maximum health expired while they were inside.
  const healthAfter = cleared
    ? Math.max(
        1,
        Math.round(
          (vitals.currentHealth - resolution.report.damageTaken) * 1_000,
        ) / 1_000,
      )
    : 0;
  const xpReward = cleared ? run.xpReward : 0;
  const claimedAt = new Date();
  const report: ClaimedDungeonReport = {
    ...resolution.report,
    xp: xpReward,
    health: {
      before: vitals.currentHealth,
      after: healthAfter,
      max: vitals.maxHealth,
    },
  };

  const playerXp = await prisma.$transaction(async (tx) => {
    const claimed = await tx.userDungeonRun.updateMany({
      where: {
        id: run.id,
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
    if (claimed.count !== 1) {
      throw new Error("This dungeon run was already claimed");
    }

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
          "Make room in your inventory before claiming this dungeon run",
        );
      }
    }
    await writeCharacterHealth({
      db: tx,
      userId,
      currentHealth: healthAfter,
      at: claimedAt,
    });
    await recordQuestProgress({
      db: tx,
      userId,
      kills: resolution.kills,
      clearedDungeonId: cleared ? run.dungeonId : null,
    });

    // XP commits with the loot, so a crash cannot leave the run claimed and
    // the reward unpaid.
    return xpReward > 0
      ? await awardXp(
          userId,
          xpReward,
          XpActionType.DUNGEON,
          undefined,
          `Dungeon cleared: ${run.dungeon.name}`,
          { dungeonRunId: run.id },
          { db: tx },
        )
      : null;
  });

  return {
    outcome: resolution.report.outcome,
    rewards: resolution.rewards,
    report,
    vitals: {
      ...vitals,
      currentHealth: healthAfter,
      percent: (healthAfter / vitals.maxHealth) * 100,
      regeneratedAt: claimedAt.toISOString(),
    },
    xp: playerXp?.xpGained ?? 0,
    ...(await getDungeonRunStatus(userId)),
  };
}

export async function cancelDungeonRun(userId: string) {
  const run = await prisma.userDungeonRun.findUnique({
    where: { userId },
    select: { id: true, endsAt: true, claimedAt: true },
  });
  if (!run || run.claimedAt) throw new Error("No active dungeon run");
  if (run.endsAt.getTime() <= Date.now()) {
    throw new Error("Your run has finished; claim the results instead");
  }
  // Leaving early forfeits everything, but costs no health.
  await prisma.userDungeonRun.delete({ where: { id: run.id } });
  return { ok: true };
}
