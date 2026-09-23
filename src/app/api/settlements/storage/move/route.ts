import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { moveStorageItem } from "~/server/settlements";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    settlementId?: unknown;
    userItemId?: unknown;
    direction?: unknown;
    quantity?: unknown;
    toSlot?: unknown;
  } | null;
  if (
    typeof body?.settlementId !== "number" ||
    typeof body.userItemId !== "number" ||
    typeof body.quantity !== "number" ||
    (body.direction !== "DEPOSIT" && body.direction !== "WITHDRAW")
  ) {
    return NextResponse.json({ error: "Choose an item" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await moveStorageItem({
        userId: session.user.id,
        settlementId: body.settlementId,
        userItemId: body.userItemId,
        direction: body.direction,
        quantity: body.quantity,
        toSlot: typeof body.toSlot === "number" ? body.toSlot : null,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Move failed" },
      { status: 400 },
    );
  }
}
