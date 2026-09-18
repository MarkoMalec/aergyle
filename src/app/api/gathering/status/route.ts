import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getGatheringExpeditionStatus } from "~/server/gathering";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getGatheringExpeditionStatus(session.user.id));
}
