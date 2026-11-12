import "server-only";

import type { Prisma } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import { settleProjectRounds } from "~/server/settlements";
import { contributionShare, projectPhase } from "~/server/settlements/rules";

/**
 * "Hidden until" choices for NPCs, shop items, quests, dungeons and hunting
 * grounds: one per project stage, named by the project alone when it has one.
 */
export async function getStageOptions() {
  const stages = await prisma.communityProjectStage.findMany({
    orderBy: [{ project: { settlement: { name: "asc" } } }, { project: { name: "asc" } }, { position: "asc" }],
    select: {
      id: true,
      name: true,
      position: true,
      active: true,
      project: {
        select: {
          name: true,
          settlement: { select: { name: true } },
          _count: { select: { stages: true } },
        },
      },
    },
  });
  return stages.map((stage) => ({
    id: stage.id,
    name:
      stage.project._count.stages > 1
        ? `${stage.project.name} › ${stage.position}. ${stage.name}`
        : stage.project.name,
    detail: `${stage.project.settlement.name}${stage.active ? " · reached" : ""}`,
  }));
}

const LIST_SELECT = {
  id: true,
  name: true,
  image: true,
  enabled: true,
  repeat: true,
  repeatHours: true,
  maxRounds: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  round: true,
  completedAt: true,
  settlement: {
    select: { id: true, name: true, location: { select: { id: true, name: true } } },
  },
  stages: {
    orderBy: { position: "asc" },
    select: {
      completedAt: true,
      requirements: { select: { quantity: true, contributed: true } },
    },
  },
} satisfies Prisma.CommunityProjectSelect;

/** Compact project rows with where each one stands, for lists. */
export async function listProjects(where: Prisma.CommunityProjectWhereInput) {
  await settleProjectRounds(where);
  const now = new Date();
  const projects = await prisma.communityProject.findMany({
    where,
    orderBy: [{ settlement: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: LIST_SELECT,
  });
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    image: project.image,
    enabled: project.enabled,
    repeat: project.repeat,
    repeatHours: project.repeatHours,
    round: project.round,
    settlement: project.settlement,
    phase: projectPhase(project, now).phase,
    stages: project.stages.length,
    stagesReached: project.stages.filter((stage) => stage.completedAt).length,
    progress: contributionShare(project.stages.flatMap((stage) => stage.requirements)),
  }));
}

export type ProjectListRow = Awaited<ReturnType<typeof listProjects>>[number];

/** Everything the project editor shows, plus its pickers' options. */
export async function loadProjectEditor(id: number) {
  await settleProjectRounds({ id });
  const [project, items, skills, npcs] = await Promise.all([
    prisma.communityProject.findUnique({
      where: { id },
      include: {
        settlement: {
          select: { id: true, name: true, location: { select: { id: true, name: true } } },
        },
        _count: { select: { rewards: { where: { claimedAt: null } } } },
        stages: {
          orderBy: { position: "asc" },
          include: {
            requirements: {
              orderBy: { id: "asc" },
              select: {
                itemId: true,
                quantity: true,
                contributed: true,
                _count: { select: { contributions: true } },
              },
            },
            rewardItems: { orderBy: { id: "asc" }, select: { itemId: true, quantity: true } },
            effects: { select: { type: true, value: true } },
            unlocksNpcs: { orderBy: { name: "asc" }, select: { id: true, name: true } },
            unlocksOffers: {
              select: { item: { select: { name: true } }, npc: { select: { name: true } } },
            },
            unlocksQuests: { select: { name: true, npc: { select: { name: true } } } },
            unlocksDungeons: { select: { name: true } },
            unlocksGrounds: { select: { name: true } },
          },
        },
      },
    }),
    prisma.item.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sprite: true, rarity: true },
    }),
    prisma.skills.findMany({
      orderBy: { skill_name: "asc" },
      select: { skill_id: true, skill_name: true },
    }),
    prisma.npc.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        portrait: true,
        requiredStageId: true,
        settlement: { select: { name: true } },
      },
    }),
  ]);
  if (!project) return null;

  return {
    meta: {
      settlement: project.settlement,
      phase: projectPhase(project, new Date()),
      round: project.round,
      unclaimedRewards: project._count.rewards,
      updatedAt: project.updatedAt.toISOString(),
    },
    project: {
      id: project.id,
      settlementId: project.settlementId,
      name: project.name,
      description: project.description,
      image: project.image,
      enabled: project.enabled,
      sortOrder: project.sortOrder,
      repeat: project.repeat,
      repeatHours: project.repeatHours,
      maxRounds: project.maxRounds,
      startsAt: project.startsAt?.toISOString() ?? null,
      endsAt: project.endsAt?.toISOString() ?? null,
      unlockMode: project.unlockMode,
      showFutureStages: project.showFutureStages,
      minLevel: project.minLevel,
      requiredSkillId: project.requiredSkillId,
      requiredSkillLevel: project.requiredSkillLevel,
      maxSharePercent: project.maxSharePercent,
      rewardSplit: project.rewardSplit,
      rewardMinSharePercent: project.rewardMinSharePercent,
      stages: project.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        description: stage.description,
        image: stage.image,
        rewardGold: Number(stage.rewardGold),
        rewardXp: stage.rewardXp,
        requirements: stage.requirements.map(({ itemId, quantity }) => ({ itemId, quantity })),
        rewardItems: stage.rewardItems,
        effects: stage.effects,
      })),
    },
    // Read-only facts per stage, in the same order as project.stages.
    stageFacts: project.stages.map((stage) => ({
      reached: stage.completedAt !== null,
      active: stage.active,
      contributed: Object.fromEntries(
        stage.requirements.map((row) => [row.itemId, row.contributed]),
      ) as Record<number, number>,
      unlocks: [
        // NPCs carry their id so the editor can un-hide them in place.
        ...stage.unlocksNpcs.map((npc) => ({ label: `NPC ${npc.name}`, npcId: npc.id })),
        ...stage.unlocksOffers.map((offer) => ({ label: `${offer.item.name} at ${offer.npc.name}` })),
        ...stage.unlocksQuests.map((quest) => ({ label: `Quest “${quest.name}” (${quest.npc.name})` })),
        ...stage.unlocksDungeons.map((dungeon) => ({ label: `Dungeon ${dungeon.name}` })),
        ...stage.unlocksGrounds.map((ground) => ({ label: `Hunting ground ${ground.name}` })),
      ] as Array<{ label: string; npcId?: number }>,
    })),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      image: item.sprite,
      detail: item.rarity.toLowerCase(),
    })),
    skills: skills.map((skill) => ({ id: skill.skill_id, name: skill.skill_name })),
    npcs: npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      image: npc.portrait,
      requiredStageId: npc.requiredStageId,
      settlement: npc.settlement?.name ?? "No location",
    })),
  };
}

export type ProjectEditorData = NonNullable<Awaited<ReturnType<typeof loadProjectEditor>>>;
