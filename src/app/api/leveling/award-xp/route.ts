import { NextRequest, NextResponse } from "next/server";
import { awardXp } from "~/utils/leveling";
import { VocationalActionType, XpActionType } from "~/generated/prisma/enums";
import { getServerAuthSession } from "~/server/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { amount, actionType, vocationalActionType, description } =
      await req.json();

    if (amount == null || !actionType) {
      return NextResponse.json(
        { error: "Missing required fields: amount, actionType" },
        { status: 400 }
      );
    }

    if (actionType === "VOCATION" && !vocationalActionType) {
      return NextResponse.json(
        {
          error:
            "Missing required field: vocationalActionType (required when actionType is VOCATION)",
        },
        { status: 400 },
      );
    }

    if (actionType !== "VOCATION" && vocationalActionType) {
      return NextResponse.json(
        {
          error:
            "vocationalActionType is only valid when actionType is VOCATION",
        },
        { status: 400 },
      );
    }

    const result = await awardXp(
      userId,
      amount,
      actionType as XpActionType,
      vocationalActionType as VocationalActionType | undefined,
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
