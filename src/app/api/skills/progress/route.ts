import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";
import { getTrackXpProgress } from "~/utils/progression";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const skillName = req.nextUrl.searchParams.get("skill");
    if (!skillName) {
      return NextResponse.json(
        { error: "Missing required query param: skill" },
        { status: 400 },
      );
    }

    const actionType = toVocationalActionTypeFromSkillName(skillName);
    if (!actionType) {
      return NextResponse.json(
        { error: "No progression track for this skill" },
        { status: 404 },
      );
    }

    const progress = await getTrackXpProgress({
      userId: session.user.id,
      trackType: "SKILL",
      trackKey: String(actionType),
    });

    return NextResponse.json({
      trackKey: String(actionType),
      ...progress,
    });
  } catch (error) {
    console.error("Error getting skill progress:", error);
    return NextResponse.json(
      { error: "Failed to get skill progress" },
      { status: 500 },
    );
  }
}
