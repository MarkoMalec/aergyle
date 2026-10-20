import "server-only";

import { prisma } from "~/lib/prisma";

/** At most one presence write per player this often. */
const PRESENCE_WRITE_EVERY_MS = 60_000;

/**
 * Marks the player as seen now. Called on every game page and by the
 * once-a-minute unread-count poll, so a player with the game open stays
 * "online". The condition makes repeat calls within a minute a no-op.
 */
export async function touchLastOnline(userId: string, now = new Date()) {
  try {
    await prisma.user.updateMany({
      where: {
        id: userId,
        last_online: { lt: new Date(now.getTime() - PRESENCE_WRITE_EVERY_MS) },
      },
      data: { last_online: now },
    });
  } catch (error) {
    console.error("Could not record presence:", error);
  }
}
