import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getQuestJournal } from "~/server/settlements";

/** The player's active quests everywhere, for the header quest menu. */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ quests: await getQuestJournal(session.user.id) });
}
