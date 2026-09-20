import "server-only";

import type { PrismaClient } from "~/generated/prisma/client";
import type { ItemRarity } from "~/generated/prisma/enums";
import { settlementHref } from "~/game/settlements";
import { prisma } from "~/lib/prisma";
import { notifyMany } from "~/server/communication";
import { consumeInventoryItems } from "~/server/items/consumeItems";
import { assertPresentAt } from "./access";
import { contributionShare } from "./rules";

const LEADERBOARD_SIZE = 10;

export type ProjectView = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  completedAt: string | null;
  requirements: Array<{
    item: { id: number; name: string; sprite: string; rarity: ItemRarity };
    quantity: number;
    contributed: number;
    mine: number;
    held: number;
  }>;
  contributors: number;
  /** The player's share (0–1) and leaderboard rank, if they contributed. */
  share: number;
  rank: number | null;
  leaderboard: Array<{ name: string; share: number; you: boolean }>;
};

/**
 * Marks a project completed once every requirement is met, or reopens it if
 * an admin raised a requirement. A project without requirements never
 * completes. Returns true when this call completed it.
 */
export async function syncProjectCompletion(
  db: Pick<PrismaClient, "communityProject" | "communityProjectRequirement">,
  projectId: number,
) {
  const requirements = await db.communityProjectRequirement.findMany({
    where: { projectId },
    select: { quantity: true, contributed: true },
  });
  const met =
    requirements.length > 0 &&
    requirements.every((row) => row.contributed >= row.quantity);
  const changed = await db.communityProject.updateMany({
    where: { id: projectId, completedAt: met ? null : { not: null } },
    data: { completedAt: met ? new Date() : null },
  });
  return met && changed.count === 1;
}

/** Enabled projects in a settlement, with progress and the leaderboard. */
export async function getSettlementProjects(
  userId: string,
  settlementId: number,
  held: ReadonlyMap<number, number>,
): Promise<ProjectView[]> {
  const projects = await prisma.communityProject.findMany({
    where: { settlementId, enabled: true },
    orderBy: [{ completedAt: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      image: true,
      completedAt: true,
      requirements: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          quantity: true,
          contributed: true,
          item: {
            select: { id: true, name: true, sprite: true, rarity: true },
          },
          contributions: {
            select: {
              userId: true,
              quantity: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return projects.map((project) => {
    const contributors = new Map<string, string>();
    for (const requirement of project.requirements) {
      for (const row of requirement.contributions) {
        contributors.set(row.userId, row.user.name ?? "Adventurer");
      }
    }
    const shareOf = (contributorId: string) =>
      contributionShare(
        project.requirements.map((requirement) => ({
          quantity: requirement.quantity,
          contributed:
            requirement.contributions.find(
              (row) => row.userId === contributorId,
            )?.quantity ?? 0,
        })),
      );
    const ranked = [...contributors]
      .map(([id, name]) => ({ id, name, share: shareOf(id) }))
      .sort((a, b) => b.share - a.share);
    const rankIndex = ranked.findIndex((row) => row.id === userId);

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      image: project.image,
      completedAt: project.completedAt?.toISOString() ?? null,
      requirements: project.requirements.map((requirement) => ({
        item: requirement.item,
        quantity: requirement.quantity,
        contributed: Math.min(requirement.quantity, requirement.contributed),
        mine:
          requirement.contributions.find((row) => row.userId === userId)
            ?.quantity ?? 0,
        held: held.get(requirement.item.id) ?? 0,
      })),
      contributors: ranked.length,
      share: rankIndex >= 0 ? ranked[rankIndex]!.share : 0,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      leaderboard: ranked.slice(0, LEADERBOARD_SIZE).map((row) => ({
        name: row.name,
        share: row.share,
        you: row.id === userId,
      })),
    };
  });
}

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

  const project = await prisma.communityProject.findFirst({
    where: { id: projectId, enabled: true, settlement: { enabled: true } },
    select: {
      name: true,
      completedAt: true,
      settlement: {
        select: {
          id: true,
          name: true,
          location: { select: { id: true, name: true } },
        },
      },
      requirements: {
        where: { itemId },
        select: { id: true, quantity: true, contributed: true },
      },
    },
  });
  if (!project) throw new Error("That project is not available");
  if (project.completedAt) throw new Error("This project is already complete");
  await assertPresentAt(userId, project.settlement.location);

  const requirement = project.requirements[0];
  if (!requirement) throw new Error("This project doesn't need that item");
  const remaining = requirement.quantity - requirement.contributed;
  if (remaining <= 0) throw new Error("Enough of that item has been gathered");
  if (quantity > remaining) {
    throw new Error(
      `Only ${remaining} more ${remaining === 1 ? "is" : "are"} needed`,
    );
  }

  const completed = await prisma.$transaction(async (tx) => {
    // Compare-and-set, so two players can never overfill a requirement.
    const reserved = await tx.communityProjectRequirement.updateMany({
      where: { id: requirement.id, contributed: requirement.contributed },
      data: { contributed: { increment: quantity } },
    });
    if (reserved.count !== 1) {
      throw new Error(
        "Someone contributed at the same moment. Please try again.",
      );
    }
    await consumeInventoryItems({
      db: tx,
      userId,
      items: [{ itemId, quantity }],
    });
    await tx.communityProjectContribution.upsert({
      where: {
        requirementId_userId: { requirementId: requirement.id, userId },
      },
      create: { requirementId: requirement.id, userId, quantity },
      update: { quantity: { increment: quantity } },
    });
    return syncProjectCompletion(tx, projectId);
  });

  if (completed) {
    await announceProjectCompletion(projectId, project.name, project.settlement);
  }

  return { name: project.name, completed };
}

/**
 * Tells everyone who put something in that the goal is finished, and what it
 * opened up. The notification is the only word they get if they are not in
 * the settlement when the last item lands.
 */
async function announceProjectCompletion(
  projectId: number,
  name: string,
  settlement: { id: number; name: string },
) {
  const contributions = await prisma.communityProjectContribution.findMany({
    where: { requirement: { projectId } },
    distinct: ["userId"],
    select: { userId: true },
  });
  await notifyMany(
    contributions.map((row) => row.userId),
    {
      category: "SETTLEMENT",
      title: `${name} is complete`,
      body: `${settlement.name} finished the project you contributed to. Whatever it unlocked is open now.`,
      href: settlementHref(settlement.id),
    },
  );
}
