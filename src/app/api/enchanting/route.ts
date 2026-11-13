import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { attemptEnchant, getEnchantPreview } from "~/server/enchanting/service";
import { playerErrorMessage } from "~/server/playerError";

export const dynamic = "force-dynamic";

/** GET ?userItemId= : cost, chance and risk of the next attempt. */
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userItemId = Number(new URL(request.url).searchParams.get("userItemId"));
  if (!Number.isInteger(userItemId) || userItemId < 1) {
    return NextResponse.json({ error: "Choose an item" }, { status: 400 });
  }
  try {
    return NextResponse.json(await getEnchantPreview(session.user.id, userItemId));
  } catch (error) {
    return NextResponse.json(
      { error: playerErrorMessage(error, "Couldn't load enchanting") },
      { status: 400 },
    );
  }
}

/** POST { userItemId, copyUserItemId? } : one attempt. */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    userItemId?: unknown;
    copyUserItemId?: unknown;
  } | null;
  const userItemId = body?.userItemId;
  const copy = body?.copyUserItemId;
  if (
    typeof userItemId !== "number" ||
    !Number.isInteger(userItemId) ||
    (copy != null && (typeof copy !== "number" || !Number.isInteger(copy)))
  ) {
    return NextResponse.json({ error: "Choose an item" }, { status: 400 });
  }
  try {
    return NextResponse.json(
      await attemptEnchant({
        userId: session.user.id,
        userItemId,
        copyUserItemId: (copy) ?? null,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: playerErrorMessage(error, "Enchanting failed") },
      { status: 400 },
    );
  }
}
