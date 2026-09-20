import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getSkillMetrics } from "~/server/skills/metrics";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Lifetime totals for one skill: items, experience and time. */
export async function GET(request: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skillName = request.nextUrl.searchParams.get("skill");
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

  return NextResponse.json(await getSkillMetrics(session.user.id, actionType));
}
