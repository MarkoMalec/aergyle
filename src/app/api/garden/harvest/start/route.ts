import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { startGardenHarvest } from "~/server/garden";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | null
    | { tileIndices?: number[] };

  const tileIndices = body?.tileIndices;
  if (!Array.isArray(tileIndices)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const started = await startGardenHarvest({
      userId: session.user.id,
      tileIndices,
    });
    return NextResponse.json({ harvest: started });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start harvest";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
