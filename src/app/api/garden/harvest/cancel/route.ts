import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { cancelGardenHarvest } from "~/server/garden";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await cancelGardenHarvest(session.user.id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
