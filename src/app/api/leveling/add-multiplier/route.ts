import { NextRequest, NextResponse } from "next/server";
import { addXpMultiplier } from "~/utils/leveling";
import { VocationalActionType, XpActionType } from "~/generated/prisma/enums";
import { getServerAuthSession } from "~/server/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const {
      name,
      multiplier,
      actionType,
      vocationalActionType,
      durationMinutes,
      uses,
      stackable,
    } = await req.json();

    if (!name || multiplier == null) {
      return NextResponse.json(
        { error: "Missing required fields: name, multiplier" },
        { status: 400 }
      );
    }

    if (vocationalActionType && actionType !== "VOCATION") {
      return NextResponse.json(
        { error: "vocationalActionType is only valid when actionType is VOCATION" },
        { status: 400 },
      );
    }

    await addXpMultiplier(userId, name, multiplier, {
      actionType: actionType as XpActionType | undefined,
      vocationalActionType: vocationalActionType as VocationalActionType | undefined,
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
