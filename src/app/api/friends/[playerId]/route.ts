import { NextResponse, type NextRequest } from "next/server";
import {
  FRIEND_ACTIONS_PER_MINUTE,
  isEndableFriendRelation,
} from "~/game/friends";
import { getServerAuthSession } from "~/server/auth";
import { addFriend, endFriendRelation } from "~/server/players";
import { respond } from "~/server/players/respond";
import { sharedRateLimiter } from "~/server/security/rateLimit";

export const dynamic = "force-dynamic";

const friendActions = sharedRateLimiter("friend-actions", {
  limit: FRIEND_ACTIONS_PER_MINUTE,
  windowMs: 60_000,
});

function tooFast(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "You're doing that too fast. Wait a moment." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/** Asks the player to be friends, or accepts their request. */
export async function POST(
  _request: Request,
  { params }: { params: { playerId: string } },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = friendActions.hit(session.user.id);
  if (!limit.ok) return tooFast(limit.retryAfterSeconds);

  return respond(async () => ({
    relation: await addFriend(session.user.id, params.playerId),
  }));
}

/**
 * Unfriends, cancels a request or declines one. `expect` is what the player
 * saw (friends, outgoing or incoming), so a stale button changes nothing.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { playerId: string } },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expect = request.nextUrl.searchParams.get("expect");
  if (!isEndableFriendRelation(expect)) {
    return NextResponse.json({ error: "Nothing to undo" }, { status: 400 });
  }
  const limit = friendActions.hit(session.user.id);
  if (!limit.ok) return tooFast(limit.retryAfterSeconds);

  return respond(async () => ({
    relation: await endFriendRelation(session.user.id, params.playerId, expect),
  }));
}
