import "server-only";

import { prisma } from "~/lib/prisma";
import { getTravelStatus } from "~/server/travel/service";

/** Content without a project requirement, or whose project is completed. */
export function unlockedWhere() {
  return {
    OR: [
      { requiredProjectId: null },
      { requiredProject: { is: { completedAt: { not: null } } } },
    ],
  };
}

/** NPCs players can see: enabled, unlocked, in an enabled settlement. */
export function visibleNpcWhere() {
  return { enabled: true, settlement: { enabled: true }, ...unlockedWhere() };
}

/** Shop offers on sale now; a rare find only inside its window. */
export function liveOfferWhere(now: Date) {
  return {
    enabled: true,
    AND: [
      unlockedWhere(),
      { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
      { OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] },
    ],
  };
}

/**
 * Quests players can see: enabled, unlocked, and within their character
 * level. A quest above it stays hidden until the character reaches it.
 */
export function visibleQuestWhere(level: number) {
  return { enabled: true, requiredLevel: { lte: level }, ...unlockedWhere() };
}

/**
 * Where the player can use settlements, and the character level that decides
 * which quests they see. Checking travel also settles a finished journey, so
 * an arrival counts immediately.
 */
export async function getPresence(userId: string) {
  const travel = await getTravelStatus(userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentLocationId: true, level: true },
  });
  return {
    traveling: Boolean(travel.travel),
    locationId: travel.travel ? null : user?.currentLocationId ?? null,
    level: user?.level ?? 1,
  };
}

export async function assertPresentAt(
  userId: string,
  location: { id: number; name: string },
) {
  const presence = await getPresence(userId);
  if (presence.locationId !== location.id) {
    throw new Error(
      presence.traveling
        ? "You can't do that while travelling"
        : `Travel to ${location.name} first`,
    );
  }
}
