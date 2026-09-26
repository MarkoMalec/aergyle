import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "~/server/auth";
import {
  getUnseenSummaries,
  markSummariesSeen,
} from "~/server/activitySummaries";

export const dynamic = "force-dynamic";

/** Activities that finished while the player wasn't looking. */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getUnseenSummaries(session.user.id));
}

const seenSchema = z.object({ upTo: z.string().datetime().optional() });

/** Marks everything that ended up to `upTo` (default: now) as seen. */
export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => ({}));
  const parsed = seenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { upTo } = parsed.data;
  await markSummariesSeen(session.user.id, upTo ? new Date(upTo) : undefined);
  return NextResponse.json({ ok: true });
}
