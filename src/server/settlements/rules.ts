import type { QuestObjectiveType, QuestRepeat } from "~/generated/prisma/enums";

const DAY_MS = 24 * 60 * 60 * 1_000;

function startOfUtcDay(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function startOfUtcWeek(now: Date) {
  const day = startOfUtcDay(now);
  // getUTCDay: Sunday = 0, so Monday is 0 days back and Sunday 6.
  return new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * DAY_MS);
}

/**
 * The period a quest is taken in. Daily quests reset at 00:00 UTC and weekly
 * quests on Monday at 00:00 UTC; one-time quests have a single period.
 */
export function questPeriod(repeat: QuestRepeat, now = new Date()) {
  if (repeat === "DAILY") return startOfUtcDay(now).toISOString().slice(0, 10);
  if (repeat === "WEEKLY") {
    return `W${startOfUtcWeek(now).toISOString().slice(0, 10)}`;
  }
  return "ONCE";
}

/** When the current period of a repeatable quest ends; null for one-time. */
export function questResetsAt(repeat: QuestRepeat, now = new Date()) {
  if (repeat === "DAILY")
    return new Date(startOfUtcDay(now).getTime() + DAY_MS);
  if (repeat === "WEEKLY") {
    return new Date(startOfUtcWeek(now).getTime() + 7 * DAY_MS);
  }
  return null;
}

export type QuestProgress = Record<string, number>;

type ObjectiveTarget = {
  type: QuestObjectiveType;
  itemId: number | null;
  creatureId: number | null;
  dungeonId: number | null;
  quantity: number;
};

/** Kill and clear counts are stored per target, not per objective row. */
export function progressKey(objective: ObjectiveTarget) {
  if (objective.type === "HUNT" && objective.creatureId) {
    return `creature:${objective.creatureId}`;
  }
  if (objective.type === "CLEAR" && objective.dungeonId) {
    return `dungeon:${objective.dungeonId}`;
  }
  return null;
}

export function parseQuestProgress(value: unknown): QuestProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, count]) =>
      typeof count === "number" && Number.isFinite(count) && count > 0
        ? [[key, Math.floor(count)]]
        : [],
    ),
  );
}

/**
 * Adds a claim's kills and dungeon clear to the objectives of one quest that
 * track them. Returns null when the claim is irrelevant to the quest.
 */
export function addQuestProgress(
  progress: QuestProgress,
  objectives: readonly ObjectiveTarget[],
  event: {
    kills: ReadonlyArray<{ creatureId: number; count: number }>;
    clearedDungeonId: number | null;
  },
): QuestProgress | null {
  const next = { ...progress };
  let changed = false;
  for (const objective of objectives) {
    const key = progressKey(objective);
    if (!key) continue;
    const gained =
      objective.type === "HUNT"
        ? event.kills
            .filter((kill) => kill.creatureId === objective.creatureId)
            .reduce((sum, kill) => sum + Math.max(0, kill.count), 0)
        : objective.dungeonId === event.clearedDungeonId
          ? 1
          : 0;
    if (gained > 0) {
      next[key] = (next[key] ?? 0) + gained;
      changed = true;
    }
  }
  return changed ? next : null;
}

/**
 * How far one objective is, capped at its quantity: deliveries count what the
 * player holds now, kills and clears what happened since accepting.
 */
export function objectiveProgress(
  objective: ObjectiveTarget,
  progress: QuestProgress,
  held: ReadonlyMap<number, number>,
) {
  const key = progressKey(objective);
  const current =
    objective.type === "DELIVER"
      ? held.get(objective.itemId ?? 0) ?? 0
      : key
        ? progress[key] ?? 0
        : 0;
  return Math.min(objective.quantity, current);
}

/**
 * A player's share of a community project (0–1): the average, over every
 * requirement, of the part of it they supplied. Each requirement weighs the
 * same however many items it asks for.
 */
export function contributionShare(
  requirements: ReadonlyArray<{ quantity: number; contributed: number }>,
) {
  if (requirements.length === 0) return 0;
  const total = requirements.reduce(
    (sum, requirement) =>
      sum +
      Math.min(1, requirement.contributed / Math.max(1, requirement.quantity)),
    0,
  );
  return total / requirements.length;
}

/**
 * How `quantity` of one item lands in a container: what each stack already
 * there takes (`topUps`) and the stacks it opens (`newStacks`, one per free
 * slot it uses). Null when it does not fit. Unstackable items always open a
 * stack of one per slot, like everywhere else in the game.
 */
export function planStackFill(params: {
  quantity: number;
  stackable: boolean;
  maxStackSize: number;
  targets: ReadonlyArray<{ id: number; quantity: number }>;
  freeSlots: number;
}) {
  const maxStackSize = params.stackable ? Math.max(1, params.maxStackSize) : 1;
  const topUps: Array<{ id: number; quantity: number }> = [];
  const newStacks: number[] = [];
  let remaining = Math.max(0, Math.floor(params.quantity));

  if (params.stackable) {
    for (const target of params.targets) {
      if (remaining <= 0) break;
      const room = Math.min(maxStackSize - target.quantity, remaining);
      if (room <= 0) continue;
      topUps.push({ id: target.id, quantity: room });
      remaining -= room;
    }
  }
  for (let slot = 0; slot < params.freeSlots && remaining > 0; slot += 1) {
    const size = Math.min(maxStackSize, remaining);
    newStacks.push(size);
    remaining -= size;
  }

  return remaining > 0 ? null : { topUps, newStacks };
}

// ============================================
// COMMUNITY PROJECTS
// ============================================

const HOUR_MS = 60 * 60 * 1_000;

export type ProjectRepeatMode = "ONCE" | "SCHEDULE" | "AFTER_COMPLETION";

export type ProjectTiming = {
  repeat: ProjectRepeatMode;
  repeatHours: number;
  maxRounds: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  round: number;
  /** Every stage of the current round reached. */
  completedAt: Date | null;
};

function periodMs(project: ProjectTiming) {
  return Math.max(1, project.repeatHours) * HOUR_MS;
}

/** A scheduled project counts its rounds from startsAt, else from creation. */
function scheduleAnchor(project: ProjectTiming) {
  return (project.startsAt ?? project.createdAt).getTime();
}

/**
 * The round that should be running at `now`, or null when the stored round
 * is still current. Rounds only move forward, so settling one is idempotent.
 */
export function dueRound(
  project: ProjectTiming,
  now = new Date(),
): { round: number; startedAt: Date } | null {
  const period = periodMs(project);
  if (project.repeat === "SCHEDULE") {
    const anchor = scheduleAnchor(project);
    if (now.getTime() < anchor) return null;
    let index = Math.floor((now.getTime() - anchor) / period);
    if (project.maxRounds) index = Math.min(index, project.maxRounds - 1);
    return index + 1 > project.round
      ? { round: index + 1, startedAt: new Date(anchor + index * period) }
      : null;
  }
  if (project.repeat === "AFTER_COMPLETION" && project.completedAt) {
    if (project.maxRounds && project.round >= project.maxRounds) return null;
    const opens = project.completedAt.getTime() + period;
    return now.getTime() >= opens
      ? { round: project.round + 1, startedAt: new Date(opens) }
      : null;
  }
  return null;
}

/**
 * Where a project stands for players:
 * - upcoming: before startsAt
 * - open: taking contributions until `until` (null: no deadline)
 * - waiting: this round is finished; the next opens at `until`
 * - done: finished for good
 * - ended: closed without being finished
 */
export type ProjectPhase = "upcoming" | "open" | "waiting" | "done" | "ended";

export function projectPhase(
  project: ProjectTiming,
  now = new Date(),
): { phase: ProjectPhase; until: Date | null } {
  const t = now.getTime();
  const finished = project.completedAt !== null;
  const closed = (until: Date | null) =>
    project.endsAt && (until === null || until >= project.endsAt)
      ? project.endsAt
      : until;
  if (project.startsAt && t < project.startsAt.getTime()) {
    return { phase: "upcoming", until: project.startsAt };
  }
  if (project.endsAt && t >= project.endsAt.getTime()) {
    return { phase: finished ? "done" : "ended", until: null };
  }
  const lastRound = Boolean(
    project.maxRounds && project.round >= project.maxRounds,
  );
  if (project.repeat === "SCHEDULE") {
    const roundEnd = new Date(
      scheduleAnchor(project) + project.round * periodMs(project),
    );
    if (lastRound && t >= roundEnd.getTime()) {
      return { phase: finished ? "done" : "ended", until: null };
    }
    if (finished) {
      return lastRound
        ? { phase: "done", until: null }
        : { phase: "waiting", until: closed(roundEnd) };
    }
    return { phase: "open", until: closed(roundEnd) };
  }
  if (project.repeat === "AFTER_COMPLETION" && finished) {
    const opens = new Date(project.completedAt!.getTime() + periodMs(project));
    if (lastRound || (project.endsAt && opens >= project.endsAt)) {
      return { phase: "done", until: null };
    }
    return { phase: "waiting", until: opens };
  }
  if (finished) return { phase: "done", until: null };
  return { phase: "open", until: project.endsAt };
}

/** The most of one requirement a single player may supply in a round. */
export function playerContributionCap(
  quantity: number,
  maxSharePercent: number | null,
) {
  if (maxSharePercent === null) return quantity;
  return Math.max(1, Math.floor((quantity * maxSharePercent) / 100));
}

export type StageReward = {
  gold: number;
  xp: number;
  items: Array<{ itemId: number; quantity: number }>;
};

/**
 * What one contributor gets for a reached stage, from their share of it
 * (0–1). Null when they fall below the minimum share or the reward is empty.
 */
export function stageRewardFor(
  share: number,
  reward: StageReward,
  split: "FLAT" | "BY_SHARE",
  minSharePercent: number,
): StageReward | null {
  if (share <= 0 || share * 100 < minSharePercent) return null;
  const scale = split === "FLAT" ? 1 : Math.min(1, share);
  const result = {
    gold: Math.floor(reward.gold * scale * 100) / 100,
    xp: Math.floor(reward.xp * scale),
    items: reward.items
      .map((item) => ({
        itemId: item.itemId,
        quantity: Math.floor(item.quantity * scale),
      }))
      .filter((item) => item.quantity > 0),
  };
  return result.gold > 0 || result.xp > 0 || result.items.length > 0
    ? result
    : null;
}

export type ProjectEffectKind =
  | "SHOP_DISCOUNT"
  | "SELL_BONUS"
  | "STORAGE_SLOTS"
  | "TRAVEL_SPEED"
  | "QUEST_REWARD_BONUS";

/** Most an effect can add up to, however many stages stack it. */
export const PROJECT_EFFECT_CAPS: Record<ProjectEffectKind, number> = {
  SHOP_DISCOUNT: 90,
  SELL_BONUS: 500,
  STORAGE_SLOTS: 1_000,
  TRAVEL_SPEED: 90,
  QUEST_REWARD_BONUS: 1_000,
};

export type ProjectEffects = Record<ProjectEffectKind, number>;

/** Active effects add up per kind, each within its cap. */
export function sumProjectEffects(
  rows: ReadonlyArray<{ type: ProjectEffectKind; value: number }>,
): ProjectEffects {
  const total: ProjectEffects = {
    SHOP_DISCOUNT: 0,
    SELL_BONUS: 0,
    STORAGE_SLOTS: 0,
    TRAVEL_SPEED: 0,
    QUEST_REWARD_BONUS: 0,
  };
  for (const row of rows) total[row.type] += row.value;
  for (const kind of Object.keys(total) as ProjectEffectKind[]) {
    total[kind] = Math.min(PROJECT_EFFECT_CAPS[kind], Math.max(0, total[kind]));
  }
  total.STORAGE_SLOTS = Math.floor(total.STORAGE_SLOTS);
  return total;
}

/** A reward raised by a percent bonus; gold keeps cents, XP whole points. */
export function withBonus(value: number, bonusPercent: number, whole = false) {
  const raised = value * (1 + bonusPercent / 100);
  return whole ? Math.floor(raised) : Math.floor(raised * 100) / 100;
}
