import { prisma } from "~/lib/prisma";
import type { NavigationSkill } from "~/components/game/ui/Sidebars/navigation-links";
import { getTrackCurve } from "~/utils/progression";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";
import {
  levelForTotalXp,
  levelProgress,
  type LevelProgress,
} from "~/utils/xpCurve";
import { loadSkillArt, type SkillArt } from "./art";
import { getGameSkills } from "./list";

export type VocationSummary = NavigationSkill &
  SkillArt & {
    progress: LevelProgress;
    itemsGathered: number;
    secondsSpent: number;
  };

/**
 * Each skill's level progress and lifetime counters for the character page.
 * Read-only: unlike getTrackXpProgress it creates no row for an untouched skill.
 */
export async function getVocationSummaries(
  userId: string,
): Promise<VocationSummary[]> {
  const [skills, tracks, metrics, curve, artFor] = await Promise.all([
    getGameSkills(),
    prisma.userTrackProgress.findMany({
      where: { userId, trackType: "SKILL" },
      select: { trackKey: true, experience: true },
    }),
    prisma.userSkillMetric.findMany({
      where: { userId },
      select: { actionType: true, itemsGathered: true, secondsSpent: true },
    }),
    getTrackCurve("SKILL"),
    loadSkillArt(),
  ]);

  const xpByTrack = new Map(
    tracks.map((row) => [row.trackKey, row.experience]),
  );
  const metricByTrack = new Map(
    metrics.map((row) => [String(row.actionType), row]),
  );

  return skills.map((skill) => {
    const trackKey = toVocationalActionTypeFromSkillName(skill.name);
    const xp = (trackKey ? xpByTrack.get(trackKey) : undefined) ?? 0n;
    const metric = trackKey ? metricByTrack.get(trackKey) : undefined;
    return {
      ...skill,
      ...artFor(skill.name),
      // Derived from XP, so a curve edit shows before the stored level catches up.
      progress: levelProgress(curve, levelForTotalXp(curve, xp), xp),
      itemsGathered: Number(metric?.itemsGathered ?? 0n),
      secondsSpent: Number(metric?.secondsSpent ?? 0n),
    };
  });
}
