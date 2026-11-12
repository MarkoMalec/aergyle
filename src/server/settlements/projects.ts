import "server-only";

import type { Prisma, PrismaClient } from "~/generated/prisma/client";
import { XpActionType, type ItemRarity } from "~/generated/prisma/enums";
import { settlementHref } from "~/game/settlements";
import { prisma } from "~/lib/prisma";
import { notifyMany } from "~/server/communication";
import { consumeInventoryItems } from "~/server/items/consumeItems";
import { grantStackableItemToInventory } from "~/server/items/grantItem";
import { awardXp } from "~/utils/leveling";
import { assertPresentAt } from "./access";
import {
  contributionShare,
  dueRound,
  playerContributionCap,
  projectPhase,
  stageRewardFor,
  sumProjectEffects,
  type ProjectEffectKind,
  type ProjectPhase,
  type StageReward,
} from "./rules";

const LEADERBOARD_SIZE = 10;

type Db = Prisma.TransactionClient | PrismaClient;

const TIMING_SELECT = {
  id: true,
  repeat: true,
  repeatHours: true,
  maxRounds: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  round: true,
  completedAt: true,
  unlockMode: true,
} as const;

type Timing = Prisma.CommunityProjectGetPayload<{ select: typeof TIMING_SELECT }>;

// ============================================
// ROUNDS
// ============================================

/**
 * Starts a fresh round: progress and contributions go, unclaimed rewards stay.
 * WHILE_REACHED stages lose their unlocks and effects. Compare-and-set on the
 * round, so two requests settling the same round reset it once.
 */
async function startRound(
  db: Db,
  project: Pick<Timing, "id" | "round" | "unlockMode">,
  next: { round: number; startedAt: Date },
) {
  const moved = await db.communityProject.updateMany({
    where: { id: project.id, round: project.round },
    data: { round: next.round, roundStartedAt: next.startedAt, completedAt: null },
  });
  if (moved.count !== 1) return false;
  await db.communityProjectContribution.deleteMany({
    where: { requirement: { stage: { projectId: project.id } } },
  });
  await db.communityProjectRequirement.updateMany({
    where: { stage: { projectId: project.id } },
    data: { contributed: 0 },
  });
  await db.communityProjectStage.updateMany({
    where: { projectId: project.id },
    data: {
      completedAt: null,
      ...(project.unlockMode === "WHILE_REACHED" ? { active: false } : {}),
    },
  });
  return true;
}

/**
 * Moves recurring projects on to the round that should be running. Called
 * wherever projects are read, so no background job is needed.
 */
export async function settleProjectRounds(
  where: Prisma.CommunityProjectWhereInput,
  now = new Date(),
) {
  const projects = await prisma.communityProject.findMany({
    where: { ...where, repeat: { not: "ONCE" } },
    select: TIMING_SELECT,
  });
  for (const project of projects) {
    const next = dueRound(project, now);
    if (next) {
      await prisma.$transaction((tx) => startRound(tx, project, next));
    }
  }
}

/** Admin "start a new round now": wipes this round's progress. */
export async function restartProjectRound(projectId: number) {
  const project = await prisma.communityProject.findUniqueOrThrow({
    where: { id: projectId },
    select: TIMING_SELECT,
  });
  await prisma.$transaction((tx) =>
    startRound(tx, project, { round: project.round + 1, startedAt: new Date() }),
  );
}

// ============================================
// STAGES
// ============================================

/**
 * Marks stages reached in order (a stage counts only once every earlier one
 * is reached) and pays their contributors; reopens stages an admin raised.
 * A stage without items is never reached. Returns the newly reached stages.
 */
export async function syncProjectStages(db: Db, projectId: number, now = new Date()) {
  const project = await db.communityProject.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      round: true,
      completedAt: true,
      unlockMode: true,
      rewardSplit: true,
      rewardMinSharePercent: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          completedAt: true,
          rewardGold: true,
          rewardXp: true,
          rewardItems: { select: { itemId: true, quantity: true } },
          requirements: {
            select: {
              quantity: true,
              contributed: true,
              contributions: { select: { userId: true, quantity: true } },
            },
          },
        },
      },
    },
  });

  let reaching = true;
  const reached: Array<{ id: number; name: string; position: number; paid: string[] }> = [];
  for (const stage of project.stages) {
    reaching =
      reaching &&
      stage.requirements.length > 0 &&
      stage.requirements.every((row) => row.contributed >= row.quantity);
    if (reaching && !stage.completedAt) {
      const claimed = await db.communityProjectStage.updateMany({
        where: { id: stage.id, completedAt: null },
        data: { completedAt: now, active: true },
      });
      if (claimed.count !== 1) continue;
      const paid = await payStage(db, projectId, project, stage);
      reached.push({ id: stage.id, name: stage.name, position: stage.position, paid });
    } else if (!reaching && stage.completedAt) {
      await db.communityProjectStage.update({
        where: { id: stage.id },
        data: {
          completedAt: null,
          ...(project.unlockMode === "WHILE_REACHED" ? { active: false } : {}),
        },
      });
    }
  }
  const allReached = reaching && project.stages.length > 0;
  if (allReached !== (project.completedAt !== null)) {
    await db.communityProject.update({
      where: { id: projectId },
      data: { completedAt: allReached ? now : null },
    });
  }
  return reached;
}

/** Writes each qualifying contributor's reward for a reached stage. */
async function payStage(
  db: Db,
  projectId: number,
  project: { round: number; rewardSplit: "FLAT" | "BY_SHARE"; rewardMinSharePercent: number },
  stage: {
    id: number;
    rewardGold: Prisma.Decimal;
    rewardXp: number;
    rewardItems: Array<{ itemId: number; quantity: number }>;
    requirements: Array<{
      quantity: number;
      contributions: Array<{ userId: string; quantity: number }>;
    }>;
  },
) {
  const reward: StageReward = {
    gold: Number(stage.rewardGold),
    xp: stage.rewardXp,
    items: stage.rewardItems,
  };
  const contributors = new Set(
    stage.requirements.flatMap((row) => row.contributions.map((c) => c.userId)),
  );
  const rows = [...contributors].flatMap((userId) => {
    const share = contributionShare(
      stage.requirements.map((row) => ({
        quantity: row.quantity,
        contributed: row.contributions.find((c) => c.userId === userId)?.quantity ?? 0,
      })),
    );
    const payout = stageRewardFor(
      share,
      reward,
      project.rewardSplit,
      project.rewardMinSharePercent,
    );
    return payout
      ? [{ userId, projectId, stageId: stage.id, round: project.round, ...payout }]
      : [];
  });
  if (rows.length > 0) {
    await db.communityProjectReward.createMany({ data: rows, skipDuplicates: true });
  }
  return [...contributors];
}

// ============================================
// PLAYER VIEW
// ============================================

export type ProjectStageView = {
  position: number;
  name: string;
  description: string | null;
  image: string | null;
  state: "reached" | "current" | "upcoming";
  requirements: Array<{
    item: { id: number; name: string; sprite: string; rarity: ItemRarity };
    quantity: number;
    contributed: number;
    mine: number;
    held: number;
    /** Most this player may still give, after the per-player cap. */
    canGive: number;
  }>;
  reward: { gold: number; xp: number; items: Array<{ name: string; quantity: number }> };
};

export type ProjectView = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  completedAt: string | null;
  phase: ProjectPhase;
  until: string | null;
  round: number;
  repeat: "ONCE" | "SCHEDULE" | "AFTER_COMPLETION";
  /** Why the player can't contribute, if they can't. */
  blocked: string | null;
  maxSharePercent: number | null;
  rewardSplit: "FLAT" | "BY_SHARE";
  rewardMinSharePercent: number;
  stages: ProjectStageView[];
  stageCount: number;
  /** Requirements of every stage in this round, for the overall progress bar. */
  requirements: Array<{ quantity: number; contributed: number }>;
  unclaimed: Array<{ id: number; stage: string; round: number; gold: number; xp: number; items: number }>;
  contributors: number;
  share: number;
  rank: number | null;
  leaderboard: Array<{ name: string; share: number; you: boolean }>;
};

/** Projects players can see now, with the player's progress and rewards. */
export async function getSettlementProjects(
  userId: string,
  settlementId: number,
  held: ReadonlyMap<number, number>,
  level: number,
): Promise<ProjectView[]> {
  const now = new Date();
  await settleProjectRounds({ settlementId, enabled: true }, now);
  const [projects, skills] = await Promise.all([
    prisma.communityProject.findMany({
      where: { settlementId, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        ...TIMING_SELECT,
        name: true,
        description: true,
        image: true,
        showFutureStages: true,
        minLevel: true,
        requiredSkillId: true,
        requiredSkillLevel: true,
        requiredSkill: { select: { skill_name: true } },
        maxSharePercent: true,
        rewardSplit: true,
        rewardMinSharePercent: true,
        rewards: {
          where: { userId, claimedAt: null },
          orderBy: { id: "asc" },
          select: {
            id: true,
            round: true,
            gold: true,
            xp: true,
            items: true,
            stage: { select: { name: true } },
          },
        },
        stages: {
          orderBy: { position: "asc" },
          select: {
            position: true,
            name: true,
            description: true,
            image: true,
            completedAt: true,
            rewardGold: true,
            rewardXp: true,
            rewardItems: { select: { quantity: true, item: { select: { name: true } } } },
            requirements: {
              orderBy: { id: "asc" },
              select: {
                quantity: true,
                contributed: true,
                item: { select: { id: true, name: true, sprite: true, rarity: true } },
                contributions: {
                  select: { userId: true, quantity: true, user: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user_skills.findMany({
      where: { user_id: userId },
      select: { skill_id: true, level: true },
    }),
  ]);
  const skillLevel = new Map(skills.map((row) => [row.skill_id, row.level]));

  return projects.flatMap((project) => {
    const { phase, until } = projectPhase(project, now);
    if (phase === "upcoming" || phase === "ended") return [];

    const requirements = project.stages.flatMap((stage) => stage.requirements);
    const contributors = new Map<string, string>();
    for (const requirement of requirements) {
      for (const row of requirement.contributions) {
        contributors.set(row.userId, row.user.name ?? "Adventurer");
      }
    }
    const shareOf = (id: string) =>
      contributionShare(
        requirements.map((requirement) => ({
          quantity: requirement.quantity,
          contributed:
            requirement.contributions.find((row) => row.userId === id)?.quantity ?? 0,
        })),
      );
    const ranked = [...contributors]
      .map(([id, name]) => ({ id, name, share: shareOf(id) }))
      .sort((a, b) => b.share - a.share);
    const rankIndex = ranked.findIndex((row) => row.id === userId);

    const blocked =
      level < project.minLevel
        ? `Requires character level ${project.minLevel}`
        : project.requiredSkillId &&
            (skillLevel.get(project.requiredSkillId) ?? 1) < project.requiredSkillLevel
          ? `Requires ${project.requiredSkill?.skill_name ?? "a skill"} level ${project.requiredSkillLevel}`
          : null;
    const currentIndex = project.stages.findIndex((stage) => !stage.completedAt);

    return [
      {
        id: project.id,
        name: project.name,
        description: project.description,
        image: project.image,
        completedAt: project.completedAt?.toISOString() ?? null,
        phase,
        until: until?.toISOString() ?? null,
        round: project.round,
        repeat: project.repeat,
        blocked,
        maxSharePercent: project.maxSharePercent,
        rewardSplit: project.rewardSplit,
        rewardMinSharePercent: project.rewardMinSharePercent,
        stageCount: project.stages.length,
        stages: project.stages
          .map((stage, index): ProjectStageView => ({
            position: stage.position,
            name: stage.name,
            description: stage.description,
            image: stage.image,
            state: stage.completedAt
              ? "reached"
              : index === currentIndex
                ? "current"
                : "upcoming",
            requirements: stage.requirements.map((requirement) => {
              const mine =
                requirement.contributions.find((row) => row.userId === userId)?.quantity ?? 0;
              const has = held.get(requirement.item.id) ?? 0;
              const cap = playerContributionCap(requirement.quantity, project.maxSharePercent);
              return {
                item: requirement.item,
                quantity: requirement.quantity,
                contributed: Math.min(requirement.quantity, requirement.contributed),
                mine,
                held: has,
                canGive: Math.max(
                  0,
                  Math.min(has, cap - mine, requirement.quantity - requirement.contributed),
                ),
              };
            }),
            reward: {
              gold: Number(stage.rewardGold),
              xp: stage.rewardXp,
              items: stage.rewardItems.map((row) => ({
                name: row.item.name,
                quantity: row.quantity,
              })),
            },
          }))
          .filter((stage) => project.showFutureStages || stage.state !== "upcoming"),
        requirements: requirements.map((row) => ({
          quantity: row.quantity,
          contributed: row.contributed,
        })),
        unclaimed: project.rewards.map((reward) => ({
          id: reward.id,
          stage: reward.stage.name,
          round: reward.round,
          gold: Number(reward.gold),
          xp: reward.xp,
          items: (reward.items as Array<{ quantity: number }>).reduce(
            (sum, row) => sum + row.quantity,
            0,
          ),
        })),
        contributors: ranked.length,
        share: rankIndex >= 0 ? ranked[rankIndex]!.share : 0,
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
        leaderboard: ranked.slice(0, LEADERBOARD_SIZE).map((row) => ({
          name: row.name,
          share: row.share,
          you: row.id === userId,
        })),
      },
    ];
  });
}

// ============================================
// CONTRIBUTING AND CLAIMING
// ============================================

export async function contributeToProject(params: {
  userId: string;
  projectId: number;
  itemId: number;
  quantity: number;
}) {
  const { userId, projectId, itemId, quantity } = params;
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Choose a valid quantity");
  }
  const now = new Date();
  await settleProjectRounds({ id: projectId }, now);

  const project = await prisma.communityProject.findFirst({
    where: { id: projectId, enabled: true, settlement: { enabled: true } },
    select: {
      ...TIMING_SELECT,
      name: true,
      minLevel: true,
      requiredSkillId: true,
      requiredSkillLevel: true,
      requiredSkill: { select: { skill_name: true } },
      maxSharePercent: true,
      settlement: {
        select: { id: true, name: true, location: { select: { id: true, name: true } } },
      },
      stages: {
        where: { completedAt: null },
        orderBy: { position: "asc" },
        take: 1,
        select: {
          requirements: {
            where: { itemId },
            select: {
              id: true,
              quantity: true,
              contributed: true,
              contributions: { where: { userId }, select: { quantity: true } },
            },
          },
        },
      },
    },
  });
  if (!project) throw new Error("That project is not available");
  const { phase } = projectPhase(project, now);
  if (phase !== "open") {
    throw new Error(
      phase === "waiting"
        ? "This round is finished; the next one has not started yet"
        : phase === "upcoming"
          ? "This project has not started yet"
          : "This project is closed",
    );
  }
  await assertPresentAt(userId, project.settlement.location);

  const [user, skill] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { level: true } }),
    project.requiredSkillId
      ? prisma.user_skills.findUnique({
          where: { user_id_skill_id: { user_id: userId, skill_id: project.requiredSkillId } },
          select: { level: true },
        })
      : null,
  ]);
  if ((user?.level ?? 1) < project.minLevel) {
    throw new Error(`You need character level ${project.minLevel} to help`);
  }
  if (project.requiredSkillId && (skill?.level ?? 1) < project.requiredSkillLevel) {
    throw new Error(
      `You need ${project.requiredSkill?.skill_name ?? "that skill"} level ${project.requiredSkillLevel} to help`,
    );
  }

  const requirement = project.stages[0]?.requirements[0];
  if (!requirement) throw new Error("The current stage doesn't need that item");
  const remaining = requirement.quantity - requirement.contributed;
  if (remaining <= 0) throw new Error("Enough of that item has been gathered");
  if (quantity > remaining) {
    throw new Error(`Only ${remaining} more ${remaining === 1 ? "is" : "are"} needed`);
  }
  const cap = playerContributionCap(requirement.quantity, project.maxSharePercent);
  const mine = requirement.contributions[0]?.quantity ?? 0;
  if (mine + quantity > cap) {
    throw new Error(
      cap - mine > 0
        ? `You can give at most ${cap - mine} more of this item`
        : "You have given your share of this item; let others help",
    );
  }

  const reached = await prisma.$transaction(async (tx) => {
    // Compare-and-set, so two players can never overfill a requirement.
    const reserved = await tx.communityProjectRequirement.updateMany({
      where: { id: requirement.id, contributed: requirement.contributed },
      data: { contributed: { increment: quantity } },
    });
    if (reserved.count !== 1) {
      throw new Error("Someone contributed at the same moment. Please try again.");
    }
    await consumeInventoryItems({ db: tx, userId, items: [{ itemId, quantity }] });
    await tx.communityProjectContribution.upsert({
      where: { requirementId_userId: { requirementId: requirement.id, userId } },
      create: { requirementId: requirement.id, userId, quantity },
      update: { quantity: { increment: quantity } },
    });
    return syncProjectStages(tx, projectId, now);
  });

  // Two players filling the last requirements at once each see the other
  // unfilled in their snapshot; re-check after commit (idempotent per stage).
  const late = reached.length > 0 ? [] : await syncProjectStages(prisma, projectId);
  const all = [...reached, ...late];
  await announceStages(project.name, project.settlement, all);
  return { name: project.name, completed: all.length > 0, stage: all.at(-1)?.name ?? null };
}

/**
 * Tells each stage's contributors it was reached. The notification is the
 * only word they get if they are not in the settlement at that moment.
 */
async function announceStages(
  name: string,
  settlement: { id: number; name: string },
  reached: Array<{ name: string; position: number; paid: string[] }>,
) {
  for (const stage of reached) {
    await notifyMany(stage.paid, {
      category: "SETTLEMENT",
      title: stage.name === name ? `${name} is complete` : `${name}: ${stage.name} reached`,
      body: `${settlement.name} reached a goal you helped with. Anything it unlocked is open now, and any reward you earned waits for you there.`,
      href: settlementHref(settlement.id),
    });
  }
}

/** Pays out a reward the player earned from a reached stage. */
export async function claimProjectReward(userId: string, rewardId: number) {
  const reward = await prisma.communityProjectReward.findFirst({
    where: { id: rewardId, userId },
    select: {
      gold: true,
      xp: true,
      items: true,
      claimedAt: true,
      stage: { select: { name: true } },
      project: {
        select: {
          name: true,
          settlement: { select: { location: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!reward) throw new Error("That reward is not yours to claim");
  if (reward.claimedAt) throw new Error("You already claimed this reward");
  await assertPresentAt(userId, reward.project.settlement.location);

  const items = reward.items as Array<{ itemId: number; quantity: number }>;
  const templates = await prisma.item.findMany({
    where: { id: { in: items.map((row) => row.itemId) } },
    select: { id: true, rarity: true },
  });
  const gold = Number(reward.gold);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.communityProjectReward.updateMany({
      where: { id: rewardId, claimedAt: null },
      data: { claimedAt: new Date() },
    });
    if (claimed.count !== 1) throw new Error("You already claimed this reward");
    for (const row of items) {
      const template = templates.find((item) => item.id === row.itemId);
      if (!template) continue;
      const grant = await grantStackableItemToInventory({
        db: tx,
        userId,
        itemId: row.itemId,
        rarity: template.rarity,
        quantity: row.quantity,
      });
      if (grant.remainingQuantity > 0) {
        throw new Error("Make room in your inventory for the rewards first");
      }
    }
    if (gold > 0) {
      await tx.user.update({ where: { id: userId }, data: { gold: { increment: gold } } });
    }
    if (reward.xp > 0) {
      await awardXp(
        userId,
        reward.xp,
        XpActionType.QUEST,
        undefined,
        `Community project: ${reward.project.name}`,
        { communityProjectRewardId: rewardId },
        { db: tx },
      );
    }
  });
  return { name: reward.stage.name, gold, xp: reward.xp };
}

// ============================================
// EFFECTS
// ============================================

function activeEffects(where: Prisma.CommunityProjectWhereInput) {
  return prisma.communityProjectEffect
    .findMany({
      where: { stage: { active: true, project: { enabled: true, ...where } } },
      select: { type: true, value: true },
    })
    .then((rows) =>
      sumProjectEffects(rows as Array<{ type: ProjectEffectKind; value: number }>),
    );
}

/** What reached project stages change in one settlement. */
export function getSettlementEffects(settlementId: number) {
  return activeEffects({ settlementId });
}

/** What reached project stages change across a region's settlements. */
export function getRegionEffects(locationId: number) {
  return activeEffects({ settlement: { locationId } });
}
