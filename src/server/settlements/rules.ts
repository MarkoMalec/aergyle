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

/** A rare find is only for sale inside its window; other offers always are. */
export function isOfferAvailable(
  offer: { availableFrom: Date | null; availableUntil: Date | null },
  now = new Date(),
) {
  return (
    (!offer.availableFrom || offer.availableFrom <= now) &&
    (!offer.availableUntil || offer.availableUntil > now)
  );
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
