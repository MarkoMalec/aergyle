import { NextRequest, NextResponse } from "next/server";
import { addXpMultiplier } from "~/utils/leveling";
import { XpActionType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const { userId, name, multiplier, actionType, durationMinutes, uses, stackable } = await req.json();

    if (!userId || !name || !multiplier) {
      return NextResponse.json(
        { error: "Missing required fields: userId, name, multiplier" },
        { status: 400 }
      );
    }

    await addXpMultiplier(userId, name, multiplier, {
      actionType: actionType as XpActionType | undefined,
      durationMinutes,
      uses,
      stackable,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding XP multiplier:", error);
    return NextResponse.json(
      { error: "Failed to add XP multiplier" },
      { status: 500 }
    );
  }
}
