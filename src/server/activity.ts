import { prisma } from "~/lib/prisma";
import type { Prisma } from "~/generated/prisma/client";

/** The global client or an open transaction. */
type Db = typeof prisma | Prisma.TransactionClient;

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
 * Pass the transaction as `db` when the answer decides a write in it.
 */
export async function getActivityRows(
  userId: string,
  except?: ActivityKind,
  db: Db = prisma,
) {
  const unless = <T>(kind: ActivityKind, query: () => Promise<T>) =>
    kind === except ? Promise.resolve(null) : query();

  const [travel, vocation, garden, gathering, hunting, dungeon] =
    await Promise.all([
      unless("travel", () =>
        db.userTravelActivity.findUnique({
          where: { userId },
          select: { id: true, endsAt: true, cancelledAt: true },
        }),
      ),
      unless("vocation", () =>
        db.userVocationalActivity.findUnique({
          where: { userId },
          select: { id: true, endsAt: true },
        }),
      ),
      unless("garden", () =>
        db.userGardenHarvestActivity.findUnique({
          where: { userId },
          select: { id: true },
        }),
      ),
      unless("gathering", () =>
        db.userGatheringExpedition.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
      ),
      unless("hunting", () =>
        db.userHuntingExpedition.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
      ),
      unless("dungeon", () =>
        db.userDungeonRun.findFirst({
          where: { userId, claimedAt: null },
          select: { id: true },
        }),
      ),
    ]);

  return { travel, vocation, garden, gathering, hunting, dungeon };
}

/**
 * Throws when any activity other than `own` is in progress. The caller checks
 * its own kind itself, since starting over it is decided per activity. To stop
 * two parallel starts both passing, call it with the transaction after
 * `lockUser`, before creating the row.
 */
export async function assertNoOtherActivity(
  userId: string,
  own: ActivityKind,
  db: Db = prisma,
) {
  const rows = await getActivityRows(userId, own, db);
  if (Object.values(rows).some(Boolean)) {
    throw new Error("You already have an active activity");
  }
}

/**
 * For a finished run whose saved data can never be resolved (retrying would
 * fail forever and block every new activity): `close` marks it claimed with no
 * rewards, then the player gets a clear message. Player-fixable failures such
 * as a full inventory must not come through here.
 */
export async function closeInvalidRun(
  kind: string,
  runId: number,
  close: () => Promise<unknown>,
): Promise<never> {
  await close();
  console.error(`[activity] closed ${kind} ${runId}: invalid saved run data`);
  throw new Error("This run's data was invalid and has been closed.");
}
