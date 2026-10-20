/**
 * The rules for public player profiles, shared by the server and the browser.
 * Tuning any of these is a one-line change here.
 */

/** Characters a profile bio may hold. */
export const MAX_BIO_LENGTH = 300;

/** Characters a single profile comment may hold. */
export const MAX_COMMENT_LENGTH = 500;

/** Top-level comments a page of a profile's comments holds. */
export const COMMENTS_PAGE_SIZE = 10;

/** Comments (and replies) one player may post per minute. */
export const COMMENTS_PER_MINUTE = 6;

/** A player counts as online this long after the game last heard from them. */
export const ONLINE_WINDOW_MS = 3 * 60_000;

/** Days the profile's activity charts can look back. */
export const ACTIVITY_RANGES = [7, 30] as const;
export type ActivityRange = (typeof ACTIVITY_RANGES)[number];

/** Shown for a player who never set a name. */
export const UNNAMED_PLAYER = "Wayfarer";

export function playerName(name: string | null | undefined) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNNAMED_PLAYER;
}

/**
 * The name as it appears in the profile URL: spaces become hyphens, so
 * "Test name" is /@Test-name. Names that only differ by a space or a hyphen
 * can't both exist (see ~/server/players/names).
 */
export function playerTag(name: string) {
  return name.trim().replace(/ /g, "-");
}

export function playerProfileHref(name: string) {
  return `/@${encodeURIComponent(playerTag(name))}`;
}

export function isOnline(lastOnline: string | Date, now = Date.now()) {
  const at = new Date(lastOnline).getTime();
  return Number.isFinite(at) && now - at < ONLINE_WINDOW_MS;
}

/** "3 years, 2 months", "5 months", "12 days", "Today". */
export function accountAge(createdAt: string | Date, now = new Date()) {
  const start = new Date(createdAt);
  let months =
    (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - start.getUTCMonth());
  if (now.getUTCDate() < start.getUTCDate()) months -= 1;

  const plural = (count: number, unit: string) =>
    `${count} ${unit}${count === 1 ? "" : "s"}`;

  if (months >= 12) {
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest > 0
      ? `${plural(years, "year")}, ${plural(rest, "month")}`
      : plural(years, "year");
  }
  if (months >= 1) return plural(months, "month");

  const days = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return days >= 1 ? plural(days, "day") : "Today";
}
