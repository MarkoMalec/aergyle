import "server-only";

import { prisma } from "~/lib/prisma";

/** At most one presence write per player this often; well inside ONLINE_WINDOW_MS (3 min). */
const PRESENCE_WRITE_EVERY_MS = 90_000;

/** When this process last wrote each player's presence; skips the DB round trip entirely. */
const lastWriteMs = ((globalThis as { __aergylePresence?: Map<string, number> })
  .__aergylePresence ??= new Map<string, number>());

/**
 * Marks the player as seen now. Called on every game page and by the
 * once-a-minute unread-count poll, so a player with the game open stays
 * "online". The condition makes repeat calls within the window a no-op.
 */
export async function touchLastOnline(userId: string, now = new Date()) {
  const nowMs = now.getTime();
  if (nowMs - (lastWriteMs.get(userId) ?? 0) < PRESENCE_WRITE_EVERY_MS) return;
  // One entry per player who visited since boot; drop stale ones so the map stays small.
  if (lastWriteMs.size > 5_000) {
    for (const [id, at] of lastWriteMs) {
      if (nowMs - at >= PRESENCE_WRITE_EVERY_MS) lastWriteMs.delete(id);
    }
  }
  lastWriteMs.set(userId, nowMs);
  try {
    await prisma.user.updateMany({
      where: {
        id: userId,
        last_online: { lt: new Date(nowMs - PRESENCE_WRITE_EVERY_MS) },
      },
      data: { last_online: now },
    });
  } catch (error) {
    console.error("Could not record presence:", error);
  }
}
