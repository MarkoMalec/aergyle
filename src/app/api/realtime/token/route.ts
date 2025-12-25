import { NextResponse } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { env } from "~/env";
import { signRealtimeToken } from "~/server/realtime/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = env.REALTIME_TOKEN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Realtime token secret not configured" },
      { status: 500 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const token = signRealtimeToken(
    {
      sub: session.user.id,
      exp: now + 60, // 60s token; client reconnects as needed
    },
    secret,
  );

  return NextResponse.json({ token, expiresInSeconds: 60 });
}
