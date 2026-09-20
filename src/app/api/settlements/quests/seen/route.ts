import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { markQuestsSeen } from "~/server/settlements";

/** Records the one-time quests an NPC's page has shown the player. */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    questIds?: unknown;
  } | null;
  const questIds = body?.questIds;
  if (
    !Array.isArray(questIds) ||
    questIds.length === 0 ||
    questIds.length > 100 ||
    !questIds.every((id): id is number => Number.isInteger(id))
  ) {
    return NextResponse.json({ error: "Invalid quests" }, { status: 400 });
  }
  return NextResponse.json(await markQuestsSeen(session.user.id, questIds));
}
