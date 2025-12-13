import { NextRequest, NextResponse } from "next/server";
import { awardXp } from "~/utils/leveling";
import { XpActionType } from "@prisma/client";
import { getServerAuthSession } from "~/server/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { amount, actionType, description } = await req.json();

      if (amount == null || !actionType) {
        return NextResponse.json(
          { error: "Missing required fields: amount, actionType" },
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
