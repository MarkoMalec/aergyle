import "server-only";

import {
  cooldownLeft,
  FRIEND_REQUEST_COOLDOWN_MS,
  FRIEND_SEARCH_RESULTS,
  friendPairKey,
  MAX_FRIENDS,
  MAX_PENDING_REQUESTS,
  type EndableFriendRelation,
  type FriendRelation,
} from "~/game/friends";
import { isOnline, playerName, playerProfileHref } from "~/game/players";
import { prisma } from "~/lib/prisma";
import { notify } from "~/server/communication/notifications";
import { getLevelCurve } from "~/utils/leveling";
import { levelForTotalXp } from "~/utils/xpCurve";

/**
 * Friends. A friendship is two rows (one per side) so a player's list is one
 * indexed read; a request is one row per pair, so neither side can stack
 * them. Asking a player who already asked you accepts their request.
 */

/** A refusal meant for the player, with the HTTP status to answer with. */
export class FriendError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type FriendPlayer = {
  id: string;
  name: string;
  image: string | null;
  level: number;
};

export type FriendView = FriendPlayer & {
  lastOnline: string;
  location: string | null;
  /** When the two became friends. */
  since: string;
};

export type FriendRequestView = { player: FriendPlayer; createdAt: string };

export type FriendsOverview = {
  /** Online first, then whoever was seen most recently. */
  friends: FriendView[];
  /** Requests waiting for this player's answer, newest first. */
  incoming: FriendRequestView[];
  /** Requests this player sent that are still open, newest first. */
  outgoing: FriendRequestView[];
  limit: number;
  pendingLimit: number;
};

export type FriendSearchResult = FriendPlayer & { relation: FriendRelation };

const PLAYER_SELECT = {
  id: true,
  name: true,
  image: true,
  experience: true,
} as const;

type PlayerRow = {
  id: string;
  name: string;
  image: string | null;
  experience: bigint;
};

async function toPlayers(rows: PlayerRow[]) {
  const curve = await getLevelCurve();
  return rows.map(
    (row): FriendPlayer => ({
      id: row.id,
      name: playerName(row.name),
      image: row.image,
      level: levelForTotalXp(curve, row.experience),
    }),
  );
}

function relationOf(
  viewerId: string,
  isFriend: boolean,
  request: { senderId: string; declinedAt: Date | null } | null | undefined,
): FriendRelation {
  if (isFriend) return "friends";
  if (!request || request.declinedAt) return "none";
  return request.senderId === viewerId ? "outgoing" : "incoming";
}

/** Where the viewer stands with one player. */
export async function getFriendRelation(
  viewerId: string,
  playerId: string,
): Promise<FriendRelation> {
  if (viewerId === playerId) return "self";
  const [friendship, request] = await Promise.all([
    prisma.friendship.findUnique({
      where: { userId_friendId: { userId: viewerId, friendId: playerId } },
      select: { userId: true },
    }),
    prisma.friendRequest.findUnique({
      where: { pairKey: friendPairKey(viewerId, playerId) },
      select: { senderId: true, declinedAt: true },
    }),
  ]);
  return relationOf(viewerId, friendship !== null, request);
}

/** The player's friends and open requests, for the Friends window. */
export async function listFriends(userId: string): Promise<FriendsOverview> {
  const [friendships, incoming, outgoing] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId },
      select: {
        createdAt: true,
        friend: {
          select: {
            ...PLAYER_SELECT,
            last_online: true,
            currentLocation: { select: { name: true } },
          },
        },
      },
    }),
    prisma.friendRequest.findMany({
      where: { receiverId: userId, declinedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, sender: { select: PLAYER_SELECT } },
    }),
    prisma.friendRequest.findMany({
      where: { senderId: userId, declinedAt: null },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, receiver: { select: PLAYER_SELECT } },
    }),
  ]);

  const [friendPlayers, senders, receivers] = await Promise.all([
    toPlayers(friendships.map((row) => row.friend)),
    toPlayers(incoming.map((row) => row.sender)),
    toPlayers(outgoing.map((row) => row.receiver)),
  ]);

  const now = Date.now();
  const friends = friendships
    .map(
      (row, index): FriendView => ({
        ...friendPlayers[index]!,
        lastOnline: row.friend.last_online.toISOString(),
        location: row.friend.currentLocation?.name ?? null,
        since: row.createdAt.toISOString(),
      }),
    )
    .sort((a, b) => {
      const aOnline = isOnline(a.lastOnline, now);
      if (aOnline !== isOnline(b.lastOnline, now)) return aOnline ? -1 : 1;
      return aOnline
        ? a.name.localeCompare(b.name)
        : Date.parse(b.lastOnline) - Date.parse(a.lastOnline);
    });

  return {
    friends,
    incoming: incoming.map((row, index) => ({
      player: senders[index]!,
      createdAt: row.createdAt.toISOString(),
    })),
    outgoing: outgoing.map((row, index) => ({
      player: receivers[index]!,
      createdAt: row.createdAt.toISOString(),
    })),
    limit: MAX_FRIENDS,
    pendingLimit: MAX_PENDING_REQUESTS,
  };
}

/** Just the ids, for filtering a ranking. */
export async function listFriendIds(userId: string) {
  const rows = await prisma.friendship.findMany({
    where: { userId },
    select: { friendId: true },
  });
  return rows.map((row) => row.friendId);
}

/** Requests waiting for this player's answer: the dot on the Friends button. */
export function countFriendRequests(userId: string) {
  return prisma.friendRequest.count({
    where: { receiverId: userId, declinedAt: null },
  });
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Players whose name tag starts with `term` (already read by
 * `readFriendSearchTerm`), the exact tag first, each with where the searcher
 * stands with them. The LIKE on the part before the first hyphen lets the
 * unique name index narrow the search, as in `findPlayerByTag`.
 */
export async function searchPlayers(
  userId: string,
  term: string,
): Promise<FriendSearchResult[]> {
  const prefix = term.split("-")[0] ?? "";
  const rows = await prisma.$queryRaw<
    { id: string; name: string; image: string | null; experience: string }[]
  >`
    SELECT id, name, image, CAST(experience AS CHAR) AS experience FROM User
    WHERE name LIKE ${`${escapeLike(prefix)}%`}
      AND REPLACE(name, ' ', '-') LIKE ${`${escapeLike(term)}%`}
      AND id <> ${userId}
    ORDER BY REPLACE(name, ' ', '-') = ${term} DESC, CHAR_LENGTH(name), name
    LIMIT ${FRIEND_SEARCH_RESULTS}`;
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [players, friendships, requests] = await Promise.all([
    toPlayers(
      rows.map((row) => ({ ...row, experience: BigInt(row.experience) })),
    ),
    prisma.friendship.findMany({
      where: { userId, friendId: { in: ids } },
      select: { friendId: true },
    }),
    prisma.friendRequest.findMany({
      where: { pairKey: { in: ids.map((id) => friendPairKey(userId, id)) } },
      select: {
        senderId: true,
        receiverId: true,
        declinedAt: true,
      },
    }),
  ]);

  const friendIds = new Set(friendships.map((row) => row.friendId));
  const requestWith = new Map(
    requests.map((row) => [
      row.senderId === userId ? row.receiverId : row.senderId,
      row,
    ]),
  );
  return players.map((player) => ({
    ...player,
    relation: relationOf(
      userId,
      friendIds.has(player.id),
      requestWith.get(player.id),
    ),
  }));
}

/** Someone else changed the same pair at the same moment; try again. */
class RaceLost extends Error {}

function isRace(error: unknown) {
  if (error instanceof RaceLost) return true;
  const code = (error as { code?: string } | null)?.code;
  // A duplicate request row, or a write conflict / deadlock.
  return code === "P2002" || code === "P2034";
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function assertRoom(tx: Tx, userId: string, message: string) {
  const count = await tx.friendship.count({ where: { userId } });
  if (count >= MAX_FRIENDS) throw new FriendError(message, 409);
}

/** One attempt at asking (or accepting); see `addFriend`. */
async function askOrAccept(
  tx: Tx,
  userId: string,
  them: { id: string; name: string },
): Promise<{ relation: FriendRelation; accepted: boolean }> {
  const pairKey = friendPairKey(userId, them.id);
  const friendship = await tx.friendship.findUnique({
    where: { userId_friendId: { userId, friendId: them.id } },
    select: { userId: true },
  });
  if (friendship) return { relation: "friends", accepted: false };

  const request = await tx.friendRequest.findUnique({ where: { pairKey } });

  if (request && !request.declinedAt) {
    if (request.senderId === userId) {
      return { relation: "outgoing", accepted: false };
    }
    // They asked first, so asking back accepts.
    await assertRoom(
      tx,
      userId,
      `Your friend list is full (${MAX_FRIENDS}). Remove someone first.`,
    );
    await assertRoom(tx, them.id, `${them.name}'s friend list is full.`);
    const taken = await tx.friendRequest.deleteMany({
      where: { pairKey, senderId: them.id, declinedAt: null },
    });
    if (taken.count === 0) throw new RaceLost();
    await tx.friendship.createMany({
      data: [
        { userId, friendId: them.id },
        { userId: them.id, friendId: userId },
      ],
      skipDuplicates: true,
    });
    return { relation: "friends", accepted: true };
  }

  if (request?.declinedAt && request.senderId === userId) {
    const wait =
      request.declinedAt.getTime() + FRIEND_REQUEST_COOLDOWN_MS - Date.now();
    if (wait > 0) {
      throw new FriendError(
        `${them.name} declined your request. You can ask again in ${cooldownLeft(wait)}.`,
        429,
      );
    }
  }

  await assertRoom(
    tx,
    userId,
    `Your friend list is full (${MAX_FRIENDS}). Remove someone first.`,
  );
  const pending = await tx.friendRequest.count({
    where: { senderId: userId, declinedAt: null },
  });
  if (pending >= MAX_PENDING_REQUESTS) {
    throw new FriendError(
      `You have ${MAX_PENDING_REQUESTS} requests waiting for an answer. Cancel one first.`,
      409,
    );
  }

  if (request) {
    // A declined request whose wait is over, or one this player declined and
    // now asks back: the new request takes its row.
    const replaced = await tx.friendRequest.updateMany({
      where: { pairKey, declinedAt: { not: null } },
      data: {
        senderId: userId,
        receiverId: them.id,
        declinedAt: null,
        createdAt: new Date(),
      },
    });
    if (replaced.count === 0) throw new RaceLost();
  } else {
    // Skipping the duplicate (rather than failing on it) keeps a lost race
    // out of the error log; the retry then sees the other's request.
    const created = await tx.friendRequest.createMany({
      data: [{ pairKey, senderId: userId, receiverId: them.id }],
      skipDuplicates: true,
    });
    if (created.count === 0) throw new RaceLost();
  }
  return { relation: "outgoing", accepted: false };
}

/**
 * Asks a player to be friends, or accepts if they already asked. Safe to
 * repeat: asking again while a request is open changes nothing. When both
 * players ask at the same moment, the one who loses the race accepts the
 * other's request on the retry.
 */
export async function addFriend(
  userId: string,
  playerId: string,
): Promise<FriendRelation> {
  if (userId === playerId) {
    throw new FriendError("You can't add yourself.");
  }
  const players = await prisma.user.findMany({
    where: { id: { in: [userId, playerId] } },
    select: { id: true, name: true },
  });
  const me = players.find((player) => player.id === userId);
  const them = players.find((player) => player.id === playerId);
  if (!me || !them) throw new FriendError("That player doesn't exist.", 404);

  for (let attempt = 0; ; attempt++) {
    try {
      const outcome = await prisma.$transaction((tx) =>
        askOrAccept(tx, userId, { id: them.id, name: playerName(them.name) }),
      );
      if (outcome.accepted) {
        const name = playerName(me.name);
        await notify(them.id, {
          category: "GENERAL",
          title: "Friend request accepted",
          body: `${name} accepted your friend request.`,
          href: playerProfileHref(name),
        });
      }
      return outcome.relation;
    } catch (error) {
      if (attempt < 2 && isRace(error)) continue;
      throw error;
    }
  }
}

/**
 * Ends what the player has with another: unfriends, cancels their request,
 * or declines the other's. `expect` is what the player saw when they clicked,
 * so a stale button (say, "Cancel request" after the other already accepted)
 * can't unfriend anyone.
 */
export async function endFriendRelation(
  userId: string,
  playerId: string,
  expect: EndableFriendRelation,
): Promise<FriendRelation> {
  const pairKey = friendPairKey(userId, playerId);
  let changed: number;

  if (expect === "friends") {
    // Both sides in one statement, so a friendship is never half there.
    const removed = await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId: playerId },
          { userId: playerId, friendId: userId },
        ],
      },
    });
    changed = removed.count;
  } else if (expect === "outgoing") {
    const cancelled = await prisma.friendRequest.deleteMany({
      where: { pairKey, senderId: userId, declinedAt: null },
    });
    changed = cancelled.count;
  } else {
    const now = new Date();
    const declined = await prisma.friendRequest.updateMany({
      where: { pairKey, senderId: playerId, declinedAt: null },
      data: { declinedAt: now },
    });
    changed = declined.count;
    // Declines whose wait is over have done their job.
    await prisma.friendRequest.deleteMany({
      where: {
        declinedAt: { lt: new Date(now.getTime() - FRIEND_REQUEST_COOLDOWN_MS) },
      },
    });
  }

  if (changed === 0) {
    throw new FriendError("That already changed. Take another look.", 409);
  }
  return "none";
}
