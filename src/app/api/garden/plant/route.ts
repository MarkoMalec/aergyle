import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { plantSeeds } from "~/server/garden";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | null
    | { seedItemId?: number; tileIndices?: number[] };

  const seedItemId = body?.seedItemId;
  const tileIndices = body?.tileIndices;

  if (typeof seedItemId !== "number" || !Array.isArray(tileIndices)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await plantSeeds({
      userId: session.user.id,
      seedItemId,
      tileIndices,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to plant";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
