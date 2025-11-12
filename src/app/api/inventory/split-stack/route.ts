import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { splitStack } from "~/utils/userItems";

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { userItemId, splitQuantity } = body;

    if (!userItemId || !splitQuantity) {
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
