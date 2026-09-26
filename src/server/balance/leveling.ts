import "server-only";

import type { Prisma } from "~/generated/prisma/client";
import { ItemType, type LevelCurve } from "~/generated/prisma/enums";
import {
  buildCurve,
  curveProblems,
  DEFAULT_CURVE_DESIGNS,
  parseCurveDesign,
  type CurveDesign,
} from "~/game/balance/curve";
import { isVocationSkill, type XpGroup } from "~/game/balance/content";
import { prisma } from "~/lib/prisma";
import { getLevelCurve } from "~/utils/leveling";
import { getTrackCurve } from "~/utils/progression";

export const LEVEL_CURVES: LevelCurve[] = ["CHARACTER", "SKILL"];

export type SavedCurve = {
  /** The stored design, or the default when none has been saved yet. */
  design: CurveDesign;
  designSaved: boolean;
  /** The live threshold table: totals[level]. */
  totals: number[];
  /** Lifetime XP of every player (character) or skill (skills), grouped. */
  playerXp: Array<[xp: number, count: number]>;
};

function totalsFromRows(rows: Array<{ level: number; xpTotal: bigint }>) {
  const totals = [0];
  for (const row of rows) totals[row.level] = Number(row.xpTotal);
  return totals;
}

export async function loadSavedCurves(): Promise<Record<LevelCurve, SavedCurve>> {
  const [designs, characterRows, skillRows, characterXp, skillXp] =
    await Promise.all([
      prisma.levelCurveDesign.findMany(),
      prisma.levelXpThreshold.findMany({
        orderBy: { level: "asc" },
        select: { level: true, xpTotal: true },
      }),
      prisma.trackXpThreshold.findMany({
        where: { trackType: "SKILL" },
        orderBy: { level: "asc" },
        select: { level: true, xpTotal: true },
      }),
      prisma.user.groupBy({ by: ["experience"], _count: { _all: true } }),
      prisma.userTrackProgress.groupBy({
        by: ["experience"],
        where: { trackType: "SKILL" },
        _count: { _all: true },
      }),
    ]);

  const saved = (curve: LevelCurve, rows: typeof characterRows, xp: typeof characterXp): SavedCurve => {
    const row = designs.find((design) => design.curve === curve);
    const design = row
      ? parseCurveDesign(row.design, DEFAULT_CURVE_DESIGNS[curve])
      : DEFAULT_CURVE_DESIGNS[curve];
    return {
      design,
      designSaved: Boolean(row),
      totals: rows.length > 1 ? totalsFromRows(rows) : buildCurve(design).totals,
      playerXp: xp.map((group) => [Number(group.experience), group._count._all]),
    };
  };

  return {
    CHARACTER: saved("CHARACTER", characterRows, characterXp),
    SKILL: saved("SKILL", skillRows, skillXp),
  };
}

/**
 * Stores a design, regenerates its threshold table and moves every player to
 * the level their lifetime XP now reaches, all in one transaction. XP itself
 * never changes, so saving the previous design undoes it exactly.
 */
export async function saveCurveDesign(curve: LevelCurve, design: CurveDesign) {
  const problems = curveProblems(design);
  if (problems.length > 0) throw new Error(problems[0]);

  const rows = buildCurve(design)
    .totals.slice(1)
    .map((total, index) => ({ level: index + 1, xpTotal: BigInt(total) }));

  await prisma.$transaction(
    async (tx) => {
      await tx.levelCurveDesign.upsert({
        where: { curve },
        create: { curve, design: design as unknown as Prisma.InputJsonValue },
        update: { design: design as unknown as Prisma.InputJsonValue },
      });
      if (curve === "CHARACTER") {
        await tx.levelXpThreshold.deleteMany({});
        await tx.levelXpThreshold.createMany({ data: rows });
        await tx.$executeRaw`
          UPDATE \`User\` u SET u.level = COALESCE(
            (SELECT MAX(t.level) FROM \`LevelXpThreshold\` t WHERE t.xpTotal <= u.experience),
            1)`;
      } else {
        await tx.trackXpThreshold.deleteMany({ where: { trackType: "SKILL" } });
        await tx.trackXpThreshold.createMany({
          data: rows.map((row) => ({ ...row, trackType: "SKILL" as const })),
        });
        await tx.$executeRaw`
          UPDATE \`UserTrackProgress\` p SET p.level = COALESCE(
            (SELECT MAX(t.level) FROM \`TrackXpThreshold\` t
              WHERE t.trackType = 'SKILL' AND t.xpTotal <= p.experience),
            1)
          WHERE p.trackType = 'SKILL'`;
      }
    },
    { timeout: 60_000 },
  );

  // This process picks the change up now; others within CURVE_REFRESH_MS.
  getLevelCurve.invalidate();
  getTrackCurve.invalidate();
}

/**
 * Multiplies every stored XP reward of one group, rounding to whole XP and
 * never dropping a paying reward to 0. Returns how many rows changed.
 */
export async function scaleGroupXp(group: XpGroup, factor: number) {
  if (!(factor > 0) || factor > 100) throw new Error("Choose a factor above 0 and at most 100");
  if (group === "DUNGEONS") {
    return prisma.$executeRaw`
      UPDATE \`Dungeon\` SET xpReward = GREATEST(1, ROUND(xpReward * ${factor}))
      WHERE xpReward > 0`;
  }
  if (group === "QUESTS") {
    return prisma.$executeRaw`
      UPDATE \`Quest\` SET rewardXp = GREATEST(1, ROUND(rewardXp * ${factor}))
      WHERE rewardXp > 0`;
  }
  if (group === "GATHERING") {
    return prisma.$executeRaw`
      UPDATE \`GatheringDuration\` SET xpReward = GREATEST(1, ROUND(xpReward * ${factor}))
      WHERE xpReward > 0`;
  }
  if (group === "HUNTING") {
    return prisma.$executeRaw`
      UPDATE \`HuntingDuration\` SET xpReward = GREATEST(1, ROUND(xpReward * ${factor}))
      WHERE xpReward > 0`;
  }
  if (group === "GARDENING") {
    return prisma.$executeRaw`
      UPDATE \`Item\` SET seedXp = GREATEST(1, ROUND(seedXp * ${factor}))
      WHERE itemType = ${ItemType.SEED} AND seedXp > 0`;
  }
  if (!isVocationSkill(group)) throw new Error("Unknown XP group");
  return prisma.$executeRaw`
    UPDATE \`VocationalResource\` SET xpPerUnit = GREATEST(1, ROUND(xpPerUnit * ${factor}))
    WHERE actionType = ${group} AND xpPerUnit > 0`;
}
