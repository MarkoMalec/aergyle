import type { NotificationCategory } from "~/generated/prisma/enums";

/**
 * The rules both the server and the browser follow for notifications and
 * private messages. Tuning any of these is a one-line change here.
 */

/** Conversations a player may keep. A new one past this waits for a free slot. */
export const MAX_CONVERSATIONS = 10;

/** Messages kept per conversation; the oldest fall off after that. */
export const MAX_MESSAGES_PER_CONVERSATION = 100;

/** Characters a single message may hold. */
export const MAX_MESSAGE_LENGTH = 1000;

/** Notifications kept per player; older ones are pruned when they look. */
export const NOTIFICATIONS_KEPT = 50;

/** Notifications a page of the list holds. */
export const NOTIFICATIONS_PAGE_SIZE = 15;

/** How the game signs its own messages and system threads. */
export const SYSTEM_SENDER_NAME = "Aergyle";

export const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategory,
  string
> = {
  GENERAL: "General",
  SETTLEMENT: "Settlements",
  QUEST: "Quests",
  MARKET: "Marketplace",
  COMBAT: "Combat",
  SYSTEM: "System",
};

export const NOTIFICATION_CATEGORIES = Object.keys(
  NOTIFICATION_CATEGORY_LABELS,
) as NotificationCategory[];

export function isNotificationCategory(
  value: unknown,
): value is NotificationCategory {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(NOTIFICATION_CATEGORY_LABELS, value)
  );
}

/**
 * The one row per pair of players, whichever of the two writes first: their
 * ids sorted, so A→B and B→A land on the same conversation.
 */
export function conversationPairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

/** The game's own thread with one player; it has no second participant. */
export function systemPairKey(userId: string) {
  return `system|${userId}`;
}

/** "3 minutes ago", down to "Just now" and up to a plain date. */
export function timeAgo(value: string | Date) {
  const then = value instanceof Date ? value : new Date(value);
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "Just now";
  if (seconds < 3_600) return ago(seconds / 60, "minute");
  if (seconds < 86_400) return ago(seconds / 3_600, "hour");
  if (seconds < 604_800) return ago(seconds / 86_400, "day");
  return then.toLocaleDateString();
}

function ago(count: number, unit: string) {
  const whole = Math.floor(count);
  return `${whole} ${unit}${whole === 1 ? "" : "s"} ago`;
}
