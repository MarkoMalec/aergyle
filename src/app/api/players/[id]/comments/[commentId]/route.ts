import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { deleteProfileComment } from "~/server/players";
import { respond } from "~/server/players/respond";

export const dynamic = "force-dynamic";

/** Removes a comment and its replies (its author or the profile's owner). */
export async function DELETE(
  _request: Request,
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
  return respond(() =>
    deleteProfileComment({ viewerId: session.user.id, commentId }),
  );
}
