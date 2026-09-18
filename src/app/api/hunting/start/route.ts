import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { startHuntingExpedition } from "~/server/hunting";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    groundId?: unknown;
    durationId?: unknown;
  } | null;
  if (
    typeof body?.groundId !== "number" ||
    typeof body.durationId !== "number"
  ) {
    return NextResponse.json(
      { error: "Choose a hunting ground and expedition duration" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await startHuntingExpedition({
        userId: session.user.id,
        groundId: body.groundId,
        durationId: body.durationId,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to depart" },
      { status: 400 },
    );
  }
}
