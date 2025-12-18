import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { getVocationalStatus, getVocationalStatusDebug } from "~/server/vocations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debugEnabled =
    process.env.NODE_ENV !== "production" &&
    req.nextUrl.searchParams.get("debug") === "1";
  const status = debugEnabled
    ? await getVocationalStatusDebug(session.user.id)
    : await getVocationalStatus(session.user.id);
  return NextResponse.json(status);
}
