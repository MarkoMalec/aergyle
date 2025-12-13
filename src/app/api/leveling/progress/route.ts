import { NextRequest, NextResponse } from "next/server";
import { getXpProgress } from "~/utils/leveling";
import { getServerAuthSession } from "~/server/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const progress = await getXpProgress(userId);
    return NextResponse.json(progress);
  } catch (error) {
    console.error("Error getting XP progress:", error);
    return NextResponse.json(
      { error: "Failed to get XP progress" },
      { status: 500 }
    );
  }
}
