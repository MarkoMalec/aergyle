import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getCommunicationSummary } from "~/server/communication";
import { touchLastOnline } from "~/server/players/presence";

export const dynamic = "force-dynamic";

/** Unread counts behind the bell and the envelope in the sidebar. */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // This poll runs once a minute while the game is open, so it doubles as
  // the presence heartbeat.
  void touchLastOnline(session.user.id);
  return NextResponse.json(await getCommunicationSummary(session.user.id));
}
