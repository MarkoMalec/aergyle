import "server-only";

import {
  conversationPairKey,
  MAX_CONVERSATIONS,
  MAX_MESSAGES_PER_CONVERSATION,
  MAX_MESSAGE_LENGTH,
  systemPairKey,
  SYSTEM_SENDER_NAME,
} from "~/game/communication";
import { prisma } from "~/lib/prisma";

/**
 * Private messages. Every thread is one `Conversation` with one
 * `ConversationParticipant` row per side, so deleting is one-sided: the row is
 * hidden and the other player keeps theirs.
 *
 * A player keeps at most `MAX_CONVERSATIONS` visible threads. A thread that
 * arrives while they are full stays hidden but unread — "waiting" — and slides
 * in by itself as soon as they delete one.
 */

export type PlayerRef = {
  id: string | null;
  name: string;
  image: string | null;
};

export type ConversationSummary = {
  id: number;
  /** Written by the game rather than another player; cannot be replied to. */
  system: boolean;
  with: PlayerRef;
  preview: string;
  lastMessageAt: string;
  unread: boolean;
};

export type ConversationMessage = {
  id: number;
  body: string;
  createdAt: string;
  /** True when the player reading it wrote it. */
  mine: boolean;
  sender: string;
};

export type ConversationThread = {
  id: number;
  system: boolean;
  with: PlayerRef;
  messages: ConversationMessage[];
};

export type ConversationList = {
  conversations: ConversationSummary[];
  /** How many of the player's slots are taken, and how many there are. */
  used: number;
  limit: number;
  /** Threads held back because every slot is taken. */
  waiting: number;
};

const SYSTEM_PLAYER: PlayerRef = {
  id: null,
  name: SYSTEM_SENDER_NAME,
  image: null,
};

function countVisible(userId: string) {
  return prisma.conversationParticipant.count({
    where: { userId, hidden: false },
  });
}

export function countUnreadMessages(userId: string) {
  return prisma.conversationParticipant.count({
    where: { userId, hidden: false, unread: true },
  });
}

export function countWaitingConversations(userId: string) {
  return prisma.conversationParticipant.count({
    where: { userId, hidden: true, unread: true },
  });
}

/**
 * Slides waiting threads into whatever slots the player has free, newest
 * first. Runs whenever they look at their list or free a slot, so nothing has
 * to be let in by hand.
 */
async function promoteWaiting(userId: string) {
  const room = MAX_CONVERSATIONS - (await countVisible(userId));
  if (room <= 0) return;
  const waiting = await prisma.conversationParticipant.findMany({
    where: { userId, hidden: true, unread: true },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: room,
    select: { conversationId: true },
  });
  if (waiting.length === 0) return;
  await prisma.conversationParticipant.updateMany({
    where: {
      userId,
      conversationId: { in: waiting.map((r) => r.conversationId) },
    },
    data: { hidden: false },
  });
}

/** Everyone in the thread but the player reading it. */
const OTHER_SIDE = (userId: string) =>
  ({
    where: { userId: { not: userId } },
    select: { user: { select: { id: true, name: true, image: true } } },
  }) as const;

function otherPlayer(
  participants: {
    user: { id: string; name: string | null; image: string | null };
  }[],
  system: boolean,
): PlayerRef {
  const other = participants[0]?.user;
  if (system || !other) return SYSTEM_PLAYER;
  return { id: other.id, name: other.name ?? "Wayfarer", image: other.image };
}

/** The player's threads, newest first, with their slot count. */
export async function listConversations(
  userId: string,
): Promise<ConversationList> {
  await promoteWaiting(userId);

  const [rows, waiting] = await Promise.all([
    prisma.conversationParticipant.findMany({
      where: { userId, hidden: false },
      orderBy: { conversation: { lastMessageAt: "desc" } },
      select: {
        unread: true,
        clearedAt: true,
        conversation: {
          select: {
            id: true,
            system: true,
            lastMessageAt: true,
            participants: OTHER_SIDE(userId),
            messages: {
              orderBy: { id: "desc" },
              take: 1,
              select: { body: true, createdAt: true, senderId: true },
            },
          },
        },
      },
    }),
    countWaitingConversations(userId),
  ]);

  const conversations = rows.map(({ conversation, unread, clearedAt }) => {
    const last = conversation.messages[0];
    // Anything the player deleted stays out of their preview.
    const visible = last && (!clearedAt || last.createdAt > clearedAt);
    return {
      id: conversation.id,
      system: conversation.system,
      with: otherPlayer(conversation.participants, conversation.system),
      preview: visible
        ? `${last.senderId === userId ? "You: " : ""}${last.body}`
        : "No messages yet",
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      unread,
    } satisfies ConversationSummary;
  });

  return {
    conversations,
    used: conversations.length,
    limit: MAX_CONVERSATIONS,
    waiting,
  };
}

/** One thread, and the read mark that clears its dot. */
export async function getConversation(
  userId: string,
  conversationId: number,
): Promise<ConversationThread> {
  const row = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: {
      hidden: true,
      unread: true,
      clearedAt: true,
      conversation: {
        select: {
          id: true,
          system: true,
          participants: OTHER_SIDE(userId),
        },
      },
    },
  });
  if (!row || row.hidden) throw new Error("Conversation not found");

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(row.clearedAt ? { createdAt: { gt: row.clearedAt } } : {}),
    },
    orderBy: { id: "asc" },
    take: MAX_MESSAGES_PER_CONVERSATION,
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
      sender: { select: { name: true } },
    },
  });

  if (row.unread) {
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { unread: false },
    });
  }

  return {
    id: row.conversation.id,
    system: row.conversation.system,
    with: otherPlayer(row.conversation.participants, row.conversation.system),
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      mine: message.senderId === userId,
      sender: message.sender?.name ?? SYSTEM_SENDER_NAME,
    })),
  };
}

function cleanBody(body: string) {
  const text = body.trim();
  if (!text) throw new Error("Write something first");
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Messages are at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  return text;
}

/** The player on the other side of a thread the sender can still see. */
async function replyTarget(senderId: string, conversationId: number) {
  const row = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: senderId } },
    select: {
      hidden: true,
      conversation: {
        select: {
          system: true,
          participants: {
            where: { userId: { not: senderId } },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!row || row.hidden) throw new Error("Conversation not found");
  if (row.conversation.system) {
    throw new Error("You can't reply to system messages");
  }
  const recipientId = row.conversation.participants[0]?.userId;
  if (!recipientId) throw new Error("That player is no longer here");
  return recipientId;
}

/**
 * Writes a message, starting the thread if the two have never spoken. The
 * sender needs a free slot only when the thread is not already one of theirs.
 */
export async function sendMessage(params: {
  senderId: string;
  /** Reply in a thread the sender has, or start one with `recipientId`. */
  conversationId?: number;
  recipientId?: string;
  body: string;
}) {
  const body = cleanBody(params.body);
  const recipientId =
    params.conversationId !== undefined
      ? await replyTarget(params.senderId, params.conversationId)
      : params.recipientId;
  if (!recipientId) throw new Error("Choose who to write to");
  if (recipientId === params.senderId) {
    throw new Error("You can't message yourself");
  }

  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });
  if (!recipient) throw new Error("Player not found");

  const pairKey = conversationPairKey(params.senderId, recipient.id);
  const senderSide = await prisma.conversationParticipant.findFirst({
    where: { userId: params.senderId, conversation: { pairKey } },
    select: { hidden: true },
  });
  // Starting (or reopening) a thread takes one of the sender's own slots.
  if (
    (!senderSide || senderSide.hidden) &&
    (await countVisible(params.senderId)) >= MAX_CONVERSATIONS
  ) {
    throw new Error(
      `You can keep ${MAX_CONVERSATIONS} conversations. Delete one to start another.`,
    );
  }

  const now = new Date();
  const conversationId = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.upsert({
      where: { pairKey },
      create: {
        pairKey,
        lastMessageAt: now,
        // The recipient's side starts hidden and is let in below only if they
        // have a free slot, so a new thread can never push them past the limit.
        participants: {
          create: [
            { userId: params.senderId },
            { userId: recipient.id, hidden: true, unread: true },
          ],
        },
      },
      update: { lastMessageAt: now },
      select: { id: true },
    });
    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: params.senderId,
        body,
      },
    });
    // The sender always sees what they just wrote; anything they cleared
    // before stays cleared.
    await tx.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: params.senderId,
        },
      },
      data: { hidden: false, unread: false },
    });
    await tx.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: recipient.id,
        },
      },
      data: { unread: true },
    });
    return conversation.id;
  });

  // The recipient sees it now if they have room; otherwise it waits.
  await promoteWaiting(recipient.id);
  await trimMessages(conversationId);
  return { conversationId };
}

/** The game (or a moderator) writing to one player, in its own thread. */
export async function sendSystemMessage(userId: string, body: string) {
  const text = cleanBody(body);
  const now = new Date();
  const conversation = await prisma.conversation.upsert({
    where: { pairKey: systemPairKey(userId) },
    create: {
      pairKey: systemPairKey(userId),
      system: true,
      lastMessageAt: now,
      // Hidden until the slot check below lets it in, like any other thread.
      participants: { create: [{ userId, hidden: true, unread: true }] },
    },
    update: { lastMessageAt: now },
    select: { id: true },
  });
  await prisma.message.create({
    data: { conversationId: conversation.id, body: text },
  });
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId: conversation.id, userId },
    },
    data: { unread: true },
  });
  await promoteWaiting(userId);
  await trimMessages(conversation.id);
  return { conversationId: conversation.id };
}

/** Keeps a thread to its newest messages, so no pair can fill the table. */
async function trimMessages(conversationId: number) {
  const total = await prisma.message.count({ where: { conversationId } });
  if (total <= MAX_MESSAGES_PER_CONVERSATION) return;
  const stale = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { id: "asc" },
    take: total - MAX_MESSAGES_PER_CONVERSATION,
    select: { id: true },
  });
  await prisma.message.deleteMany({
    where: { id: { in: stale.map((row) => row.id) } },
  });
}

/**
 * Hides a thread for one player and frees their slot. The other side keeps
 * it; once nobody holds it any more, the thread and its messages go.
 */
export async function deleteConversation(
  userId: string,
  conversationId: number,
) {
  const mine = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { hidden: true },
  });
  if (!mine) throw new Error("Conversation not found");

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { hidden: true, unread: false, clearedAt: new Date() },
  });

  // Waiting threads still count as held, so one isn't thrown away unread.
  const held = await prisma.conversationParticipant.count({
    where: { conversationId, OR: [{ hidden: false }, { unread: true }] },
  });
  if (held === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } });
  }

  await promoteWaiting(userId);
  return { deleted: true };
}

/**
 * Copies the thread into a moderator's queue exactly as it stands, so neither
 * player can erase it afterwards. Reporting the same thread twice refreshes
 * the open report rather than filing another.
 */
export async function reportConversation(params: {
  reporterId: string;
  conversationId: number;
  reason?: string;
}) {
  const row = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: params.conversationId,
        userId: params.reporterId,
      },
    },
    select: {
      hidden: true,
      conversation: {
        select: {
          system: true,
          participants: {
            where: { userId: { not: params.reporterId } },
            select: { userId: true },
          },
        },
      },
    },
  });
  if (!row || row.hidden) throw new Error("Conversation not found");
  if (row.conversation.system) {
    throw new Error("System messages can't be reported");
  }

  // The whole thread, not just the part the reporter can still see.
  const messages = await prisma.message.findMany({
    where: { conversationId: params.conversationId },
    orderBy: { id: "asc" },
    take: MAX_MESSAGES_PER_CONVERSATION,
    select: {
      body: true,
      createdAt: true,
      sender: { select: { id: true, name: true } },
    },
  });
  const transcript = messages.map((message) => ({
    at: message.createdAt.toISOString(),
    senderId: message.sender?.id ?? null,
    sender: message.sender?.name ?? SYSTEM_SENDER_NAME,
    body: message.body,
  }));

  const reason = params.reason?.trim().slice(0, MAX_MESSAGE_LENGTH) ?? null;
  const open = await prisma.messageReport.findFirst({
    where: {
      conversationId: params.conversationId,
      reporterId: params.reporterId,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (open) {
    await prisma.messageReport.update({
      where: { id: open.id },
      data: { transcript, reason: reason ?? undefined },
    });
    return { reported: true, reportId: open.id };
  }

  const report = await prisma.messageReport.create({
    data: {
      conversationId: params.conversationId,
      reporterId: params.reporterId,
      reportedId: row.conversation.participants[0]?.userId ?? null,
      reason,
      transcript,
    },
    select: { id: true },
  });
  return { reported: true, reportId: report.id };
}

/** Players to write to, matched by name. */
export async function findPlayers(userId: string, query: string) {
  const term = query.trim();
  if (term.length < 2) return [];
  const players = await prisma.user.findMany({
    where: { name: { contains: term }, id: { not: userId } },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true, image: true },
  });
  return players.map(
    (player): PlayerRef => ({
      id: player.id,
      name: player.name ?? "Wayfarer",
      image: player.image,
    }),
  );
}
