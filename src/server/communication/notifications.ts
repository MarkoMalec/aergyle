import "server-only";

import type {
  ItemRarity,
  NotificationCategory,
} from "~/generated/prisma/enums";
import {
  NOTIFICATIONS_KEPT,
  NOTIFICATIONS_PAGE_SIZE,
} from "~/game/communication";
import { prisma } from "~/lib/prisma";

export type NotificationView = {
  id: number;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string | null;
  item: { name: string; sprite: string; rarity: ItemRarity } | null;
  read: boolean;
  createdAt: string;
};

export type NotificationDraft = {
  category?: NotificationCategory;
  title: string;
  /** The line (or few) the player reads in the list. */
  body: string;
  /** Optional page the row opens inside the game, e.g. `/settlements/3`. */
  href?: string | null;
  /** Optional item drawn beside the note, e.g. the one a sale moved. */
  item?: { id: number; rarity: ItemRarity } | null;
};

/**
 * Puts a notification in one player's list. Call it from anywhere in the game
 * — a finished community project, a sale, a hit taken — and the bell picks it
 * up on its next check. Never throws: a notification must not fail the action
 * that caused it.
 */
export async function notify(userId: string, draft: NotificationDraft) {
  try {
    await prisma.notification.create({ data: { userId, ...normalize(draft) } });
    await pruneNotifications(userId);
  } catch (error) {
    console.error("Could not write notification:", error);
  }
}

/** The same note for several players, in one write. */
export async function notifyMany(userIds: string[], draft: NotificationDraft) {
  const recipients = [...new Set(userIds)];
  if (recipients.length === 0) return;
  try {
    const data = normalize(draft);
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({ userId, ...data })),
    });
  } catch (error) {
    console.error("Could not write notifications:", error);
  }
}

function normalize(draft: NotificationDraft) {
  return {
    category: draft.category ?? "GENERAL",
    title: draft.title.slice(0, 191),
    body: draft.body,
    href: draft.href?.slice(0, 191) ?? null,
    itemId: draft.item?.id ?? null,
    itemRarity: draft.item?.rarity ?? null,
  };
}

/**
 * Drops everything past the newest `NOTIFICATIONS_KEPT`, so a player's list
 * can't grow without end. Runs when they write or read their own list, which
 * keeps it off broadcast writes.
 */
async function pruneNotifications(userId: string) {
  const overflow = await prisma.notification.findMany({
    where: { userId },
    orderBy: { id: "desc" },
    skip: NOTIFICATIONS_KEPT,
    select: { id: true },
  });
  if (overflow.length === 0) return;
  await prisma.notification.deleteMany({
    where: { id: { in: overflow.map((row) => row.id) } },
  });
}

/**
 * A page of the player's notifications, newest first. `cursor` is the id of
 * the last row of the previous page.
 */
export async function listNotifications(
  userId: string,
  options: { category?: NotificationCategory; cursor?: number } = {},
) {
  await pruneNotifications(userId);
  const rows = await prisma.notification.findMany({
    where: {
      userId,
      ...(options.category ? { category: options.category } : {}),
      ...(options.cursor ? { id: { lt: options.cursor } } : {}),
    },
    orderBy: { id: "desc" },
    take: NOTIFICATIONS_PAGE_SIZE + 1,
    select: {
      id: true,
      category: true,
      title: true,
      body: true,
      href: true,
      itemRarity: true,
      item: { select: { name: true, sprite: true, rarity: true } },
      readAt: true,
      createdAt: true,
    },
  });

  const page = rows.slice(0, NOTIFICATIONS_PAGE_SIZE);
  return {
    notifications: page.map(
      (row): NotificationView => ({
        id: row.id,
        category: row.category,
        title: row.title,
        body: row.body,
        href: row.href,
        item: row.item
          ? {
              name: row.item.name,
              sprite: row.item.sprite,
              rarity: row.itemRarity ?? row.item.rarity,
            }
          : null,
        read: row.readAt !== null,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
    // Only a full page can have more behind it.
    nextCursor:
      rows.length > NOTIFICATIONS_PAGE_SIZE ? page.at(-1)?.id ?? null : null,
  };
}

/** Marks the given notifications read, or every unread one when none are given. */
export async function markNotificationsRead(userId: string, ids?: number[]) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
  return { marked: result.count };
}

/** Empties the player's list; theirs alone. */
export async function clearNotifications(userId: string) {
  const result = await prisma.notification.deleteMany({ where: { userId } });
  return { cleared: result.count };
}

export function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
