import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { listConversations, sendMessage } from "~/server/communication";

export const dynamic = "force-dynamic";

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
      { error: error instanceof Error ? error.message : "Could not send" },
      { status: 400 },
    );
  }
}
