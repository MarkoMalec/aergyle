import { NextResponse, type NextRequest } from "next/server";
import { isNotificationCategory } from "~/game/communication";
import { getServerAuthSession } from "~/server/auth";
import { clearNotifications, listNotifications } from "~/server/communication";

export const dynamic = "force-dynamic";

/** A page of the player's notifications, newest first. */
export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const category = params.get("category");
  const cursor = Number(params.get("cursor"));
  return NextResponse.json(
    await listNotifications(session.user.id, {
      category: isNotificationCategory(category) ? category : undefined,
      cursor: Number.isInteger(cursor) && cursor > 0 ? cursor : undefined,
    }),
  );
}

/** Empties the player's own list. */
export async function DELETE() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await clearNotifications(session.user.id));
}
