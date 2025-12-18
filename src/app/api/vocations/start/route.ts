import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { startVocationalActivity } from "~/server/vocations";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const resourceId = body?.resourceId;
  const locationId = body?.locationId ?? null;
  const durationSeconds = body?.durationSeconds ?? null;
  const replace = body?.replace;

  if (typeof resourceId !== "number") {
    return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
  }

  try {
    const status = await startVocationalActivity({
      userId: session.user.id,
      resourceId,
      locationId,
      durationSeconds,
      replace: replace === undefined ? true : Boolean(replace),
    });

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start activity" },
      { status: 400 },
    );
  }
}
