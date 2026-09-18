import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { cancelHuntingExpedition } from "~/server/hunting";

export async function POST() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await cancelHuntingExpedition(session.user.id));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to cancel hunt",
      },
      { status: 400 },
    );
  }
}
