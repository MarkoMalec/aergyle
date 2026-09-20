import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { sellToNpc } from "~/server/settlements";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    npcId?: unknown;
    userItemId?: unknown;
    quantity?: unknown;
  } | null;
  if (
    typeof body?.npcId !== "number" ||
    typeof body.userItemId !== "number" ||
    typeof body.quantity !== "number"
  ) {
    return NextResponse.json(
      { error: "Choose an item to sell" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await sellToNpc({
        userId: session.user.id,
        npcId: body.npcId,
        userItemId: body.userItemId,
        quantity: body.quantity,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sale failed" },
      { status: 400 },
    );
  }
}
