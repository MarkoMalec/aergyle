import { NextRequest, NextResponse } from "next/server";
import { upgradeItemRarity } from "~/utils/rarity";

export async function POST(req: NextRequest) {
  try {
    const { itemId, userId } = await req.json();

    if (!itemId || !userId) {
      return NextResponse.json(
        { error: "Missing itemId or userId" },
        { status: 400 }
      );
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
