import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getDungeonRunStatus } from "~/server/dungeons";
import { getGardenHarvestStatus } from "~/server/garden";
import { getGatheringExpeditionStatus } from "~/server/gathering";
import { getHuntingExpeditionStatus } from "~/server/hunting";
import { getTravelStatus } from "~/server/travel/service";
import { getVocationalStatus } from "~/server/vocations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** A kind whose status fails comes back null; the others still answer. */
function orNull<T>(kind: string, status: Promise<T>): Promise<T | null> {
  return status.catch((error: unknown) => {
    console.error(`[activity/status] ${kind} failed:`, error);
    return null;
  });
}

/**
 * Every activity's status in one request. The client picks the running one;
 * only one can run at a time.
 */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const [travel, garden, gathering, hunting, dungeon, vocation] =
    await Promise.all([
      orNull("travel", getTravelStatus(userId)),
      orNull("garden", getGardenHarvestStatus(userId)),
      orNull("gathering", getGatheringExpeditionStatus(userId)),
      orNull("hunting", getHuntingExpeditionStatus(userId)),
      orNull("dungeon", getDungeonRunStatus(userId)),
      orNull(
        "vocation",
        getVocationalStatus(userId).then((status) => ({
          serverNow: new Date().toISOString(),
          ...status,
        })),
      ),
    ]);

  return NextResponse.json({
    travel,
    garden,
    gathering,
    hunting,
    dungeon,
    vocation,
  });
}
