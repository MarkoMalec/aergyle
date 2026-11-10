import type { PrismaClient } from "~/generated/prisma/client";

/**
 * Holds the player's User row until the surrounding transaction ends, so two
 * requests that check-then-write per-player limits (one activity at a time,
 * the conversation cap) run one after the other instead of both passing the
 * check. Plain reads after this see the latest committed data.
 */
export async function lockUser(
  db: Pick<PrismaClient, "$queryRaw">,
  userId: string,
) {
  await db.$queryRaw`SELECT id FROM User WHERE id = ${userId} FOR UPDATE`;
}
