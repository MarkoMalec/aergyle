import "server-only";

import {
  COMMENTS_PAGE_SIZE,
  MAX_COMMENT_LENGTH,
  playerName,
  playerProfileHref,
} from "~/game/players";
import { prisma } from "~/lib/prisma";
import { notify } from "~/server/communication";
import type { PlayerRef } from "~/server/communication";

/** A refusal whose message is safe to show the player. */
export class ProfileCommentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type ProfileCommentView = {
  id: number;
  author: PlayerRef & { id: string };
  body: string;
  createdAt: string;
  /** The viewer wrote it or owns the profile. */
  canDelete: boolean;
  /** Someone else wrote it. */
  canReport: boolean;
  /** Oldest first; always empty on a reply. */
  replies: ProfileCommentView[];
};

export type ProfileCommentPage = {
  comments: ProfileCommentView[];
  /** Pass back as `cursor` for the next page; null on the last one. */
  nextCursor: number | null;
  /** Comments and replies on the whole profile. */
  total: number;
};

/** Replies one thread shows; a busier thread keeps its newest. */
const REPLIES_SHOWN = 50;

const AUTHOR_SELECT = {
  select: { id: true, name: true, image: true },
} as const;

type CommentRow = {
  id: number;
  profileId: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string | null; image: string | null };
};

function toView(
  row: CommentRow,
  viewerId: string,
  replies: CommentRow[] = [],
): ProfileCommentView {
  return {
    id: row.id,
    author: {
      id: row.author.id,
      name: playerName(row.author.name),
      image: row.author.image,
    },
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    canDelete: row.author.id === viewerId || row.profileId === viewerId,
    canReport: row.author.id !== viewerId,
    replies: replies.map((reply) => toView(reply, viewerId)),
  };
}

/** One page of a profile's comments, newest thread first. */
export async function listProfileComments(params: {
  viewerId: string;
  profileId: string;
  cursor?: number | null;
}): Promise<ProfileCommentPage> {
  const [rows, total] = await Promise.all([
    prisma.profileComment.findMany({
      where: {
        profileId: params.profileId,
        parentId: null,
        ...(params.cursor ? { id: { lt: params.cursor } } : {}),
      },
      orderBy: { id: "desc" },
      take: COMMENTS_PAGE_SIZE + 1,
      select: {
        id: true,
        profileId: true,
        body: true,
        createdAt: true,
        author: AUTHOR_SELECT,
        replies: {
          orderBy: { id: "desc" },
          take: REPLIES_SHOWN,
          select: {
            id: true,
            profileId: true,
            body: true,
            createdAt: true,
            author: AUTHOR_SELECT,
          },
        },
      },
    }),
    prisma.profileComment.count({ where: { profileId: params.profileId } }),
  ]);

  const page = rows.slice(0, COMMENTS_PAGE_SIZE);
  return {
    comments: page.map((row) =>
      toView(row, params.viewerId, [...row.replies].reverse()),
    ),
    nextCursor:
      rows.length > COMMENTS_PAGE_SIZE ? page[page.length - 1]!.id : null,
    total,
  };
}

function cleanBody(body: string) {
  // At most one blank line in a row, so a comment can't push the page apart.
  const text = body.trim().replace(/\n{3,}/g, "\n\n");
  if (!text) throw new ProfileCommentError("Write something first");
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new ProfileCommentError(
      `Comments are at most ${MAX_COMMENT_LENGTH} characters`,
    );
  }
  return text;
}

function snippet(text: string) {
  const line = text.replace(/\s+/g, " ");
  return line.length > 90 ? `${line.slice(0, 89)}…` : line;
}

/**
 * Posts a comment, or a reply when `parentId` is set. A reply to a reply joins
 * the same thread. The profile's owner and the replied-to author hear of it.
 */
export async function postProfileComment(params: {
  authorId: string;
  profileId: string;
  body: string;
  parentId?: number | null;
}): Promise<ProfileCommentView> {
  const body = cleanBody(params.body);

  const [profile, author, parent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.profileId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: params.authorId },
      select: { name: true },
    }),
    params.parentId
      ? prisma.profileComment.findUnique({
          where: { id: params.parentId },
          select: { id: true, profileId: true, parentId: true, authorId: true },
        })
      : null,
  ]);
  if (!profile) throw new ProfileCommentError("Player not found", 404);
  if (params.parentId && (!parent || parent.profileId !== params.profileId)) {
    throw new ProfileCommentError("That comment is gone", 404);
  }

  const row = await prisma.profileComment.create({
    data: {
      profileId: params.profileId,
      authorId: params.authorId,
      parentId: parent ? parent.parentId ?? parent.id : null,
      body,
    },
    select: {
      id: true,
      profileId: true,
      body: true,
      createdAt: true,
      author: AUTHOR_SELECT,
    },
  });

  const name = playerName(author?.name);
  const href = `${playerProfileHref(profile.name)}#comment-${row.id}`;
  const told = new Set([params.authorId]);
  if (parent && !told.has(parent.authorId)) {
    told.add(parent.authorId);
    await notify(parent.authorId, {
      title: `${name} replied to your comment`,
      body: snippet(body),
      href,
    });
  }
  if (!told.has(params.profileId)) {
    await notify(params.profileId, {
      title: parent
        ? `${name} replied on your profile`
        : `${name} commented on your profile`,
      body: snippet(body),
      href,
    });
  }

  return toView(row, params.authorId);
}

/** Removes a comment (and its replies). Its author or the profile's owner may. */
export async function deleteProfileComment(params: {
  viewerId: string;
  commentId: number;
}) {
  const comment = await prisma.profileComment.findUnique({
    where: { id: params.commentId },
    select: { authorId: true, profileId: true },
  });
  if (!comment) throw new ProfileCommentError("That comment is gone", 404);
  if (
    comment.authorId !== params.viewerId &&
    comment.profileId !== params.viewerId
  ) {
    throw new ProfileCommentError("You can't remove this comment", 403);
  }
  await prisma.profileComment.delete({ where: { id: params.commentId } });
  return { deleted: true };
}

/**
 * Files the comment (with the comment it answers, for context) in the same
 * moderation queue as reported conversations. Reporting it again updates the
 * reporter's open report instead of filing another.
 */
export async function reportProfileComment(params: {
  reporterId: string;
  commentId: number;
  reason?: string;
}) {
  const comment = await prisma.profileComment.findUnique({
    where: { id: params.commentId },
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorId: true,
      author: { select: { name: true } },
      profile: { select: { name: true } },
      parent: {
        select: {
          body: true,
          createdAt: true,
          authorId: true,
          author: { select: { name: true } },
        },
      },
    },
  });
  if (!comment) throw new ProfileCommentError("That comment is gone", 404);
  if (comment.authorId === params.reporterId) {
    throw new ProfileCommentError("You can't report your own comment");
  }

  const line = (row: {
    body: string;
    createdAt: Date;
    authorId: string;
    author: { name: string | null };
  }) => ({
    at: row.createdAt.toISOString(),
    senderId: row.authorId,
    sender: playerName(row.author.name),
    body: row.body,
  });
  const transcript = [
    ...(comment.parent ? [line(comment.parent)] : []),
    line(comment),
  ];
  const reason =
    [
      `On ${playerName(comment.profile.name)}'s profile.`,
      params.reason?.trim().slice(0, MAX_COMMENT_LENGTH),
    ]
      .filter(Boolean)
      .join(" ") || null;

  const open = await prisma.messageReport.findFirst({
    where: {
      profileCommentId: comment.id,
      reporterId: params.reporterId,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (open) {
    await prisma.messageReport.update({
      where: { id: open.id },
      data: { transcript, reason },
    });
    return { reported: true };
  }

  await prisma.messageReport.create({
    data: {
      source: "PROFILE_COMMENT",
      profileCommentId: comment.id,
      reporterId: params.reporterId,
      reportedId: comment.authorId,
      reason,
      transcript,
    },
  });
  return { reported: true };
}
