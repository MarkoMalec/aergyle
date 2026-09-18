import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { startDungeonRun } from "~/server/dungeons";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    dungeonId?: unknown;
  } | null;
  if (typeof body?.dungeonId !== "number") {
    return NextResponse.json({ error: "Choose a dungeon" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await startDungeonRun({
        userId: session.user.id,
        dungeonId: body.dungeonId,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to enter dungeon",
      },
      { status: 400 },
    );
  }
}
