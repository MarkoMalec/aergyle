import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { startVocationalActivity } from "~/server/vocations";
import { prisma } from "~/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const resourceId = body?.resourceId;
  const durationSeconds = body?.durationSeconds ?? null;
  const replace = body?.replace;
  const baitUserItemId = body?.baitUserItemId ?? null;

  if (typeof resourceId !== "number") {
    return NextResponse.json({ error: "resourceId is required" }, { status: 400 });
  }

  try {
    const now = new Date();
    const travel = await prisma.userTravelActivity.findUnique({
      where: { userId: session.user.id },
      select: { endsAt: true, cancelledAt: true },
    });

    if (travel && !travel.cancelledAt && travel.endsAt > now) {
      return NextResponse.json(
        { error: "You cannot start an action while traveling" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { currentLocationId: true },
    });

    const status = await startVocationalActivity({
      userId: session.user.id,
      resourceId,
      locationId: user?.currentLocationId ?? null,
      durationSeconds,
      replace: replace === undefined ? true : Boolean(replace),
      baitUserItemId:
        baitUserItemId === null || baitUserItemId === undefined
          ? null
          : Number(baitUserItemId),
    });

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start activity" },
      { status: 400 },
    );
  }
}
