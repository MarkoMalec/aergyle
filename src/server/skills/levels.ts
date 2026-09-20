import { prisma } from "~/lib/prisma";

export type SkillLevels = Record<string, number>;

/**
 * Every skill level of a player, keyed by progression track (e.g. "MINING").
 * Shared by the sidebar's server render and its refresh endpoint, so the
 * mastery badges never flash in.
 */
export async function getSkillLevels(userId: string): Promise<SkillLevels> {
  const rows = await prisma.userTrackProgress.findMany({
    where: { userId, trackType: "SKILL" },
    select: { trackKey: true, level: true },
  });
  return Object.fromEntries(rows.map((row) => [row.trackKey, row.level]));
}
