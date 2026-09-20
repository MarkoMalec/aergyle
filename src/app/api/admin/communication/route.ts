import { NextResponse, type NextRequest } from "next/server";
import { isNotificationCategory } from "~/game/communication";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { notify, notifyMany, sendSystemMessage } from "~/server/communication";

/**
 * Sends a notification or a system message from the admin panel: to one
 * player by name, or to everyone when no name is given.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    to?: unknown;
    category?: unknown;
    title?: unknown;
    body?: unknown;
    href?: unknown;
  } | null;

  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Write the message" }, { status: 400 });
  }

  const name = typeof body?.to === "string" ? body.to.trim() : "";
  let recipients: string[] | null = null;
  if (name) {
    const player = await prisma.user.findFirst({
      where: { name },
      select: { id: true },
    });
    if (!player) {
      return NextResponse.json(
        { error: `No player named "${name}"` },
        { status: 400 },
      );
    }
    recipients = [player.id];
  }

  if (body?.kind === "MESSAGE") {
    if (!recipients) {
      return NextResponse.json(
        { error: "System messages go to one player; name them" },
        { status: 400 },
      );
    }
    await sendSystemMessage(recipients[0]!, text);
    return NextResponse.json({ ok: true, sent: 1 });
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json(
      { error: "Give the notification a title" },
      { status: 400 },
    );
  }
  const draft = {
    category: isNotificationCategory(body?.category) ? body.category : "SYSTEM",
    title,
    body: text,
    href:
      typeof body?.href === "string" && body.href.trim()
        ? body.href.trim()
        : null,
  } as const;

  if (recipients) {
    await notify(recipients[0]!, draft);
    return NextResponse.json({ ok: true, sent: 1 });
  }

  const everyone = await prisma.user.findMany({ select: { id: true } });
  await notifyMany(
    everyone.map((player) => player.id),
    draft,
  );
  return NextResponse.json({ ok: true, sent: everyone.length });
}
