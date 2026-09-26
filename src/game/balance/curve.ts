import type { LevelCurve } from "~/generated/prisma/enums";

/**
 * A level curve is designed as a formula and stored as a table. The XP needed
 * to go from level L to L + 1 is
 *
 *   firstLevelXp × L^power × (1 + growthPercent / 100)^(L − 1) × bands
 *
 * rounded down (at least 1). `power` gives polynomial growth (1 = linear,
 * 2 = quadratic), `growthPercent` exponential growth (RuneScape adds ~10.4%
 * per level); combining them gives a gentle start with a steep end. Bands
 * multiply the cost of reaching a range of levels, for walls and soft caps.
 *
 * Pure and client-safe: the admin designer previews with it and the save
 * route generates the stored thresholds with the same function.
 */

export type DifficultyBand = {
  /** First level whose cost is multiplied. */
  fromLevel: number;
  /** Last level whose cost is multiplied. */
  toLevel: number;
  multiplier: number;
};

/** "Reaching `level` should take about `days`" for the chosen player profile. */
export type PacingTarget = { level: number; days: number };

export type CurveDesign = {
  maxLevel: number;
  firstLevelXp: number;
  power: number;
  growthPercent: number;
  bands: DifficultyBand[];
  targets: PacingTarget[];
};

/** totals[L] = total XP needed to reach level L; totals[1] = 0. */
export type CurveTable = { totals: number[]; maxLevel: number };

export const CURVE_LIMITS = {
  maxLevel: 5_000,
  firstLevelXp: 1_000_000_000,
  power: 10,
  growthPercent: 100,
  bands: 20,
  targets: 30,
  bandMultiplier: 1_000,
} as const;

// The game stores totals as BIGINT but every reader works in JS numbers.
const MAX_TOTAL_XP = Number.MAX_SAFE_INTEGER;

// Matches the tables that were live before designs were stored: the
// character curve was 5·L^1.5 per level, and skills ten times harder.
export const DEFAULT_CURVE_DESIGNS: Record<LevelCurve, CurveDesign> = {
  CHARACTER: {
    maxLevel: 2_000,
    firstLevelXp: 5,
    power: 1.5,
    growthPercent: 0,
    bands: [],
    targets: [],
  },
  SKILL: {
    maxLevel: 2_000,
    firstLevelXp: 50,
    power: 1.5,
    growthPercent: 0,
    bands: [],
    targets: [],
  },
};

export const CURVE_LABELS: Record<LevelCurve, string> = {
  CHARACTER: "Character level",
  SKILL: "Skill levels",
};

export function bandMultiplier(design: CurveDesign, level: number) {
  let multiplier = 1;
  for (const band of design.bands) {
    if (level >= band.fromLevel && level <= band.toLevel) {
      multiplier *= band.multiplier;
    }
  }
  return multiplier;
}

/** Unrounded XP from `level` to `level + 1`. */
function rawStep(design: CurveDesign, level: number) {
  return (
    design.firstLevelXp *
    Math.pow(level, design.power) *
    Math.pow(1 + design.growthPercent / 100, level - 1) *
    bandMultiplier(design, level + 1)
  );
}

/** XP needed to go from `level` to `level + 1`. */
export function stepXp(design: CurveDesign, level: number) {
  return Math.max(1, Math.floor(rawStep(design, level)));
}

/**
 * The curve's cumulative table. A design whose totals would pass the largest
 * exact number stops at the last representable level; `curveProblems`
 * reports it so such a design can't be saved.
 */
export function buildCurve(design: CurveDesign): CurveTable {
  const maxLevel = Math.max(1, Math.floor(design.maxLevel));
  const totals = [0, 0];
  for (let level = 2; level <= maxLevel; level += 1) {
    const next = totals[level - 1]! + stepXp(design, level - 1);
    if (!Number.isFinite(next) || next > MAX_TOTAL_XP) break;
    totals.push(next);
  }
  return { totals, maxLevel: totals.length - 1 };
}

/** A stored threshold table as a curve; rows must cover levels 1..max. */
export function curveFromTotals(totals: number[]): CurveTable {
  return { totals, maxLevel: Math.max(1, totals.length - 1) };
}

export function totalXpForLevel(curve: CurveTable, level: number) {
  if (level <= 1) return 0;
  return curve.totals[Math.min(level, curve.maxLevel)]!;
}

/** Highest level whose total is already reached. */
export function levelForXp(curve: CurveTable, xp: number) {
  const { totals } = curve;
  let low = 1;
  let high = curve.maxLevel;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (totals[mid]! <= xp) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Everything that stops a design from being saved, as sentences. */
export function curveProblems(design: CurveDesign): string[] {
  const problems: string[] = [];
  const whole = (value: number) => Number.isInteger(value);
  if (!whole(design.maxLevel) || design.maxLevel < 2) {
    problems.push("Max level must be a whole number of at least 2.");
  } else if (design.maxLevel > CURVE_LIMITS.maxLevel) {
    problems.push(`Max level can be at most ${CURVE_LIMITS.maxLevel}.`);
  }
  if (
    !(design.firstLevelXp > 0) ||
    design.firstLevelXp > CURVE_LIMITS.firstLevelXp
  ) {
    problems.push("XP for level 2 must be above 0.");
  }
  if (!(design.power >= 0) || design.power > CURVE_LIMITS.power) {
    problems.push(`Power must be between 0 and ${CURVE_LIMITS.power}.`);
  }
  if (
    !(design.growthPercent >= 0) ||
    design.growthPercent > CURVE_LIMITS.growthPercent
  ) {
    problems.push(
      `Growth per level must be between 0% and ${CURVE_LIMITS.growthPercent}%.`,
    );
  }
  if (design.bands.length > CURVE_LIMITS.bands) {
    problems.push(`Use at most ${CURVE_LIMITS.bands} difficulty bands.`);
  }
  design.bands.forEach((band, index) => {
    if (
      !whole(band.fromLevel) ||
      !whole(band.toLevel) ||
      band.fromLevel < 2 ||
      band.toLevel < band.fromLevel
    ) {
      problems.push(
        `Band ${index + 1}: levels must be whole numbers from 2 up, and "to" can't be below "from".`,
      );
    }
    if (
      !(band.multiplier > 0) ||
      band.multiplier > CURVE_LIMITS.bandMultiplier
    ) {
      problems.push(
        `Band ${index + 1}: the multiplier must be above 0 and at most ${CURVE_LIMITS.bandMultiplier}.`,
      );
    }
  });
  if (design.targets.length > CURVE_LIMITS.targets) {
    problems.push(`Use at most ${CURVE_LIMITS.targets} pacing targets.`);
  }
  design.targets.forEach((target, index) => {
    if (!whole(target.level) || target.level < 2 || !(target.days > 0)) {
      problems.push(
        `Target ${index + 1}: pick a level from 2 up and a time above 0 days.`,
      );
    }
  });
  if (problems.length === 0) {
    const curve = buildCurve(design);
    if (curve.maxLevel < design.maxLevel) {
      problems.push(
        `Total XP grows too large after level ${curve.maxLevel}. Lower the max level or the growth.`,
      );
    }
  }
  return problems;
}

/**
 * The largest `power` or `growthPercent` (a multiple of `step`, not above the
 * current value) whose totals still fit every level up to the max level.
 * Null when even 0 overflows, e.g. because of a band.
 */
export function largestFitting(
  design: CurveDesign,
  key: "power" | "growthPercent",
  step: number,
): number | null {
  const fits = (value: number) =>
    buildCurve({ ...design, [key]: value }).maxLevel >= design.maxLevel;
  if (!fits(0)) return null;
  if (fits(design[key])) return design[key];
  let low = 0;
  let high = design[key];
  for (let round = 0; round < 40; round += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) low = mid;
    else high = mid;
  }
  return Number((Math.floor(low / step) * step).toFixed(6));
}

export type CurvePreset = {
  id: string;
  label: string;
  description: string;
  power: number;
  growthPercent: number;
};

/** Shapes only: applying one keeps the XP needed for the anchor level. */
export const CURVE_PRESETS: CurvePreset[] = [
  {
    id: "linear",
    label: "Linear",
    description: "Every level costs a little more by the same amount.",
    power: 1,
    growthPercent: 0,
  },
  {
    id: "steady",
    label: "Steady",
    description: "Power 1.5: a gentle start that keeps rising.",
    power: 1.5,
    growthPercent: 0,
  },
  {
    id: "classic",
    label: "Classic RPG",
    description: "Power 2 (quadratic), common in RPGs and MMOs.",
    power: 2,
    growthPercent: 0,
  },
  {
    id: "hybrid",
    label: "Hybrid",
    description: "Linear plus 2% compounding: steep only near the top.",
    power: 1,
    growthPercent: 2,
  },
  {
    id: "exponential",
    label: "RuneScape-style",
    description: "+10.4% per level: each 7 levels double the cost.",
    power: 0,
    growthPercent: 10.41,
  },
];

/** The level whose total XP presets keep: 100, or the max level if lower. */
export function presetAnchorLevel(design: CurveDesign) {
  return Math.max(2, Math.min(100, Math.floor(design.maxLevel)));
}

/** Changes `firstLevelXp` so reaching `level` needs about `totalXp`. */
export function scaleDesignToTotal(
  design: CurveDesign,
  level: number,
  totalXp: number,
): CurveDesign {
  let current = 0;
  for (let step = 1; step < level; step += 1) current += rawStep(design, step);
  if (!(current > 0) || !(totalXp > 0)) return design;
  const firstLevelXp = design.firstLevelXp * (totalXp / current);
  return { ...design, firstLevelXp: Number(firstLevelXp.toPrecision(4)) };
}

export function applyPreset(
  design: CurveDesign,
  preset: CurvePreset,
): CurveDesign {
  const anchor = presetAnchorLevel(design);
  const keep = totalXpForLevel(buildCurve(design), anchor);
  return scaleDesignToTotal(
    { ...design, power: preset.power, growthPercent: preset.growthPercent },
    anchor,
    keep,
  );
}

/** Loose JSON (a stored design, a URL parameter) back into a design. */
export function parseCurveDesign(
  value: unknown,
  fallback: CurveDesign,
): CurveDesign {
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  const num = (key: string, backup: number) =>
    typeof raw[key] === "number" && Number.isFinite(raw[key])
      ? (raw[key] as number)
      : backup;
  const list = <T>(key: string, map: (entry: Record<string, unknown>) => T) =>
    Array.isArray(raw[key])
      ? (raw[key] as unknown[])
          .filter(
            (entry): entry is Record<string, unknown> =>
              !!entry && typeof entry === "object",
          )
          .map(map)
      : [];
  const field = (entry: Record<string, unknown>, key: string) =>
    typeof entry[key] === "number" ? (entry[key] as number) : Number.NaN;
  return {
    maxLevel: num("maxLevel", fallback.maxLevel),
    firstLevelXp: num("firstLevelXp", fallback.firstLevelXp),
    power: num("power", fallback.power),
    growthPercent: num("growthPercent", fallback.growthPercent),
    bands: list("bands", (entry) => ({
      fromLevel: field(entry, "fromLevel"),
      toLevel: field(entry, "toLevel"),
      multiplier: field(entry, "multiplier"),
    })),
    targets: list("targets", (entry) => ({
      level: field(entry, "level"),
      days: field(entry, "days"),
    })),
  };
}
