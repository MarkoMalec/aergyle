/**
 * The rules for friends, shared by the server and the browser.
 * Tuning any of these is a one-line change here.
 */

/** Friends one player may have. */
export const MAX_FRIENDS = 100;

/** Requests a player may have waiting for an answer at once. */
export const MAX_PENDING_REQUESTS = 20;

/** After a decline, how long before the same player may ask again. */
export const FRIEND_REQUEST_COOLDOWN_MS = 3 * 24 * 60 * 60_000;

/** Players one search returns. */
export const FRIEND_SEARCH_RESULTS = 10;

/** Characters a search needs before it runs. */
export const FRIEND_SEARCH_MIN_LENGTH = 2;

/** Searches one player may run per minute. */
export const FRIEND_SEARCHES_PER_MINUTE = 12;

/** Adds, accepts, declines and removals one player may make per minute. */
export const FRIEND_ACTIONS_PER_MINUTE = 30;

/**
 * Where a player stands with another: friends, a request either way, or
 * nothing yet. "self" is the viewer's own profile.
 */
export const FRIEND_RELATIONS = [
  "self",
  "none",
  "outgoing",
  "incoming",
  "friends",
] as const;
export type FriendRelation = (typeof FRIEND_RELATIONS)[number];

/** A relation that something can be undone from: unfriend, cancel, decline. */
export type EndableFriendRelation = Extract<
  FriendRelation,
  "friends" | "outgoing" | "incoming"
>;

export function isEndableFriendRelation(
  value: unknown,
): value is EndableFriendRelation {
  return value === "friends" || value === "outgoing" || value === "incoming";
}

/** The one request row per pair, whichever of the two asks. */
export function friendPairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

/**
 * What the player typed into the search, as a name tag: trimmed, without a
 * leading "@", spaces as hyphens (the tag spelling). Null while too short.
 */
export function readFriendSearchTerm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const term = value.trim().replace(/^@+/, "").trim().replace(/\s+/g, "-");
  return term.length >= FRIEND_SEARCH_MIN_LENGTH ? term.slice(0, 64) : null;
}

/** "3 days", "5 hours", "1 hour": the wait before another request. */
export function cooldownLeft(ms: number) {
  const hours = Math.max(1, Math.ceil(ms / 3_600_000));
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.ceil(hours / 24);
  return `${days} days`;
}
