import { NextRequest, NextResponse } from "next/server";
import { recalculateItemStats } from "~/utils/rarity";

/**
 * POST /api/admin/rarity/recalculate
 * Recalculate item stats to match its current rarity
 * Use this when rarity was changed manually in the database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemId } = body;

    if (!itemId || typeof itemId !== "number") {
      return NextResponse.json(
        { error: "Valid itemId is required" },
        { status: 400 }
      );
    }

    const result = await recalculateItemStats(itemId);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      message: result.message,
      stats: result.stats,
    });
  } catch (error) {
    console.error("Error recalculating item stats:", error);
    return NextResponse.json(
      { error: "Failed to recalculate item stats" },
      { status: 500 }
    );
  }
}
