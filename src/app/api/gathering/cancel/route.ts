import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { cancelGatheringExpedition } from "~/server/gathering";

export async function POST() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await cancelGatheringExpedition(session.user.id));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to cancel expedition",
      },
      { status: 400 },
    );
  }
}
