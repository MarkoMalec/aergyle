import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { buyNpcOffer } from "~/server/settlements";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    offerId?: unknown;
    quantity?: unknown;
  } | null;
  if (typeof body?.offerId !== "number" || typeof body.quantity !== "number") {
    return NextResponse.json({ error: "Choose an item" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await buyNpcOffer({
        userId: session.user.id,
        offerId: body.offerId,
        quantity: body.quantity,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Purchase failed" },
      { status: 400 },
    );
  }
}
