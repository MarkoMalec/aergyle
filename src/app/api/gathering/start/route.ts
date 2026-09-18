import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { startGatheringExpedition } from "~/server/gathering";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    durationId?: unknown;
  } | null;
  if (typeof body?.durationId !== "number") {
    return NextResponse.json(
      { error: "Choose an expedition duration" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await startGatheringExpedition({
        userId: session.user.id,
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
