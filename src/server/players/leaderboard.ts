import "server-only";

import {
  DEFAULT_LEADERBOARD_BOARD,
  LEADERBOARD_AROUND,
  LEADERBOARD_REFRESH_MS,
  LEADERBOARD_TOP,
  type LeaderboardBoard,
  type LeaderboardRow,
  type LeaderboardView,
} from "~/game/leaderboard";
import { playerName, playerProfileHref } from "~/game/players";
import { prisma } from "~/lib/prisma";
import {
  DEFAULT_PLAYER_AVATAR,
  getPlayerAvatarBySrc,
} from "~/lib/player-avatars";
import { loadSkillArt } from "~/server/skills/art";
import { getGameSkills } from "~/server/skills/list";
import { getLevelCurve } from "~/utils/leveling";
import { getTrackCurve } from "~/utils/progression";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";
import { levelForTotalXp, refreshingCache } from "~/utils/xpCurve";

type RankedPlayer = {
  id: string;
  name: string;
  avatar: LeaderboardRow["avatar"];
  totalLevel: number;
  joinedAt: number;
};

/** A player's place on one board: higher level, then more XP, then the older account. */
type Entry = { player: number; level: number; xp: bigint };

type Snapshot = {
  updatedAt: Date;
  boards: LeaderboardBoard[];
  players: RankedPlayer[];
  /** Each board's entries, best first. */
  rankings: Map<string, Entry[]>;
};

/**
 * Every board, ranked in one pass over all players. Levels are derived from
 * XP, as on the profile, so a curve edit can't leave the two disagreeing.
 */
async function rankEveryone(): Promise<Snapshot> {
  const [skills, users, tracks, characterCurve, skillCurve, artFor] =
    await Promise.all([
      getGameSkills(),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          image: true,
          experience: true,
          createdAt: true,
        },
      }),
      prisma.userTrackProgress.findMany({
        where: { trackType: "SKILL" },
        select: { userId: true, trackKey: true, experience: true },
      }),
      getLevelCurve(),
      getTrackCurve("SKILL"),
      loadSkillArt(),
    ]);

  const skillBoards = skills
    .flatMap((skill) => {
      const trackKey = toVocationalActionTypeFromSkillName(skill.name);
      const key = skill.name.trim().toLowerCase().replace(/\s+/g, "-");
      return trackKey ? [{ ...skill, trackKey, key }] : [];
    })
    // The rail's order: vocations, then crafting.
    .sort(
      (a, b) =>
        Number(a.category === "CRAFTING") - Number(b.category === "CRAFTING") ||
        a.name.localeCompare(b.name),
    );

  const boards: LeaderboardBoard[] = [
    {
      key: DEFAULT_LEADERBOARD_BOARD,
      label: "Character Level",
      column: "Character Level",
      group: "Character",
    },
    ...skillBoards.map((skill) => ({
      key: skill.key,
      label: skill.name,
      column: `${skill.name} Level`,
      group: "Skills" as const,
      skill: { name: skill.name, icon: artFor(skill.name).icon },
    })),
    {
      key: "total",
      label: "Total Level",
      column: "Total Level",
      group: "More",
    },
  ];

  const playerIndex = new Map(users.map((user, index) => [user.id, index]));
  const boardOfTrack = new Map<string, number>(
    skillBoards.map((skill, board) => [skill.trackKey, board]),
  );
  const skillXp = skillBoards.map(() => new Map<number, bigint>());
  for (const track of tracks) {
    const player = playerIndex.get(track.userId);
    const board = boardOfTrack.get(track.trackKey);
    if (player !== undefined && board !== undefined) {
      skillXp[board]!.set(player, track.experience);
    }
  }

  const character: Entry[] = [];
  const total: Entry[] = [];
  const perSkill: Entry[][] = skillBoards.map(() => []);
  const players = users.map((user, player): RankedPlayer => {
    const avatar = getPlayerAvatarBySrc(user.image) ?? DEFAULT_PLAYER_AVATAR;
    character.push({
      player,
      level: levelForTotalXp(characterCurve, user.experience),
      xp: user.experience,
    });

    let totalLevel = 0;
    let totalXp = 0n;
    skillXp.forEach((xpByPlayer, board) => {
      const xp = xpByPlayer.get(player) ?? 0n;
      const level = levelForTotalXp(skillCurve, xp);
      perSkill[board]!.push({ player, level, xp });
      totalLevel += level;
      totalXp += xp;
    });
    total.push({ player, level: totalLevel, xp: totalXp });

    return {
      id: user.id,
      name: playerName(user.name),
      avatar: { src: avatar.src, backdrop: avatar.backdrop },
      totalLevel,
      joinedAt: user.createdAt.getTime(),
    };
  });

  const byRank = (a: Entry, b: Entry) =>
    b.level - a.level ||
    (a.xp === b.xp ? 0 : a.xp > b.xp ? -1 : 1) ||
    players[a.player]!.joinedAt - players[b.player]!.joinedAt;

  const rankings = new Map<string, Entry[]>([
    [DEFAULT_LEADERBOARD_BOARD, character.sort(byRank)],
    ["total", total.sort(byRank)],
  ]);
  skillBoards.forEach((skill, board) =>
    rankings.set(skill.key, perSkill[board]!.sort(byRank)),
  );

  return { updatedAt: new Date(), boards, players, rankings };
}

/**
 * Ranking every player is the expensive part, so it runs at most once per
 * refresh window and every visitor reads the same snapshot.
 */
const loadSnapshot = refreshingCache(rankEveryone, LEADERBOARD_REFRESH_MS);

export type Leaderboard = {
  boards: LeaderboardBoard[];
  board: LeaderboardBoard;
  rows: LeaderboardRow[];
  /** The viewer's rank on this board; null until the next refresh ranks them. */
  viewerRank: number | null;
  updatedAt: string;
};

/**
 * One board's rows: the top of it, or the viewer with the players just above
 * and below them. An unknown board falls back to the default one. With
 * `friendIds` only the viewer and those friends are ranked, so ranks count
 * within that group; null ranks everyone.
 */
export async function getLeaderboard(params: {
  board: string | undefined;
  view: LeaderboardView;
  viewerId: string;
  friendIds: string[] | null;
}): Promise<Leaderboard> {
  const snapshot = await loadSnapshot();
  const board =
    snapshot.boards.find((candidate) => candidate.key === params.board) ??
    snapshot.boards[0]!;
  let entries = snapshot.rankings.get(board.key) ?? [];
  if (params.friendIds) {
    const group = new Set([...params.friendIds, params.viewerId]);
    entries = entries.filter((entry) =>
      group.has(snapshot.players[entry.player]!.id),
    );
  }
  const viewerIndex = entries.findIndex(
    (entry) => snapshot.players[entry.player]!.id === params.viewerId,
  );

  let start = 0;
  let end = LEADERBOARD_TOP;
  if (params.view === "you" && viewerIndex >= 0) {
    const size = LEADERBOARD_AROUND * 2 + 1;
    start = Math.max(
      0,
      Math.min(viewerIndex - LEADERBOARD_AROUND, entries.length - size),
    );
    end = start + size;
  }

  return {
    boards: snapshot.boards,
    board,
    rows: entries.slice(start, end).map((entry, offset) => {
      const player = snapshot.players[entry.player]!;
      return {
        rank: start + offset + 1,
        name: player.name,
        href: playerProfileHref(player.name),
        avatar: player.avatar,
        totalLevel: player.totalLevel,
        level: entry.level,
        isViewer: player.id === params.viewerId,
      };
    }),
    viewerRank: viewerIndex >= 0 ? viewerIndex + 1 : null,
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
