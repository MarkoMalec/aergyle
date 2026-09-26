/**
 * "While you were away": what finished activities paid out, kept until the
 * player has seen it.
 *
 * Ticking sessions (vocations, garden harvests) add every payout to running
 * totals on their activity row. The transaction that ends one turns those
 * totals into a summary row. Runs (gathering, hunting, dungeons) pay out when
 * claimed, so a run that finished unseen is listed from its own row instead.
 *
 * Everything that ended up to `User.summariesSeenAt` counts as seen: closing
 * the dialog moves it forward, and so does a page that watched an activity end.
 *
 * Imported by the realtime daemon, which runs outside Next.js: keep this module
 * and its imports free of `server-only`.
 */
import type { PrismaClient } from "~/generated/prisma/client";
import type {
  ItemRarity,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import type { ActivityStopReason } from "~/realtime/events";
import { getLevelCurve } from "~/utils/leveling";
import { getTrackCurve } from "~/utils/progression";
import { levelForTotalXp, type XpCurve } from "~/utils/xpCurve";

/** What a ticking session has paid out so far. */
export type SessionTotals = {
  items: Array<{ itemId: number; rarity: ItemRarity; quantity: number }>;
  /** Character XP, after multipliers. */
  xp: number;
  skillXp: number;
};

export type LevelChange = { from: number; to: number };

export type SummaryItem = {
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

/** A vocation session or garden harvest that ended on its own. */
export type SessionSummary = {
  kind: "VOCATION" | "GARDEN";
  skill: VocationalActionType;
  /** The resource produced, or the harvest. */
  title: string;
  stopReason: ActivityStopReason;
  startedAt: string;
  items: SummaryItem[];
  xp: { character: number; skill: number };
  levels: { character: LevelChange; skill: LevelChange };
};

/** An expedition or dungeon run whose time is up, waiting to be claimed. */
export type RunSummary = {
  kind: "GATHERING" | "HUNTING" | "DUNGEON";
  /** Where it went: the gathering location, hunting ground or dungeon. */
  title: string;
};

export type ActivitySummaryEntry = (SessionSummary | RunSummary) & {
  key: string;
  endedAt: string;
};

/** A copy of the totals stored on an activity row; missing or malformed is empty. */
export function readTotals(value: unknown): SessionTotals {
  if (!value || typeof value !== "object")
    return { items: [], xp: 0, skillXp: 0 };
  const totals = value as Partial<SessionTotals>;
  const count = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
  return {
    items: Array.isArray(totals.items)
      ? totals.items
          .filter((item) => Number.isInteger(item?.itemId))
          .map((item) => ({
            itemId: item.itemId,
            rarity: item.rarity,
            quantity: count(item.quantity),
          }))
      : [],
    xp: count(totals.xp),
    skillXp: count(totals.skillXp),
  };
}

/** The totals with one more payout added. */
export function addToTotals(
  totals: unknown,
  payout: Partial<SessionTotals>,
): SessionTotals {
  const next = readTotals(totals);
  for (const item of payout.items ?? []) {
    if (item.quantity <= 0) continue;
    const stack = next.items.find(
      (entry) => entry.itemId === item.itemId && entry.rarity === item.rarity,
    );
    if (stack) stack.quantity += item.quantity;
    else next.items.push({ ...item });
  }
  next.xp += Math.max(0, payout.xp ?? 0);
  next.skillXp += Math.max(0, payout.skillXp ?? 0);
  return next;
}

/** The levels passed while `gained` of `totalXp` came in. */
export function levelChange(
  curve: XpCurve,
  totalXp: bigint,
  gained: number,
): LevelChange {
  const before = totalXp - BigInt(Math.floor(gained));
  return {
    from: levelForTotalXp(curve, before > 0n ? before : 0n),
    to: levelForTotalXp(curve, totalXp),
  };
}

type SummaryDb = Pick<
  PrismaClient,
  "activitySummary" | "item" | "user" | "userTrackProgress"
>;

/**
 * Turns an ended session's totals into the player's summary. Called in the
 * transaction that ends the session, after its last XP award.
 */
export async function recordSessionSummary(
  db: SummaryDb,
  params: {
    userId: string;
    kind: SessionSummary["kind"];
    skill: VocationalActionType;
    title: string;
    stopReason: ActivityStopReason;
    startedAt: Date;
    totals: SessionTotals;
  },
) {
  const { userId, skill, totals } = params;
  const [items, user, track, characterCurve, skillCurve] = await Promise.all([
    totals.items.length > 0
      ? db.item.findMany({
          where: { id: { in: totals.items.map((item) => item.itemId) } },
          select: { id: true, name: true, sprite: true },
        })
      : [],
    db.user.findUnique({
      where: { id: userId },
      select: { experience: true },
    }),
    db.userTrackProgress.findUnique({
      where: {
        userId_trackType_trackKey: {
          userId,
          trackType: "SKILL",
          trackKey: skill,
        },
      },
      select: { experience: true },
    }),
    getLevelCurve(),
    getTrackCurve("SKILL"),
  ]);
  const itemById = new Map(items.map((item) => [item.id, item]));

  const summary: SessionSummary = {
    kind: params.kind,
    skill,
    title: params.title,
    stopReason: params.stopReason,
    startedAt: params.startedAt.toISOString(),
    items: totals.items.flatMap((item) => {
      const template = itemById.get(item.itemId);
      return template && item.quantity > 0
        ? [{ ...item, name: template.name, sprite: template.sprite }]
        : [];
    }),
    xp: { character: totals.xp, skill: totals.skillXp },
    levels: {
      character: levelChange(characterCurve, user?.experience ?? 0n, totals.xp),
      skill: levelChange(skillCurve, track?.experience ?? 0n, totals.skillXp),
    },
  };

  await db.activitySummary.create({
    data: { userId, endedAt: new Date(), data: summary },
  });
}

/**
 * Everything that ended since the player last looked. `asOf` bounds the list,
 * and closing the dialog marks everything up to it as seen.
 */
export async function getUnseenSummaries(userId: string) {
  const asOf = new Date();
  const [user, rows, gathering, hunting, dungeon] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { summariesSeenAt: true },
    }),
    prisma.activitySummary.findMany({
      where: { userId, endedAt: { lte: asOf } },
      select: { id: true, endedAt: true, data: true },
      orderBy: { endedAt: "asc" },
    }),
    prisma.userGatheringExpedition.findUnique({
      where: { userId },
      select: {
        id: true,
        endsAt: true,
        claimedAt: true,
        location: { select: { name: true } },
      },
    }),
    prisma.userHuntingExpedition.findUnique({
      where: { userId },
      select: {
        id: true,
        endsAt: true,
        claimedAt: true,
        ground: { select: { name: true } },
      },
    }),
    prisma.userDungeonRun.findUnique({
      where: { userId },
      select: {
        id: true,
        endsAt: true,
        claimedAt: true,
        dungeon: { select: { name: true } },
      },
    }),
  ]);

  const seenAt = user?.summariesSeenAt ?? null;
  const unseen = (endedAt: Date) =>
    endedAt <= asOf && (seenAt === null || endedAt > seenAt);

  const summaries: ActivitySummaryEntry[] = rows
    .filter((row) => unseen(row.endedAt))
    .map((row) => ({
      ...(row.data as SessionSummary | RunSummary),
      key: `summary-${row.id}`,
      endedAt: row.endedAt.toISOString(),
    }));

  const runs = [
    gathering && {
      kind: "GATHERING" as const,
      run: gathering,
      title: gathering.location.name,
    },
    hunting && {
      kind: "HUNTING" as const,
      run: hunting,
      title: hunting.ground.name,
    },
    dungeon && {
      kind: "DUNGEON" as const,
      run: dungeon,
      title: dungeon.dungeon.name,
    },
  ];
  for (const entry of runs) {
    if (!entry || entry.run.claimedAt !== null || !unseen(entry.run.endsAt)) {
      continue;
    }
    summaries.push({
      kind: entry.kind,
      title: entry.title,
      key: `${entry.kind.toLowerCase()}-${entry.run.id}`,
      endedAt: entry.run.endsAt.toISOString(),
    });
  }

  summaries.sort((a, b) => a.endedAt.localeCompare(b.endedAt));
  return { summaries, asOf: asOf.toISOString() };
}

/**
 * The player has seen everything that ended up to `upTo` (default: now).
 * Never moves backwards, and drops the summary rows it covers.
 */
export async function markSummariesSeen(userId: string, upTo?: Date) {
  const now = new Date();
  const until = upTo && upTo < now ? upTo : now;
  await Promise.all([
    prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ summariesSeenAt: null }, { summariesSeenAt: { lt: until } }],
      },
      data: { summariesSeenAt: until },
    }),
    prisma.activitySummary.deleteMany({
      where: { userId, endedAt: { lte: until } },
    }),
  ]);
}

/** Stores summaries as they are, for the admin's demo. */
export async function saveSummaries(
  userId: string,
  summaries: Array<SessionSummary | RunSummary>,
) {
  const endedAt = new Date();
  await prisma.activitySummary.createMany({
    data: summaries.map((data) => ({ userId, endedAt, data })),
  });
}
