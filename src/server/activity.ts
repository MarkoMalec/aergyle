import { prisma } from "~/lib/prisma";

/** Every timed activity a character can run. Only one runs at a time. */
export type ActivityKind =
  | "travel"
  | "vocation"
  | "garden"
  | "gathering"
  | "hunting"
  | "dungeon";

/**
 * The character's activity rows, one query per kind in parallel. Expeditions
 * and dungeon runs count until claimed. Travel and vocation rows carry their
 * times for callers that only treat them as running before they end.
 * The `except` kind is not queried and always comes back null.
 */
export async function getActivityRows(userId: string, except?: ActivityKind) {
  const unless = <T>(kind: ActivityKind, query: () => Promise<T>) =>
    kind === except ? Promise.resolve(null) : query();

  const [travel, vocation, garden, gathering, hunting, dungeon] =
    await Promise.all([
      unless("travel", () =>
        prisma.userTravelActivity.findUnique({
          where: { userId },
          select: { id: true, endsAt: true, cancelledAt: true },
        }),
      ),
      unless("vocation", () =>
        prisma.userVocationalActivity.findUnique({
          where: { userId },
          select: { id: true, endsAt: true },
        }),
      ),
      unless("garden", () =>
        prisma.userGardenHarvestActivity.findUnique({
          where: { userId },
          select: { id: true },
        }),
      ),
      unless("gathering", () =>
        prisma.userGatheringExpedition.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
      ),
      unless("hunting", () =>
        prisma.userHuntingExpedition.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
      ),
      unless("dungeon", () =>
        prisma.userDungeonRun.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
      ),
    ]);

  return { travel, vocation, garden, gathering, hunting, dungeon };
}

/**
 * Throws when any activity other than `own` is in progress. The caller checks
 * its own kind itself, since starting over it is decided per activity.
 */
export async function assertNoOtherActivity(userId: string, own: ActivityKind) {
  const rows = await getActivityRows(userId, own);
  if (Object.values(rows).some(Boolean)) {
    throw new Error("You already have an active activity");
  }
}
