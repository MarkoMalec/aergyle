import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getUnseenQuests } from "~/server/settlements";

/** One-time quests where the player stands that they have not seen yet. */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ quests: await getUnseenQuests(session.user.id) });
}
