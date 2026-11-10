import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { playerErrorMessage } from "~/server/playerError";
import { sharedRateLimiter } from "~/server/security/rateLimit";
import { listConversations, sendMessage } from "~/server/communication";

export const dynamic = "force-dynamic";

const sends = sharedRateLimiter("messages", { limit: 10, windowMs: 60_000 });

/** The player's conversations, with how many slots they have left. */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await listConversations(session.user.id));
}

/** Writes a message: a reply in `conversationId`, or a new thread with `to`. */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = sends.hit(session.user.id);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You're doing that too fast. Wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    conversationId?: unknown;
    to?: unknown;
    body?: unknown;
  } | null;
  if (typeof body?.body !== "string") {
    return NextResponse.json(
      { error: "Write something first" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await sendMessage({
        senderId: session.user.id,
        conversationId:
          typeof body.conversationId === "number"
            ? body.conversationId
            : undefined,
        recipientId: typeof body.to === "string" ? body.to : undefined,
        body: body.body,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: playerErrorMessage(error, "Could not send") },
      { status: 400 },
    );
  }
}
