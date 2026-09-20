import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { markNotificationsRead } from "~/server/communication";

/** Marks the given notifications read, or all of them when none are named. */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
  } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is number => Number.isInteger(id)).slice(0, 100)
    : undefined;
  return NextResponse.json(await markNotificationsRead(session.user.id, ids));
}
