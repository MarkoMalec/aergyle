import "server-only";

import { prisma } from "~/lib/prisma";
import { toSkillNameFromActionType } from "~/utils/vocations";

/** What another player sees a character doing right now. */
export type PublicActivity = {
  kind: "travel" | "garden" | "gathering" | "hunting" | "dungeon" | "vocation";
  skillLabel: string;
  label: string;
  sprite: string | null;
  startedAt: string;
  endsAt: string;
};

/**
 * Reads the running activity straight from the activity rows. Unlike the
 * owner's status endpoints it never settles ticks, so looking at a profile
 * cannot pay out someone else's rewards. A finished but unclaimed run counts
 * as idle: the character is no longer out there.
 */
export async function getPublicActivity(
  userId: string,
  now = new Date(),
): Promise<PublicActivity | null> {
  const running = { endsAt: { gt: now } };
  const [travel, garden, gathering, hunting, dungeon, vocation] =
    await Promise.all([
      prisma.userTravelActivity.findFirst({
        where: { userId, cancelledAt: null, ...running },
        select: {
          startedAt: true,
          endsAt: true,
          toLocation: { select: { name: true } },
        },
      }),
      prisma.userGardenHarvestActivity.findFirst({
        where: { userId, ...running },
        select: { startedAt: true, endsAt: true },
      }),
      prisma.userGatheringExpedition.findFirst({
        where: { userId, claimedAt: null, ...running },
        select: {
          startedAt: true,
          endsAt: true,
          location: { select: { name: true } },
        },
      }),
      prisma.userHuntingExpedition.findFirst({
        where: { userId, claimedAt: null, ...running },
        select: {
          startedAt: true,
          endsAt: true,
          ground: { select: { name: true } },
        },
      }),
      prisma.userDungeonRun.findFirst({
        where: { userId, claimedAt: null, ...running },
        select: {
          startedAt: true,
          endsAt: true,
          dungeon: { select: { name: true } },
        },
      }),
      prisma.userVocationalActivity.findFirst({
        where: { userId, ...running },
        select: {
          actionType: true,
          startedAt: true,
          endsAt: true,
          resource: {
            select: { name: true, item: { select: { sprite: true } } },
          },
        },
      }),
    ]);

  const span = (row: { startedAt: Date; endsAt: Date }) => ({
    startedAt: row.startedAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  });

  // Only one runs at a time; the order matches the owner's own status chip.
  if (travel) {
    return {
      kind: "travel",
      skillLabel: "Travel",
      label: `Traveling to ${travel.toLocation.name}`,
      sprite: null,
      ...span(travel),
    };
  }
  if (garden) {
    return {
      kind: "garden",
      skillLabel: "Gardening",
      label: "Harvesting the garden",
      sprite: null,
      ...span(garden),
    };
  }
  if (gathering) {
    return {
      kind: "gathering",
      skillLabel: "Gathering",
      label: `Exploring ${gathering.location.name}`,
      sprite: null,
      ...span(gathering),
    };
  }
  if (hunting) {
    return {
      kind: "hunting",
      skillLabel: "Hunting",
      label: `Hunting in ${hunting.ground.name}`,
      sprite: null,
      ...span(hunting),
    };
  }
  if (dungeon) {
    return {
      kind: "dungeon",
      skillLabel: "Dungeon",
      label: `Fighting in ${dungeon.dungeon.name}`,
      sprite: null,
      ...span(dungeon),
    };
  }
  if (vocation) {
    return {
      kind: "vocation",
      skillLabel: toSkillNameFromActionType(vocation.actionType),
      label: vocation.resource.name,
      sprite: vocation.resource.item.sprite,
      ...span(vocation),
    };
  }
  return null;
}
