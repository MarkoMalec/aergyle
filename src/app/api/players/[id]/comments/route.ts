import { NextResponse, type NextRequest } from "next/server";
import { COMMENTS_PER_MINUTE } from "~/game/players";
import { getServerAuthSession } from "~/server/auth";
import { listProfileComments, postProfileComment } from "~/server/players";
import { sharedRateLimiter } from "~/server/security/rateLimit";
import { respond } from "~/server/players/respond";

export const dynamic = "force-dynamic";

const commentsByPlayer = sharedRateLimiter("profile-comments", {
  limit: COMMENTS_PER_MINUTE,
  windowMs: 60_000,
});

/** A page of the profile's comments; `cursor` continues after the last one. */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cursor = Number(request.nextUrl.searchParams.get("cursor"));
  return respond(() =>
    listProfileComments({
      viewerId: session.user.id,
      profileId: params.id,
      cursor: Number.isInteger(cursor) && cursor > 0 ? cursor : null,
    }),
  );
}

/** Posts a comment, or a reply with `parentId`. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    body?: unknown;
    parentId?: unknown;
  } | null;
  if (typeof body?.body !== "string") {
    return NextResponse.json(
      { error: "Write something first" },
      { status: 400 },
    );
  }

  const limit = commentsByPlayer.hit(session.user.id);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You're commenting too fast. Wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  return respond(() =>
    postProfileComment({
      authorId: session.user.id,
      profileId: params.id,
      body: body.body as string,
      parentId: typeof body.parentId === "number" ? body.parentId : null,
    }),
  );
}
