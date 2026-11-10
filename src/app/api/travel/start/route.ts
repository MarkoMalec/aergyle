import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { startTravel } from "~/server/travel/service";
import { playerErrorMessage } from "~/server/playerError";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const toLocationId = body?.toLocationId;

  if (typeof toLocationId !== "number") {
    return NextResponse.json({ error: "toLocationId is required" }, { status: 400 });
  }

  try {
    await startTravel({ userId: session.user.id, toLocationId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: playerErrorMessage(error, "Failed to start travel") },
      { status: 400 },
    );
  }
}
