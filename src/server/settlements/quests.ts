import "server-only";

import type { Prisma, PrismaClient } from "~/generated/prisma/client";
import {
  XpActionType,
  type ItemRarity,
  type QuestObjectiveType,
  type QuestRepeat,
} from "~/generated/prisma/enums";
import { bestiaryHref } from "~/game/creatures";
import { prisma } from "~/lib/prisma";
import {
  consumeInventoryItems,
  countItems,
  loadInventoryStacks,
} from "~/server/items/consumeItems";
import { grantStackableItemToInventory } from "~/server/items/grantItem";
import { awardXp } from "~/utils/leveling";
import {
  assertPresentAt,
  getPresence,
  visibleNpcWhere,
  visibleQuestWhere,
} from "./access";
import {
  addQuestProgress,
  objectiveProgress,
  parseQuestProgress,
  questPeriod,
  questResetsAt,
} from "./rules";

const ITEM_REF = {
  id: true,
  name: true,
  sprite: true,
  rarity: true,
} satisfies Prisma.ItemSelect;

export const QUEST_VIEW_SELECT = {
  id: true,
  name: true,
  description: true,
  repeat: true,
  rewardGold: true,
  rewardXp: true,
  objectives: {
    orderBy: { id: "asc" },
    select: {
      type: true,
      quantity: true,
      itemId: true,
      creatureId: true,
      dungeonId: true,
      item: { select: ITEM_REF },
      creature: { select: { id: true, name: true, asset: true, kind: true } },
      dungeon: { select: { id: true, name: true } },
    },
  },
  rewardItems: {
    orderBy: { id: "asc" },
    select: { quantity: true, item: { select: ITEM_REF } },
  },
} satisfies Prisma.QuestSelect;

type QuestRow = Prisma.QuestGetPayload<{ select: typeof QUEST_VIEW_SELECT }>;
type UserQuestState = { completedAt: Date | null; progress: unknown };

export type QuestObjectiveView = {
  type: QuestObjectiveType;
  quantity: number;
  current: number;
  target: {
    name: string;
    image: string | null;
    rarity: ItemRarity | null;
    itemId: number | null;
    href: string | null;
  };
};

export type QuestView = {
  id: number;
  name: string;
  description: string | null;
  repeat: QuestRepeat;
  status: "AVAILABLE" | "ACTIVE" | "COMPLETED";
  /** Accepted and every objective is met. */
  ready: boolean;
  resetsAt: string | null;
  objectives: QuestObjectiveView[];
  rewards: {
    gold: number;
    xp: number;
    items: Array<{
      id: number;
      name: string;
      sprite: string;
      rarity: ItemRarity;
      quantity: number;
    }>;
  };
};

function objectiveTarget(
  objective: QuestRow["objectives"][number],
): QuestObjectiveView["target"] {
  if (objective.type === "DELIVER" && objective.item) {
    return {
      name: objective.item.name,
      image: objective.item.sprite,
      rarity: objective.item.rarity,
      itemId: objective.item.id,
      href: null,
    };
  }
  if (objective.type === "HUNT" && objective.creature) {
    return {
      name: objective.creature.name,
      image: objective.creature.asset,
      rarity: null,
      itemId: null,
      href: bestiaryHref(objective.creature.kind, objective.creature.id),
    };
  }
  return {
    name: objective.dungeon?.name ?? "Unknown",
    image: null,
    rarity: null,
    itemId: null,
    href: objective.dungeon ? "/dungeons" : null,
  };
}

export function toQuestView(
  quest: QuestRow,
  context: {
    userQuest: UserQuestState | null | undefined;
    held: ReadonlyMap<number, number>;
    now: Date;
  },
): QuestView {
  const { userQuest } = context;
  const progress = parseQuestProgress(userQuest?.progress);
  const objectives = quest.objectives.map((objective) => ({
    type: objective.type,
    quantity: objective.quantity,
    // Progress only counts once the quest is accepted.
    current: userQuest
      ? objectiveProgress(objective, progress, context.held)
      : 0,
    target: objectiveTarget(objective),
  }));
  const status: QuestView["status"] = userQuest
    ? userQuest.completedAt
      ? "COMPLETED"
      : "ACTIVE"
    : "AVAILABLE";

  return {
    id: quest.id,
    name: quest.name,
    description: quest.description,
    repeat: quest.repeat,
    status,
    ready:
      status === "ACTIVE" &&
      objectives.every((objective) => objective.current >= objective.quantity),
    resetsAt: questResetsAt(quest.repeat, context.now)?.toISOString() ?? null,
    objectives,
    rewards: {
      gold: Number(quest.rewardGold),
      xp: quest.rewardXp,
      items: quest.rewardItems.map((reward) => ({
        ...reward.item,
        quantity: reward.quantity,
      })),
    },
  };
}

/** The player's rows for these quests in each quest's current period. */
export async function findUserQuests(
  userId: string,
  quests: ReadonlyArray<{ id: number; repeat: QuestRepeat }>,
  now: Date,
) {
  if (quests.length === 0) return new Map<number, UserQuestState>();
  const rows = await prisma.userQuest.findMany({
    where: {
      userId,
      OR: quests.map((quest) => ({
        questId: quest.id,
        period: questPeriod(quest.repeat, now),
      })),
    },
    select: { questId: true, completedAt: true, progress: true },
  });
  return new Map(rows.map((row) => [row.questId, row]));
}

async function characterLevel(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { level: true },
  });
  return user?.level ?? 1;
}

export type QuestJournalEntry = Awaited<
  ReturnType<typeof getQuestJournal>
>[number];

/** Accepted, unfinished quests anywhere, with where to hand each one in. */
export async function getQuestJournal(userId: string) {
  const now = new Date();
  const level = await characterLevel(userId);
  const [rows, inventory] = await Promise.all([
    prisma.userQuest.findMany({
      where: {
        userId,
        completedAt: null,
        quest: { ...visibleQuestWhere(level), npc: visibleNpcWhere() },
      },
      orderBy: { acceptedAt: "asc" },
      select: {
        period: true,
        completedAt: true,
        progress: true,
        quest: {
          select: {
            ...QUEST_VIEW_SELECT,
            npc: {
              select: {
                id: true,
                name: true,
                settlement: {
                  select: {
                    id: true,
                    name: true,
                    location: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    loadInventoryStacks(prisma, userId, { lock: false }),
  ]);
  const held = countItems(inventory.stacks);

  return rows
    .filter((row) => row.period === questPeriod(row.quest.repeat, now))
    .map(({ quest, ...userQuest }) => ({
      ...toQuestView(quest, { userQuest, held, now }),
      npc: { id: quest.npc.id, name: quest.npc.name },
      settlement: {
        id: quest.npc.settlement.id,
        name: quest.npc.settlement.name,
        locationName: quest.npc.settlement.location.name,
      },
    }));
}

export type UnseenQuest = Awaited<ReturnType<typeof getUnseenQuests>>[number];

/**
 * One-time quests where the player stands that they can take but have not had
 * on screen yet. They light up the new-quest dots until the player opens the
 * NPC's page. Daily and weekly quests come back every period, so they never do.
 */
export async function getUnseenQuests(userId: string) {
  const { locationId, level } = await getPresence(userId);
  if (!locationId) return [];
  const quests = await prisma.quest.findMany({
    where: {
      ...visibleQuestWhere(level),
      repeat: "ONCE",
      npc: { ...visibleNpcWhere(), AND: [{ settlement: { locationId } }] },
      userQuests: { none: { userId } },
      seenBy: { none: { userId } },
    },
    select: { id: true, npc: { select: { id: true, settlementId: true } } },
  });
  return quests.map((quest) => ({
    questId: quest.id,
    npcId: quest.npc.id,
    settlementId: quest.npc.settlementId,
  }));
}

/** Records that the player has had these one-time quests on screen. */
export async function markQuestsSeen(userId: string, questIds: number[]) {
  // Unknown ids and repeatable quests are ignored.
  const quests = await prisma.quest.findMany({
    where: { id: { in: questIds }, repeat: "ONCE" },
    select: { id: true },
  });
  await prisma.userSeenQuest.createMany({
    data: quests.map((quest) => ({ userId, questId: quest.id })),
    skipDuplicates: true,
  });
  return { ok: true };
}

async function findAvailableQuest(userId: string, questId: number) {
  if (!Number.isInteger(questId)) return null;
  const level = await characterLevel(userId);
  return prisma.quest.findFirst({
    where: { id: questId, ...visibleQuestWhere(level), npc: visibleNpcWhere() },
    select: {
      ...QUEST_VIEW_SELECT,
      npc: {
        select: {
          settlement: {
            select: { location: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
}

export async function acceptQuest(userId: string, questId: number) {
  const quest = await findAvailableQuest(userId, questId);
  if (!quest) throw new Error("That quest is not available");
  await assertPresentAt(userId, quest.npc.settlement.location);

  const period = questPeriod(quest.repeat);
  const existing = await prisma.userQuest.findUnique({
    where: { userId_questId_period: { userId, questId, period } },
    select: { completedAt: true },
  });
  if (existing) {
    throw new Error(
      existing.completedAt
        ? quest.repeat === "ONCE"
          ? "You have already completed this quest"
          : `You have already completed this quest ${quest.repeat === "DAILY" ? "today" : "this week"}`
        : "You are already on this quest",
    );
  }
  await prisma.userQuest.create({ data: { userId, questId, period } });
  return { name: quest.name };
}

/** Hands in deliveries, then grants gold, items and character XP. */
export async function completeQuest(userId: string, questId: number) {
  const quest = await findAvailableQuest(userId, questId);
  if (!quest) throw new Error("That quest is not available");
  await assertPresentAt(userId, quest.npc.settlement.location);

  const now = new Date();
  const userQuest = await prisma.userQuest.findUnique({
    where: {
      userId_questId_period: {
        userId,
        questId,
        period: questPeriod(quest.repeat, now),
      },
    },
    select: { id: true, completedAt: true, progress: true },
  });
  if (!userQuest) throw new Error("Accept this quest first");
  if (userQuest.completedAt)
    throw new Error("You already completed this quest");

  const progress = parseQuestProgress(userQuest.progress);
  const unfinished = quest.objectives.some(
    (objective) =>
      objective.type !== "DELIVER" &&
      objectiveProgress(objective, progress, new Map()) < objective.quantity,
  );
  if (unfinished) throw new Error("This quest is not finished yet");

  const deliveries = quest.objectives.flatMap((objective) =>
    objective.type === "DELIVER" && objective.itemId
      ? [{ itemId: objective.itemId, quantity: objective.quantity }]
      : [],
  );
  const gold = Number(quest.rewardGold);

  const xp = await prisma.$transaction(async (tx) => {
    const completed = await tx.userQuest.updateMany({
      where: { id: userQuest.id, completedAt: null },
      data: { completedAt: now },
    });
    if (completed.count !== 1) {
      throw new Error("You already completed this quest");
    }
    if (deliveries.length > 0) {
      await consumeInventoryItems({ db: tx, userId, items: deliveries });
    }
    for (const reward of quest.rewardItems) {
      const grant = await grantStackableItemToInventory({
        db: tx,
        userId,
        itemId: reward.item.id,
        rarity: reward.item.rarity,
        quantity: reward.quantity,
      });
      if (grant.remainingQuantity > 0) {
        throw new Error("Make room in your inventory for the rewards first");
      }
    }
    if (gold > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { gold: { increment: gold } },
      });
    }

    // XP commits with the items and gold, so a crash cannot mark the quest
    // completed while the reward goes unpaid.
    return quest.rewardXp > 0
      ? await awardXp(
          userId,
          quest.rewardXp,
          XpActionType.QUEST,
          undefined,
          `Quest completed: ${quest.name}`,
          { questId },
          { db: tx },
        )
      : null;
  });

  return { name: quest.name, gold, xp: xp?.xpGained ?? 0 };
}

/** Drops an unfinished quest; its progress is lost. */
export async function abandonQuest(userId: string, questId: number) {
  const removed = await prisma.userQuest.deleteMany({
    where: { userId, questId, completedAt: null },
  });
  if (removed.count === 0) throw new Error("You are not on this quest");
  return { ok: true };
}

/**
 * Counts a claim's kills and dungeon clear toward the player's accepted
 * quests. Runs inside the hunting and dungeon claim transactions.
 */
export async function recordQuestProgress(params: {
  db: Pick<PrismaClient, "userQuest">;
  userId: string;
  kills: ReadonlyArray<{ creatureId: number; count: number }>;
  clearedDungeonId?: number | null;
}) {
  const { db, userId, kills } = params;
  const clearedDungeonId = params.clearedDungeonId ?? null;
  const creatureIds = kills
    .filter((kill) => kill.count > 0)
    .map((kill) => kill.creatureId);
  const targets: Prisma.QuestObjectiveWhereInput[] = [];
  if (creatureIds.length > 0) {
    targets.push({ type: "HUNT", creatureId: { in: creatureIds } });
  }
  if (clearedDungeonId) {
    targets.push({ type: "CLEAR", dungeonId: clearedDungeonId });
  }
  if (targets.length === 0) return;

  const now = new Date();
  const rows = await db.userQuest.findMany({
    where: {
      userId,
      completedAt: null,
      quest: { objectives: { some: { OR: targets } } },
    },
    select: {
      id: true,
      period: true,
      progress: true,
      quest: {
        select: {
          repeat: true,
          objectives: {
            select: {
              type: true,
              itemId: true,
              creatureId: true,
              dungeonId: true,
              quantity: true,
            },
          },
        },
      },
    },
  });

  for (const row of rows) {
    // A daily or weekly quest from an earlier period has expired.
    if (row.period !== questPeriod(row.quest.repeat, now)) continue;
    const next = addQuestProgress(
      parseQuestProgress(row.progress),
      row.quest.objectives,
      { kills, clearedDungeonId },
    );
    if (next) {
      await db.userQuest.update({
        where: { id: row.id },
        data: { progress: next },
      });
    }
  }
}
