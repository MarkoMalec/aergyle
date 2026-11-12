import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { playerErrorMessage } from "~/server/playerError";
import { claimProjectReward } from "~/server/settlements";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { rewardId?: unknown } | null;
  if (typeof body?.rewardId !== "number" || !Number.isInteger(body.rewardId)) {
    return NextResponse.json({ error: "Choose a reward to claim" }, { status: 400 });
  }
  try {
    return NextResponse.json(await claimProjectReward(session.user.id, body.rewardId));
  } catch (error) {
    return NextResponse.json(
      { error: playerErrorMessage(error, "Claiming failed") },
      { status: 400 },
    );
  }
}
