import { NextResponse, type NextRequest } from "next/server";
import {
  FRIEND_SEARCHES_PER_MINUTE,
  readFriendSearchTerm,
} from "~/game/friends";
import { getServerAuthSession } from "~/server/auth";
import { searchPlayers } from "~/server/players";
import { respond } from "~/server/players/respond";
import { sharedRateLimiter } from "~/server/security/rateLimit";

export const dynamic = "force-dynamic";

const searches = sharedRateLimiter("friend-search", {
  limit: FRIEND_SEARCHES_PER_MINUTE,
  windowMs: 60_000,
});

/** Players whose name tag starts with `q`, and where the player stands with each. */
export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const term = readFriendSearchTerm(request.nextUrl.searchParams.get("q"));
  if (!term) return NextResponse.json({ players: [] });

  const limit = searches.hit(session.user.id);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You're searching too fast. Wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  return respond(async () => ({
    players: await searchPlayers(session.user.id, term),
  }));
}
