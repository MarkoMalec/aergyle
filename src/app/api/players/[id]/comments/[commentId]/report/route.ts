import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { reportProfileComment } from "~/server/players";
import { respond } from "~/server/players/respond";

export const dynamic = "force-dynamic";

/** Sends a comment to the moderation queue. */
export async function POST(
  request: Request,
  { params }: { params: { id: string; commentId: string } },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const commentId = Number(params.commentId);
  if (!Number.isInteger(commentId)) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as {
    reason?: unknown;
  } | null;
  return respond(() =>
    reportProfileComment({
      reporterId: session.user.id,
      commentId,
      reason: typeof body?.reason === "string" ? body.reason : undefined,
    }),
  );
}
