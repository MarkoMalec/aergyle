import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { deleteConversation, getConversation } from "~/server/communication";

export const dynamic = "force-dynamic";

type Context = { params: { id: string } };

function conversationId(context: Context) {
  const id = Number(context.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** One thread, which also clears its unread mark. */
export async function GET(_request: Request, context: Context) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = conversationId(context);
  if (!id)
    return NextResponse.json(
      { error: "Invalid conversation" },
      { status: 400 },
    );
  try {
    return NextResponse.json(await getConversation(session.user.id, id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Not found" },
      { status: 404 },
    );
  }
}

/** Hides the thread for this player alone, freeing one of their slots. */
export async function DELETE(_request: Request, context: Context) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = conversationId(context);
  if (!id)
    return NextResponse.json(
      { error: "Invalid conversation" },
      { status: 400 },
    );
  try {
    return NextResponse.json(await deleteConversation(session.user.id, id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete" },
      { status: 400 },
    );
  }
}
