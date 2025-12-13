import { NextRequest, NextResponse } from "next/server";
import { upgradeItemRarity } from "~/utils/rarity";
import { getServerAuthSession } from "~/server/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await req.json();
    const userId = session.user.id;

    if (!itemId) {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    const result = await upgradeItemRarity(itemId, userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
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
      { status: 500 }
    );
  }
}
