import type { CurveTable } from "./curve";
import {
  SKILLS,
  type ActivityGroup,
  type BalanceContent,
  type Track,
} from "./content";
import {
  gardenPlan,
  gateLevels,
  groupSources,
  mainTrack,
  pickBest,
  xpPerHour,
  xpScaleOf,
  type LevelOf,
  type Source,
  type SourceOptions,
} from "./sources";

/**
 * Plays a character forward day by day. Each day the player has a number of
 * activity hours and check-ins: an activity runs only until its idle cap (8 h
 * for vocations, the tier or run length for expeditions and dungeons), so a
 * player who checks in rarely can't fill a day with short runs. Within the
 * hours an activity gets, the character always uses the best source open at
 * its current levels, re-choosing at every level-up.
 *
 * Between level-ups XP rates are constant, so time is advanced one level-up at
 * a time and every "level reached" moment is exact, not sampled.
 */

export type PlayerProfile = {
  /** Hours per day an activity is running. */
  hoursPerDay: number;
  /** How often per day the player starts or collects activities. */
  checkInsPerDay: number;
};

export const PLAYER_PROFILES = [
  {
    id: "casual",
    label: "Casual",
    description: "3 check-ins, 12 h of activity a day",
    profile: { hoursPerDay: 12, checkInsPerDay: 3 },
  },
  {
    id: "regular",
    label: "Regular",
    description: "6 check-ins, 18 h a day",
    profile: { hoursPerDay: 18, checkInsPerDay: 6 },
  },
  {
    id: "dedicated",
    label: "Dedicated",
    description: "12 check-ins, 22 h a day",
    profile: { hoursPerDay: 22, checkInsPerDay: 12 },
  },
  {
    id: "nonstop",
    label: "Always on",
    description: "Restarts everything instantly, 24 h a day",
    profile: { hoursPerDay: 24, checkInsPerDay: 96 },
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  profile: PlayerProfile;
}>;

export type JourneyPlan = {
  groups: ActivityGroup[];
  /** "split": equal time per group; "fastest": most character XP first. */
  strategy: "split" | "fastest";
  garden: boolean;
  quests: boolean;
};

export type JourneyInput = {
  content: BalanceContent;
  curves: { character: CurveTable; skill: CurveTable };
  profile: PlayerProfile;
  plan: JourneyPlan;
  options: SourceOptions;
  days: number;
};

export type JourneySegment = {
  group: ActivityGroup;
  key: string;
  name: string;
  startDay: number;
  endDay: number;
  hours: number;
};

export type JourneyResult = {
  days: number;
  hoursPerDay: number;
  /** Level at the end of each day; index 0 is the start. */
  levelAtDay: Record<Track, number[]>;
  /** Day (fractional) each level was reached; NaN when never. */
  reachedDay: Record<Track, Float64Array>;
  /** Activity hours played when each level was reached; NaN when never. */
  reachedHours: Record<Track, Float64Array>;
  segments: JourneySegment[];
  hoursByGroup: Partial<Record<ActivityGroup | "GARDEN", number>>;
  characterXpBySource: Partial<
    Record<ActivityGroup | "GARDEN" | "QUESTS", number>
  >;
  /** Groups that had nothing to do, with the first day it happened. */
  blocked: Array<{ group: ActivityGroup; day: number }>;
  idleHours: number;
  playedHours: number;
};

export const MAX_JOURNEY_DAYS = 3_650;
const TRACKS: Track[] = ["CHARACTER", ...SKILLS];

function makeRecord<T>(make: (track: Track) => T): Record<Track, T> {
  return Object.fromEntries(TRACKS.map((track) => [track, make(track)])) as Record<
    Track,
    T
  >;
}

export function simulateJourney(input: JourneyInput): JourneyResult {
  const { content, plan, options } = input;
  const days = Math.max(1, Math.min(MAX_JOURNEY_DAYS, Math.floor(input.days)));
  const hoursPerDay = Math.max(0, Math.min(24, input.profile.hoursPerDay));
  const checkIns = Math.max(1, input.profile.checkInsPerDay);
  const curveOf = (track: Track) =>
    track === "CHARACTER" ? input.curves.character : input.curves.skill;

  const xp = makeRecord(() => 0);
  const level = makeRecord(() => 1);
  const reachedDay = makeRecord((track) => {
    const days = new Float64Array(curveOf(track).maxLevel + 1).fill(Number.NaN);
    days[1] = 0;
    return days;
  });
  const reachedHours = makeRecord((track) => {
    const hours = new Float64Array(curveOf(track).maxLevel + 1).fill(Number.NaN);
    hours[1] = 0;
    return hours;
  });
  const levelAtDay = makeRecord(() => [1]);
  const levelOf: LevelOf = (track) => level[track];
  const maxed = (track: Track) => level[track] >= curveOf(track).maxLevel;

  const result: Omit<JourneyResult, "levelAtDay" | "reachedDay" | "reachedHours"> = {
    days,
    hoursPerDay,
    segments: [],
    hoursByGroup: {},
    characterXpBySource: {},
    blocked: [],
    idleHours: 0,
    playedHours: 0,
  };
  const lastSegment = new Map<ActivityGroup, JourneySegment>();
  const blocked = new Set<ActivityGroup>();

  // Which sources are open changes only when some track reaches a level
  // that opens something, so source lists are rebuilt only then.
  const gates = gateLevels(content);
  let gateVersion = 0;
  const sourceCache = new Map<ActivityGroup, { version: number; sources: Source[] }>();
  function bestSource(group: ActivityGroup, hoursAvailable: number) {
    let cached = sourceCache.get(group);
    if (cached?.version !== gateVersion) {
      cached = { version: gateVersion, sources: groupSources(content, group, levelOf, options) };
      sourceCache.set(group, cached);
    }
    return pickBest(cached.sources, group, hoursAvailable, checkIns);
  }
  const rateCache = new WeakMap<Source, Array<{ track: Track; perHour: number }>>();
  function ratesOf(source: Source) {
    let rates = rateCache.get(source);
    if (!rates) {
      rates = (Object.keys(source.xp) as Track[])
        .map((track) => ({ track, perHour: xpPerHour(source, track) }))
        .filter((rate) => rate.perHour > 0);
      rateCache.set(source, rates);
    }
    return rates;
  }

  function grant(track: Track, amount: number, day: number) {
    if (!(amount > 0)) return;
    const curve = curveOf(track);
    xp[track] += amount;
    while (level[track] < curve.maxLevel) {
      const next = curve.totals[level[track] + 1]!;
      // Relative tolerance: a step that was sized to land exactly on a
      // threshold must not stop a hair short of it.
      if (xp[track] < next - Math.max(1e-6, next * 1e-12)) break;
      level[track] += 1;
      reachedDay[track][level[track]] = day;
      reachedHours[track][level[track]] = result.playedHours;
      if (gates.get(track)?.has(level[track])) gateVersion += 1;
    }
  }

  function credit(
    source: ActivityGroup | "GARDEN" | "QUESTS",
    characterXp: number,
  ) {
    result.characterXpBySource[source] =
      (result.characterXpBySource[source] ?? 0) + characterXp;
  }

  function advance(group: ActivityGroup, hours: number, day: number, offset: number) {
    let left = hours;
    let clock = offset;
    for (let guard = 0; left > 1e-9 && guard < 100_000; guard += 1) {
      if (maxed(mainTrack(group))) break;
      const source = bestSource(group, left);
      if (!source) break;
      const rates = ratesOf(source);
      let dt = left;
      for (const { track, perHour } of rates) {
        if (maxed(track)) continue;
        const need = curveOf(track).totals[level[track] + 1]! - xp[track];
        dt = Math.min(dt, Math.max(0, need) / perHour);
      }
      clock += dt;
      result.playedHours += dt;
      const when = day + clock / Math.max(hoursPerDay, 1e-9);
      for (const { track, perHour } of rates) grant(track, perHour * dt, when);
      credit(group, xpPerHour(source, "CHARACTER") * dt);
      result.hoursByGroup[group] = (result.hoursByGroup[group] ?? 0) + dt;
      left -= dt;

      const last = lastSegment.get(group);
      if (last?.key === source.key) {
        last.endDay = when;
        last.hours += dt;
      } else {
        const segment = {
          group,
          key: source.key,
          name: source.name,
          startDay: day + (clock - dt) / Math.max(hoursPerDay, 1e-9),
          endDay: when,
          hours: dt,
        };
        result.segments.push(segment);
        lastSegment.set(group, segment);
      }
    }
    return hours - left;
  }

  const onceDone = new Set<number>();
  function awardQuests(day: number) {
    const scale = xpScaleOf(options, "QUESTS");
    const give = (amount: number) => {
      grant("CHARACTER", amount, day);
      credit("QUESTS", amount);
    };
    // One-time quests can unlock more one-time quests by levelling up.
    for (let changed = true; changed; ) {
      changed = false;
      for (const quest of content.quests) {
        if (
          quest.repeat === "ONCE" &&
          !onceDone.has(quest.id) &&
          level.CHARACTER >= quest.requiredLevel
        ) {
          onceDone.add(quest.id);
          give(quest.xp * scale);
          changed = true;
        }
      }
    }
    for (const quest of content.quests) {
      if (level.CHARACTER < quest.requiredLevel) continue;
      if (quest.repeat === "DAILY" || (quest.repeat === "WEEKLY" && day % 7 === 0)) {
        give(quest.xp * scale);
      }
    }
  }

  /** Hours per group for one day, respecting each group's idle cap. */
  function allocate(budget: number, day: number) {
    const entries = plan.groups
      .filter((group) => !maxed(mainTrack(group)))
      .map((group) => {
        const source = bestSource(group, budget);
        return {
          group,
          cap: source
            ? Math.min(budget, (checkIns * source.runSeconds) / 3_600)
            : 0,
          rate: source ? xpPerHour(source, "CHARACTER") : 0,
          hours: 0,
        };
      });
    for (const entry of entries) {
      if (entry.cap === 0 && !blocked.has(entry.group)) {
        blocked.add(entry.group);
        result.blocked.push({ group: entry.group, day });
      }
    }
    let remaining = budget;
    if (plan.strategy === "fastest") {
      for (const entry of [...entries].sort((a, b) => b.rate - a.rate)) {
        entry.hours = Math.min(entry.cap, remaining);
        remaining -= entry.hours;
      }
    } else {
      // Equal shares; what a capped group can't use goes to the others.
      const byCap = [...entries].sort((a, b) => a.cap - b.cap);
      byCap.forEach((entry, index) => {
        entry.hours = Math.min(entry.cap, remaining / (byCap.length - index));
        remaining -= entry.hours;
      });
    }
    return entries.filter((entry) => entry.hours > 0);
  }

  for (let day = 0; day < days; day += 1) {
    let budget = hoursPerDay;
    if (plan.quests) awardQuests(day);
    // Crops take hours to grow, so a day's harvests pay out as it ends; the
    // harvesting time still comes out of the day.
    const garden = plan.garden && !maxed("GARDENING") ? gardenPlan(content, options, checkIns) : null;
    if (garden) {
      const harvest = Math.min(budget, garden.activeHoursPerDay);
      result.hoursByGroup.GARDEN = (result.hoursByGroup.GARDEN ?? 0) + harvest;
      result.playedHours += harvest;
      budget -= harvest;
    }
    let offset = 0;
    let used = 0;
    for (const entry of allocate(budget, day)) {
      const spent = advance(entry.group, entry.hours, day, offset);
      offset += spent;
      used += spent;
    }
    if (garden) {
      grant("GARDENING", garden.xpPerDay, day + 1);
      grant("CHARACTER", garden.xpPerDay, day + 1);
      credit("GARDEN", garden.xpPerDay);
    }
    result.idleHours += budget - used;
    for (const track of TRACKS) levelAtDay[track].push(level[track]);
  }

  return { ...result, levelAtDay, reachedDay, reachedHours };
}

/** Day a track reached a level in a journey, or null when it never did. */
export function dayReached(result: JourneyResult, track: Track, level: number) {
  const value = result.reachedDay[track][level];
  return value === undefined || Number.isNaN(value) ? null : value;
}

/** The tracks a journey actually levelled, character first. */
export function trainedTracks(result: JourneyResult): Track[] {
  return TRACKS.filter(
    (track) => track === "CHARACTER" || result.levelAtDay[track].at(-1)! > 1,
  );
}
