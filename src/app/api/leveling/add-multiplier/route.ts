import { NextRequest, NextResponse } from "next/server";
import { addXpMultiplier } from "~/utils/leveling";
import { XpActionType } from "@prisma/client";
import { getServerAuthSession } from "~/server/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { name, multiplier, actionType, durationMinutes, uses, stackable } = await req.json();

    if (!name || multiplier == null) {
      return NextResponse.json(
        { error: "Missing required fields: name, multiplier" },
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
