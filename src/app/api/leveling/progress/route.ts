import { NextRequest, NextResponse } from "next/server";
import { getXpProgress } from "~/utils/leveling";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400 }
      );
    }

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
