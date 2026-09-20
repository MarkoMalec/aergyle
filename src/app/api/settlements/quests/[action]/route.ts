import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { abandonQuest, acceptQuest, completeQuest } from "~/server/settlements";

const ACTIONS = {
  accept: acceptQuest,
  complete: completeQuest,
  abandon: abandonQuest,
} as const;

export async function POST(
  request: Request,
  context: { params: { action: string } },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const action = ACTIONS[context.params.action as keyof typeof ACTIONS];
  if (!action) {
    return NextResponse.json({ error: "Unknown quest action" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as {
    questId?: unknown;
  } | null;
  if (typeof body?.questId !== "number") {
    return NextResponse.json({ error: "Choose a quest" }, { status: 400 });
  }
  try {
    return NextResponse.json(await action(session.user.id, body.questId));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Quest action failed" },
      { status: 400 },
    );
  }
}
