import type { PrismaClient } from "~/generated/prisma/client";
import type { VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";

type DbClient = Pick<PrismaClient, "userSkillMetric">;

export type SkillMetrics = {
  itemsGathered: number;
  totalExperience: number;
  secondsSpent: number;
};

/**
 * Adds a finished piece of work to a skill's lifetime counters. Called
 * wherever a skill pays out, beside the XP award.
 */
export async function recordSkillWork(params: {
  db?: DbClient;
  userId: string;
  actionType: VocationalActionType;
  /** Items added to the inventory by this payout. */
  items: number;
  /** Seconds of activity this payout covers. */
  seconds: number;
}) {
  const items = Math.max(0, Math.round(params.items));
  const seconds = Math.max(0, Math.round(params.seconds));
  if (items === 0 && seconds === 0) return;

  const db = params.db ?? prisma;
  await db.userSkillMetric.upsert({
    where: {
      userId_actionType: {
        userId: params.userId,
        actionType: params.actionType,
      },
    },
    create: {
      userId: params.userId,
      actionType: params.actionType,
      itemsGathered: BigInt(items),
      secondsSpent: BigInt(seconds),
    },
    update: {
      itemsGathered: { increment: BigInt(items) },
      secondsSpent: { increment: BigInt(seconds) },
    },
  });
}

/** The three numbers the skill page's metrics panel shows. */
export async function getSkillMetrics(
  userId: string,
  actionType: VocationalActionType,
): Promise<SkillMetrics> {
  const [metric, progress] = await Promise.all([
    prisma.userSkillMetric.findUnique({
      where: { userId_actionType: { userId, actionType } },
      select: { itemsGathered: true, secondsSpent: true },
    }),
    prisma.userTrackProgress.findUnique({
      where: {
        userId_trackType_trackKey: {
          userId,
          trackType: "SKILL",
          trackKey: String(actionType),
        },
      },
      select: { experience: true },
    }),
  ]);

  return {
    itemsGathered: Number(metric?.itemsGathered ?? 0n),
    totalExperience: Number(progress?.experience ?? 0n),
    secondsSpent: Number(metric?.secondsSpent ?? 0n),
  };
}
