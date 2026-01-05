import { prisma } from "~/lib/prisma";

const FALLBACK_TRAVEL_SECONDS = 4 * 60 * 60;

async function getTravelSeconds(): Promise<number> {
  try {
    const row = await prisma.travelConfig.findFirst({
      select: { secondsPerTravel: true },
      orderBy: [{ id: "desc" }],
    });

    const seconds = row?.secondsPerTravel;
    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      return Math.floor(seconds);
    }
  } catch {
    // ignore
  }

  return FALLBACK_TRAVEL_SECONDS;
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
  const remainingSeconds = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));

  const progress = durationMs === 0 ? 1 : Math.max(0, Math.min(1, elapsedMs / durationMs));

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

export async function startTravel(params: { userId: string; toLocationId: number }) {
  const { userId, toLocationId } = params;

  const [user, destination, secondsPerTravel] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { currentLocationId: true },
    }),
    prisma.location.findUnique({ where: { id: toLocationId }, select: { id: true } }),
    getTravelSeconds(),
  ]);

  if (!destination) throw new Error("Location not found");

  const fromLocationId = user?.currentLocationId ?? null;
  if (fromLocationId !== null && fromLocationId === toLocationId) {
    throw new Error("You are already at this location");
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + secondsPerTravel * 1000);

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
