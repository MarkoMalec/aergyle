import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { contributeToProject } from "~/server/settlements";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown;
    itemId?: unknown;
    quantity?: unknown;
  } | null;
  if (
    typeof body?.projectId !== "number" ||
    typeof body.itemId !== "number" ||
    typeof body.quantity !== "number"
  ) {
    return NextResponse.json({ error: "Choose what to contribute" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await contributeToProject({
        userId: session.user.id,
        projectId: body.projectId,
        itemId: body.itemId,
        quantity: body.quantity,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Contribution failed" },
      { status: 400 },
    );
  }
}
