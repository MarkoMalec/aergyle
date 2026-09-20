import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getSkillLevels } from "~/server/skills/levels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Every skill level of the signed-in player, keyed by progression track. */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getSkillLevels(session.user.id));
}
