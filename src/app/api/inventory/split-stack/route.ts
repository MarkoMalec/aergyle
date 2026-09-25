import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { splitStack } from "~/utils/userItems";

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      userItemId?: unknown;
      splitQuantity?: unknown;
    } | null;
    const userItemId = body?.userItemId;
    const splitQuantity = body?.splitQuantity;

    if (!isPositiveInteger(userItemId) || !isPositiveInteger(splitQuantity)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = await splitStack(
      session.user.id,
      userItemId,
      splitQuantity
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error splitting stack:", error);
    return NextResponse.json(
      { error: "Failed to split stack" },
      { status: 500 }
    );
  }
}
