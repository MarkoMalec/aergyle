/**
 * The rules for the leaderboard, shared by the server and the browser.
 * Tuning any of these is a one-line change here.
 */

/** How often the ranks are recomputed. */
export const LEADERBOARD_REFRESH_MS = 12 * 60 * 60_000;

/** Rows in the "Top characters" view. */
export const LEADERBOARD_TOP = 50;

/** Rows shown above and below the player in the "Your position" view. */
export const LEADERBOARD_AROUND = 5;

/** The board shown when the URL names none. */
export const DEFAULT_LEADERBOARD_BOARD = "character";

export const LEADERBOARD_VIEWS = [
  { value: "you", label: "Your Position" },
  { value: "top", label: `Top ${LEADERBOARD_TOP} Characters` },
] as const;
export type LeaderboardView = (typeof LEADERBOARD_VIEWS)[number]["value"];

export function readLeaderboardView(value: unknown): LeaderboardView {
  return value === "top" ? "top" : "you";
}

export type LeaderboardBoard = {
  /** The URL's ?board=, e.g. "character", "mining", "total". */
  key: string;
  /** Its name in the picker. */
  label: string;
  /** The ranked column's heading. */
  column: string;
  group: "Character" | "Skills" | "More";
  /** For skills: the name (the rail icon) and its painted icon, if any. */
  skill?: { name: string; icon: string | null };
};

export type LeaderboardRow = {
  rank: number;
  name: string;
  href: string;
  avatar: { src: string; backdrop: string };
  totalLevel: number;
  /** The ranked level: character, skill or total. */
  level: number;
  isViewer: boolean;
};
