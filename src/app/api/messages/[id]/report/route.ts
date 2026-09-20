import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { reportConversation } from "~/server/communication";

type Context = { params: { id: string } };

/** Copies the thread to the moderation queue, where neither side can erase it. */
export async function POST(request: Request, context: Context) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json(
      { error: "Invalid conversation" },
      { status: 400 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    reason?: unknown;
  } | null;
  try {
    return NextResponse.json(
      await reportConversation({
        reporterId: session.user.id,
        conversationId: id,
        reason: typeof body?.reason === "string" ? body.reason : undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not report" },
      { status: 400 },
    );
  }
}
