import type { PrismaClient } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";

type DbClient = Pick<PrismaClient, "$executeRaw">;

export type DailyActivityPoint = {
  /** UTC day, "2026-10-19". */
  day: string;
  xp: number;
  seconds: number;
};

const DAY_MS = 86_400_000;

function utcDay(at: Date) {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
}

/**
 * Adds to today's totals behind the profile's activity charts. Called beside
 * the XP award and the skill metrics, inside the caller's transaction, so it
 * is one write that never adds rows beyond one per player per day.
 */
export async function recordDailyActivity(params: {
  db?: DbClient;
  userId: string;
  xp?: number;
  seconds?: number;
}) {
  const xp = Math.max(0, Math.floor(params.xp ?? 0));
  const seconds = Math.max(0, Math.round(params.seconds ?? 0));
  if (xp === 0 && seconds === 0) return;

  const db = params.db ?? prisma;
  await db.$executeRaw`
    INSERT INTO PlayerDailyActivity (userId, day, xp, seconds)
    VALUES (${params.userId}, ${utcDay(new Date())}, ${BigInt(xp)}, ${seconds})
    ON DUPLICATE KEY UPDATE xp = xp + VALUES(xp), seconds = seconds + VALUES(seconds)`;
}

/** The last `days` days, oldest first, with quiet days filled in as zero. */
export async function getDailyActivity(
  userId: string,
  days: number,
  now = new Date(),
): Promise<DailyActivityPoint[]> {
  const today = utcDay(now);
  const since = new Date(today.getTime() - (days - 1) * DAY_MS);
  const rows = await prisma.playerDailyActivity.findMany({
    where: { userId, day: { gte: since } },
    select: { day: true, xp: true, seconds: true },
  });
  const byDay = new Map(
    rows.map((row) => [row.day.toISOString().slice(0, 10), row]),
  );

  return Array.from({ length: days }, (_, index) => {
    const day = new Date(since.getTime() + index * DAY_MS)
      .toISOString()
      .slice(0, 10);
    const row = byDay.get(day);
    return {
      day,
      xp: row ? Number(row.xp) : 0,
      seconds: row?.seconds ?? 0,
    };
  });
}
