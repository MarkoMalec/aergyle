import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getGardenHarvestStatus } from "~/server/garden";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getGardenHarvestStatus(session.user.id);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch harvest";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
