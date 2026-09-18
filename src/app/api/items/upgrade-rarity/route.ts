import { NextRequest, NextResponse } from "next/server";
import { upgradeUserItemRarity } from "~/utils/userItems";
import { getServerAuthSession } from "~/server/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { userItemId?: unknown };
    const userItemId = Number(body.userItemId);
    const userId = session.user.id;

    if (!Number.isSafeInteger(userItemId) || userItemId <= 0) {
      return NextResponse.json(
        { error: "A valid userItemId is required" },
        { status: 400 },
      );
    }

    const result = await upgradeUserItemRarity(userItemId, userId);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      newRarity: result.newRarity,
      newStats: result.newStats,
    });
  } catch (error) {
    console.error("Error upgrading item rarity:", error);
    return NextResponse.json(
      { error: "Failed to upgrade item rarity" },
      { status: 500 },
    );
  }
}
