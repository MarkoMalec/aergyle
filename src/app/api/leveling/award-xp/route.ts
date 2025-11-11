import { NextRequest, NextResponse } from "next/server";
import { awardXp } from "~/utils/leveling";
import { XpActionType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { userId, amount, actionType, description } = await req.json();

    if (!userId || !amount || !actionType) {
      return NextResponse.json(
        { error: "Missing required fields: userId, amount, actionType" },
        { status: 400 }
      );
    }

    const result = await awardXp(
      userId,
      amount,
      actionType as XpActionType,
      description
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error awarding XP:", error);
    return NextResponse.json(
      { error: "Failed to award XP" },
      { status: 500 }
    );
  }
}
