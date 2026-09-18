import { prisma } from "~/lib/prisma";
import {
  applyMovementSpeed,
  FALLBACK_TRAVEL_SECONDS,
  toTravelRoutePair,
} from "~/game/world/travel";
import { getCompleteCharacterStats } from "~/server/stats";
import {
  getLocationRequiredLevel,
  meetsLocationLevelRequirement,
} from "~/server/travel/requirements";

/** Admin default for pairs without a route; one config row with id 1. */
export async function getDefaultTravelSeconds(): Promise<number> {
  const row = await prisma.travelConfig.findUnique({
    where: { id: 1 },
    select: { secondsPerTravel: true },
  });
  const seconds = row?.secondsPerTravel;
  return typeof seconds === "number" && seconds > 0
    ? seconds
    : FALLBACK_TRAVEL_SECONDS;
}

/**
 * Journey seconds from one location to each destination for this character:
 * the route's base time (or the default) scaled by current movement speed.
 * Used for the atlas preview and when a journey starts, so both agree.
 */
export async function getJourneySeconds(
  userId: string,
  fromLocationId: number | null,
  toLocationIds: number[],
): Promise<Map<number, number>> {
  const destinations = toLocationIds.filter((id) => id !== fromLocationId);
  const [stats, defaultSeconds, routes] = await Promise.all([
    getCompleteCharacterStats(userId),
    getDefaultTravelSeconds(),
    fromLocationId === null || destinations.length === 0
      ? []
      : prisma.travelRoute.findMany({
          where: {
            OR: destinations.map((toLocationId) =>
              toTravelRoutePair(fromLocationId, toLocationId),
            ),
          },
          select: { locationAId: true, locationBId: true, seconds: true },
        }),
  ]);

  const baseSecondsByDestination = new Map(
    routes.map((route) => [
      route.locationAId === fromLocationId
        ? route.locationBId
        : route.locationAId,
      route.seconds,
    ]),
  );
  return new Map(
    destinations.map((toLocationId) => [
      toLocationId,
      applyMovementSpeed(
        baseSecondsByDestination.get(toLocationId) ?? defaultSeconds,
        stats.movementSpeed,
      ),
    ]),
  );
}

export type TravelStatus =
  | {
      travel: {
        id: number;
        startedAt: string;
        endsAt: string;
        fromLocation: { id: number; name: string } | null;
        toLocation: { id: number; name: string };
      };
      progress: {
        progress: number;
        remainingSeconds: number;
        isComplete: boolean;
      };
    }
  | { travel: null; progress: null };

export async function getTravelStatus(userId: string): Promise<TravelStatus> {
  const now = new Date();

  const travel = await prisma.userTravelActivity.findUnique({
    where: { userId },
    include: {
      fromLocation: { select: { id: true, name: true } },
      toLocation: { select: { id: true, name: true } },
    },
  });

  if (!travel) return { travel: null, progress: null };

  // Cancelled travel is treated as not active.
  if (travel.cancelledAt) {
    await prisma.userTravelActivity.deleteMany({ where: { userId } });
    return { travel: null, progress: null };
  }

  // Complete travel automatically on status checks.
  if (travel.endsAt <= now) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { currentLocationId: travel.toLocationId },
      });
      await tx.userTravelActivity.deleteMany({ where: { userId } });
    });
    return { travel: null, progress: null };
  }

  const startedAtMs = travel.startedAt.getTime();
  const endsAtMs = travel.endsAt.getTime();
  const nowMs = now.getTime();

  const durationMs = Math.max(0, endsAtMs - startedAtMs);
  const elapsedMs = Math.min(Math.max(0, nowMs - startedAtMs), durationMs);
  const remainingSeconds = Math.max(
    0,
    Math.ceil((durationMs - elapsedMs) / 1000),
  );

  const progress =
    durationMs === 0 ? 1 : Math.max(0, Math.min(1, elapsedMs / durationMs));

  return {
    travel: {
      id: travel.id,
      startedAt: travel.startedAt.toISOString(),
      endsAt: travel.endsAt.toISOString(),
      fromLocation: travel.fromLocation,
      toLocation: travel.toLocation,
    },
    progress: {
      progress,
      remainingSeconds,
      isComplete: false,
    },
  };
}

export async function startTravel(params: {
  userId: string;
  toLocationId: number;
}) {
  const { userId, toLocationId } = params;

  const [
    activeGardenHarvest,
    activeVocation,
    activeGatheringExpedition,
    activeHuntingExpedition,
    activeDungeonRun,
  ] = await Promise.all([
    prisma.userGardenHarvestActivity.findUnique({
      where: { userId },
      select: { id: true },
    }),
    prisma.userVocationalActivity.findUnique({
      where: { userId },
      select: { id: true },
    }),
    prisma.userGatheringExpedition.findFirst({
      where: { userId, claimedAt: null },
      select: { id: true },
    }),
    prisma.userHuntingExpedition.findFirst({
      where: { userId, claimedAt: null },
      select: { id: true },
    }),
    prisma.userDungeonRun.findFirst({
      where: { userId, claimedAt: null },
      select: { id: true },
    }),
  ]);
  if (
    activeGardenHarvest ??
    activeVocation ??
    activeGatheringExpedition ??
    activeHuntingExpedition ??
    activeDungeonRun
  ) {
    throw new Error("You already have an active activity");
  }

  const [user, destination] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { currentLocationId: true, level: true },
    }),
    prisma.location.findUnique({
      where: { id: toLocationId },
      select: { id: true, name: true, requiredLevel: true },
    }),
  ]);

  if (!destination) throw new Error("Location not found");
  if (!user) throw new Error("User not found");
  if (!meetsLocationLevelRequirement(destination, user.level)) {
    throw new Error(
      `Requires level ${getLocationRequiredLevel(destination)} to travel to ${destination.name}`,
    );
  }

  const fromLocationId = user.currentLocationId ?? null;
  if (fromLocationId !== null && fromLocationId === toLocationId) {
    throw new Error("You are already at this location");
  }

  // Movement speed (gear and food effect) is read once, so the arrival time is
  // fixed when the journey starts.
  const journeySeconds = await getJourneySeconds(userId, fromLocationId, [
    toLocationId,
  ]);
  const travelSeconds = journeySeconds.get(toLocationId);
  if (travelSeconds === undefined) throw new Error("No route to location");
  const now = new Date();
  const endsAt = new Date(now.getTime() + travelSeconds * 1000);

  // Only one travel at a time.
  const existing = await prisma.userTravelActivity.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) throw new Error("You are already traveling");

  await prisma.userTravelActivity.create({
    data: {
      userId,
      fromLocationId,
      toLocationId,
      startedAt: now,
      endsAt,
      cancelledAt: null,
    },
  });
}

export async function cancelTravel(userId: string) {
  await prisma.userTravelActivity.deleteMany({ where: { userId } });
}
