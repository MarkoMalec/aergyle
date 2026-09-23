import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { unlockStorage } from "~/server/settlements";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    settlementId?: unknown;
  } | null;
  if (typeof body?.settlementId !== "number") {
    return NextResponse.json({ error: "Choose a storage" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await unlockStorage({
        userId: session.user.id,
        settlementId: body.settlementId,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Renting failed" },
      { status: 400 },
    );
  }
}
