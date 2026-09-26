import "server-only";

import { hash } from "bcryptjs";
import type { Prisma } from "~/generated/prisma/client";
import {
  ItemType,
  VocationalActionType,
  type ItemRarity,
  type ProgressionTrackType,
  type StatType,
  type XpActionType,
} from "~/generated/prisma/enums";
import { PASSWORD_BCRYPT_ROUNDS } from "~/lib/auth-rules";
import { prisma } from "~/lib/prisma";
import { saveSummaries } from "~/server/activitySummaries";
import { writeCharacterHealth } from "~/server/combat/health";
import { grantStackableItemToInventory } from "~/server/items/grantItem";
import { fitSlots } from "~/server/items/inventoryLayout";
import { lockInventory, type LockedInventory } from "~/server/items/inventoryLock";
import { getCharacterStatSnapshot } from "~/server/stats";
import { getTravelStatus } from "~/server/travel/service";
import { calculateInventoryCapacity } from "~/utils/inventoryCapacity";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "~/utils/inventorySlots";
import { getLevelCurve } from "~/utils/leveling";
import { getTrackCurve } from "~/utils/progression";
import type { AdminActivityKind } from "./players";
import {
  completedWindow,
  itemPlacement,
  LIVE_ITEM_STATUSES,
  resolveLevelEdit,
  withoutItem,
} from "./playerRules";

/**
 * Changes /admin makes to one player. Each goes through the same locks and
 * helpers the game uses, so an edit can't race a reward or a trade into a
 * broken inventory.
 */

type Tx = Prisma.TransactionClient;

export class PlayerEditError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function fail(status: number, message: string): never {
  throw new PlayerEditError(status, message);
}

async function requirePlayer(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) fail(404, "Player not found");
}

/** The stored bag, never cut shorter than the slots it already uses. */
function readSlots(inventory: LockedInventory) {
  const stored = normalizeInventorySlots(inventory.slots, null);
  return normalizeInventorySlots(
    inventory.slots,
    Math.max(inventory.maxSlots, stored.length),
  );
}

async function lockBag(tx: Tx, userId: string) {
  const inventory = await lockInventory(tx, userId);
  if (!inventory) fail(404, "This player has no inventory");
  return inventory;
}

/* ------------------------------------------------ account and character */

export async function updatePlayer(
  userId: string,
  patch: {
    name?: string;
    email?: string;
    password?: string;
    gold?: number;
    level?: number;
    experience?: bigint;
    locationId?: number | null;
    health?: number;
  },
) {
  await requirePlayer(userId);
  const data: Prisma.UserUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.email !== undefined) data.email = patch.email;
  if (patch.password !== undefined) {
    data.password = await hash(patch.password, PASSWORD_BCRYPT_ROUNDS);
  }
  if (patch.gold !== undefined) data.gold = patch.gold;
  if (patch.level !== undefined || patch.experience !== undefined) {
    const resolved = resolveLevelEdit(
      await getLevelCurve(),
      patch.experience !== undefined
        ? { experience: patch.experience }
        : { level: patch.level! },
    );
    data.level = resolved.level;
    data.experience = resolved.experience;
  }
  if (patch.locationId !== undefined) {
    data.currentLocation =
      patch.locationId === null
        ? { disconnect: true }
        : { connect: { id: patch.locationId } };
  }

  if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: userId }, data });
  }
  if (patch.health !== undefined) {
    // After any level change above, so "full" means the new maximum.
    const { finalStats } = await getCharacterStatSnapshot(userId);
    await writeCharacterHealth({
      userId,
      currentHealth: Math.min(patch.health, finalStats.health),
      at: new Date(),
    });
  }
}

/**
 * Removes the account and everything it owns. Market history the other side
 * of a trade still needs, and reports about the player, stay without it.
 */
export async function deletePlayer(userId: string) {
  await requirePlayer(userId);
  await prisma.$transaction(
    async (tx) => {
      const threads = await tx.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      });
      // These don't cascade from User.
      await tx.inventory.deleteMany({ where: { userId } });
      await tx.equipment.deleteMany({ where: { userId } });
      await tx.user_skills.deleteMany({ where: { user_id: userId } });
      await tx.xpTransaction.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      // Their system thread, and threads whose other side is gone too, have
      // nobody left to read them.
      await tx.conversation.deleteMany({
        where: {
          id: { in: threads.map((thread) => thread.conversationId) },
          participants: { none: {} },
        },
      });
    },
    { timeout: 30_000 },
  );
}

/* ------------------------------------------------------------------ items */

/**
 * Adds items to the player's bag, at most as many as fit. The bag first
 * grows to its current size, in case a stat edit raised it since the player
 * last opened their inventory.
 */
export async function grantItem(
  userId: string,
  grant: { itemId: number; rarity: ItemRarity; quantity: number },
) {
  await requirePlayer(userId);
  const capacity = await calculateInventoryCapacity(userId);
  return prisma.$transaction(
    async (tx) => {
      const inventory = await lockBag(tx, userId);
      const slots = readSlots(inventory);
      if (capacity > slots.length) {
        const grown = fitSlots(slots, capacity, { extend: true }).slots;
        await tx.inventory.update({
          where: { userId },
          data: { slots: slotsToInputJson(grown), maxSlots: grown.length },
        });
      }

      const result = await grantStackableItemToInventory({
        db: tx,
        userId,
        itemId: grant.itemId,
        rarity: grant.rarity,
        quantity: grant.quantity,
      });
      if (result.addedQuantity === 0) fail(409, "Their bag is full");
      return {
        added: result.addedQuantity,
        notAdded: result.remainingQuantity,
      };
    },
    { timeout: 30_000 },
  );
}

async function findLiveItem(tx: Tx, userId: string, userItemId: number) {
  const item = await tx.userItem.findFirst({
    where: {
      id: userItemId,
      userId,
      status: { in: [...LIVE_ITEM_STATUSES] },
    },
    select: {
      id: true,
      status: true,
      itemTemplate: { select: { stackable: true, maxStackSize: true } },
    },
  });
  if (!item) fail(404, "That item is gone. Reload the page.");
  return item;
}

export async function updateItem(
  userId: string,
  userItemId: number,
  patch: {
    quantity?: number;
    rarity?: ItemRarity;
    isTradeable?: boolean;
    modifiers?: Array<{ statType: StatType; value: number }>;
  },
) {
  await prisma.$transaction(async (tx) => {
    const item = await findLiveItem(tx, userId, userItemId);
    if (patch.quantity !== undefined) {
      const max = item.itemTemplate.stackable
        ? Math.max(1, item.itemTemplate.maxStackSize)
        : 1;
      if (patch.quantity > max) {
        fail(
          400,
          max === 1
            ? "This item doesn't stack; give more of it instead"
            : `A stack holds at most ${max}`,
        );
      }
    }
    await tx.userItem.update({
      where: { id: item.id },
      data: {
        quantity: patch.quantity,
        rarity: patch.rarity,
        isTradeable: patch.isTradeable,
      },
    });
    if (patch.modifiers) {
      await tx.userItemStatModifier.deleteMany({
        where: { userItemId: item.id },
      });
      const kept = patch.modifiers.filter((row) => row.value !== 0);
      if (kept.length > 0) {
        await tx.userItemStatModifier.createMany({
          data: kept.map((row) => ({ userItemId: item.id, ...row })),
        });
      }
    }
  });
}

async function readLayout(tx: Tx, userId: string) {
  const inventory = await lockBag(tx, userId);
  const equipment = await tx.equipment.findUnique({ where: { userId } });
  return {
    slots: readSlots(inventory),
    equipment: equipment ?? {},
    deleteSlotId: inventory.deleteSlotId,
  };
}

/** Takes an item out of every bag, equipment and delete slot pointing at it. */
async function detach(
  tx: Tx,
  userId: string,
  layout: Awaited<ReturnType<typeof readLayout>>,
  userItemId: number,
) {
  const next = withoutItem(layout, userItemId);
  if (next.slotsChanged || next.deleteSlotId !== layout.deleteSlotId) {
    await tx.inventory.update({
      where: { userId },
      data: {
        slots: slotsToInputJson(next.slots),
        deleteSlotId: next.deleteSlotId,
      },
    });
  }
  if (Object.keys(next.equipment).length > 0) {
    await tx.equipment.update({ where: { userId }, data: next.equipment });
  }
  return next;
}

export async function deleteItem(userId: string, userItemId: number) {
  await prisma.$transaction(async (tx) => {
    const layout = await readLayout(tx, userId);
    const item = await findLiveItem(tx, userId, userItemId);
    await detach(tx, userId, layout, item.id);
    // Stat modifiers cascade; bait references are cleared by the database.
    await tx.userItem.delete({ where: { id: item.id } });
  });
}

/**
 * Puts an item back in the bag from wherever it is: equipped, in storage,
 * listed on the market, in the delete slot, or lost outside every slot.
 */
export async function moveItemToBag(userId: string, userItemId: number) {
  await prisma.$transaction(async (tx) => {
    const layout = await readLayout(tx, userId);
    const item = await findLiveItem(tx, userId, userItemId);
    if (itemPlacement(item, layout).kind === "BAG") {
      fail(409, "It is already in their bag");
    }

    const next = withoutItem(layout, item.id);
    const free = next.slots.find((slot) => !slot.item);
    if (!free) fail(409, "Their bag is full");
    free.item = { id: item.id };

    await tx.inventory.update({
      where: { userId },
      data: {
        slots: slotsToInputJson(next.slots),
        deleteSlotId: next.deleteSlotId,
      },
    });
    if (Object.keys(next.equipment).length > 0) {
      await tx.equipment.update({ where: { userId }, data: next.equipment });
    }
    await tx.userItem.update({
      where: { id: item.id },
      data: {
        status: "IN_INVENTORY",
        listedPrice: null,
        listedAt: null,
        userStorageId: null,
      },
    });
  });
}

/* ------------------------------------------------------ stats and effects */

/** Replaces the character's own stat additions; zero removes one. */
export async function setStatBonuses(
  userId: string,
  stats: Array<{ statType: StatType; value: number }>,
) {
  await requirePlayer(userId);
  await prisma.$transaction(async (tx) => {
    await tx.characterBaseStat.deleteMany({ where: { userId } });
    const kept = stats.filter((row) => row.value !== 0);
    if (kept.length > 0) {
      await tx.characterBaseStat.createMany({
        data: kept.map((row) => ({ userId, ...row })),
      });
    }
  });
}

export async function setFoodEffect(
  userId: string,
  effect: { itemId: number; minutes: number },
) {
  await requirePlayer(userId);
  const now = new Date();
  const endsAt = new Date(now.getTime() + effect.minutes * 60_000);
  await prisma.userActiveFoodEffect.upsert({
    where: { userId },
    create: { userId, itemId: effect.itemId, startedAt: now, endsAt },
    update: { itemId: effect.itemId, startedAt: now, endsAt },
  });
}

export async function removeFoodEffect(userId: string) {
  await prisma.userActiveFoodEffect.deleteMany({ where: { userId } });
}

export async function addXpMultiplier(
  userId: string,
  multiplier: {
    name: string;
    multiplier: number;
    actionType: XpActionType | null;
    vocationalActionType: VocationalActionType | null;
    expiresAt: Date | null;
    usesRemaining: number | null;
    stackable: boolean;
  },
) {
  await requirePlayer(userId);
  await prisma.xpMultiplier.create({
    data: {
      userId,
      name: multiplier.name,
      multiplier: multiplier.multiplier,
      actionType: multiplier.actionType,
      // Only vocation XP can be narrowed to one vocation.
      vocationalActionType:
        multiplier.actionType === "VOCATION"
          ? multiplier.vocationalActionType
          : null,
      expiresAt: multiplier.expiresAt,
      usesRemaining: multiplier.usesRemaining,
      stackable: multiplier.stackable,
    },
  });
}

export async function removeXpMultiplier(userId: string, id: number) {
  await prisma.xpMultiplier.deleteMany({ where: { id, userId } });
}

/* ----------------------------------------------------------------- skills */

export async function setTrackProgress(
  userId: string,
  edit: {
    trackType: ProgressionTrackType;
    trackKey: string;
    level?: number;
    experience?: bigint;
    itemsGathered?: bigint;
    secondsSpent?: bigint;
  },
) {
  await requirePlayer(userId);
  const { trackType, trackKey } = edit;
  if (edit.level !== undefined || edit.experience !== undefined) {
    const resolved = resolveLevelEdit(
      await getTrackCurve(trackType),
      edit.experience !== undefined
        ? { experience: edit.experience }
        : { level: edit.level! },
    );
    await prisma.userTrackProgress.upsert({
      where: { userId_trackType_trackKey: { userId, trackType, trackKey } },
      create: { userId, trackType, trackKey, ...resolved },
      update: resolved,
    });
  }

  if (edit.itemsGathered !== undefined || edit.secondsSpent !== undefined) {
    const actionType = Object.values(VocationalActionType).find(
      (type) => type === trackKey,
    );
    if (trackType !== "SKILL" || !actionType) {
      fail(400, "Only skills keep lifetime totals");
    }
    const totals = {
      itemsGathered: edit.itemsGathered,
      secondsSpent: edit.secondsSpent,
    };
    await prisma.userSkillMetric.upsert({
      where: { userId_actionType: { userId, actionType } },
      create: { userId, actionType, ...totals },
      update: totals,
    });
  }
}

/** Back to level 1 with no XP, and no lifetime totals for a skill. */
export async function resetTrack(
  userId: string,
  track: { trackType: ProgressionTrackType; trackKey: string },
) {
  await prisma.userTrackProgress.deleteMany({ where: { userId, ...track } });
  if (track.trackType === "SKILL") {
    const actionType = Object.values(VocationalActionType).find(
      (type) => type === track.trackKey,
    );
    if (actionType) {
      await prisma.userSkillMetric.deleteMany({ where: { userId, actionType } });
    }
  }
}

/* ------------------------------------------------------------- activities */

async function activityWindow(userId: string, kind: AdminActivityKind) {
  const select = { startedAt: true, endsAt: true } as const;
  const claimed = { ...select, claimedAt: true } as const;
  switch (kind) {
    case "travel":
      return prisma.userTravelActivity.findUnique({ where: { userId }, select });
    case "vocation":
      return prisma.userVocationalActivity.findUnique({ where: { userId }, select });
    case "garden":
      return prisma.userGardenHarvestActivity.findUnique({ where: { userId }, select });
    case "gathering":
      return prisma.userGatheringExpedition.findUnique({ where: { userId }, select: claimed });
    case "hunting":
      return prisma.userHuntingExpedition.findUnique({ where: { userId }, select: claimed });
    case "dungeon":
      return prisma.userDungeonRun.findUnique({ where: { userId }, select: claimed });
  }
}

/**
 * Skips the wait: the activity's window moves back so it ends now, and the
 * game pays it out as it would have (travel arrives, vocation units and
 * garden tiles settle, expeditions and dungeon runs are ready to claim).
 */
export async function completeActivity(userId: string, kind: AdminActivityKind) {
  const row = await activityWindow(userId, kind);
  if (!row) fail(404, "That activity already ended");
  if ("claimedAt" in row && row.claimedAt) {
    fail(409, "Already claimed; only its journal is left");
  }
  const data = completedWindow(row, new Date());
  const where = { userId };
  switch (kind) {
    case "travel":
      await prisma.userTravelActivity.update({ where, data });
      // Arrive now rather than on the player's next status check.
      await getTravelStatus(userId);
      return;
    case "vocation":
      await prisma.userVocationalActivity.update({ where, data });
      return;
    case "garden":
      await prisma.userGardenHarvestActivity.update({ where, data });
      return;
    case "gathering":
      await prisma.userGatheringExpedition.update({ where, data });
      return;
    case "hunting":
      await prisma.userHuntingExpedition.update({ where, data });
      return;
    case "dungeon":
      await prisma.userDungeonRun.update({ where, data });
      return;
  }
}

/** Ends an activity with nothing paid out (a claimed journal is just cleared). */
export async function cancelActivity(userId: string, kind: AdminActivityKind) {
  const where = { userId };
  switch (kind) {
    case "travel":
      await prisma.userTravelActivity.deleteMany({ where });
      return;
    case "vocation":
      await prisma.userVocationalActivity.deleteMany({ where });
      return;
    case "garden":
      // The tiles stay planted.
      await prisma.userGardenHarvestActivity.deleteMany({ where });
      return;
    case "gathering":
      await prisma.userGatheringExpedition.deleteMany({ where });
      return;
    case "hunting":
      await prisma.userHuntingExpedition.deleteMany({ where });
      return;
    case "dungeon":
      await prisma.userDungeonRun.deleteMany({ where });
      return;
  }
}

const pickOne = <T>(list: T[]): T | undefined =>
  list[Math.floor(Math.random() * list.length)];

/**
 * Queues a sample "while you were away" summary, built from real game content,
 * for the player's next visit: a vocation session with level-ups, a garden
 * harvest cut short by a full bag, and a dungeon run waiting to be claimed.
 */
export async function queueDemoSummary(userId: string) {
  const [player, resources, crops, dungeon] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        level: true,
        trackProgress: {
          where: { trackType: "SKILL" },
          select: { trackKey: true, level: true },
        },
      },
    }),
    prisma.vocationalResource.findMany({
      select: {
        actionType: true,
        name: true,
        itemId: true,
        rarity: true,
        yieldPerUnit: true,
        xpPerUnit: true,
        defaultSeconds: true,
        item: { select: { name: true, sprite: true } },
      },
    }),
    prisma.item.findMany({
      where: { seedYieldedBy: { some: { itemType: ItemType.SEED } } },
      select: { id: true, name: true, sprite: true, rarity: true },
    }),
    prisma.dungeon.findFirst({ select: { name: true }, orderBy: { id: "asc" } }),
  ]);
  if (!player) fail(404, "Player not found");

  const skillLevel = (skill: VocationalActionType) =>
    player.trackProgress.find((track) => track.trackKey === skill)?.level ?? 1;
  // Ends on their real level where it can, and always shows a level-up.
  const rise = (level: number, by: number) => ({
    from: Math.max(level, by + 1) - by,
    to: Math.max(level, by + 1),
  });
  const character = rise(player.level, 1);
  const hoursAgo = (hours: number) =>
    new Date(Date.now() - hours * 3_600_000).toISOString();
  const summaries: Parameters<typeof saveSummaries>[1] = [];

  const resource = pickOne(resources);
  if (resource) {
    const units = Math.floor((8 * 3_600) / Math.max(1, resource.defaultSeconds));
    const xp = units * resource.xpPerUnit;
    summaries.push({
      kind: "VOCATION",
      skill: resource.actionType,
      title: resource.name,
      stopReason: "COMPLETED",
      startedAt: hoursAgo(8),
      items: [
        {
          itemId: resource.itemId,
          name: resource.item.name,
          sprite: resource.item.sprite,
          rarity: resource.rarity,
          quantity: units * resource.yieldPerUnit,
        },
      ],
      xp: { character: xp, skill: xp },
      levels: { character, skill: rise(skillLevel(resource.actionType), 2) },
    });
  }

  const harvest = crops.sort(() => Math.random() - 0.5).slice(0, 3);
  if (harvest.length > 0) {
    const gardening = skillLevel(VocationalActionType.GARDENING);
    summaries.push({
      kind: "GARDEN",
      skill: VocationalActionType.GARDENING,
      title: "Garden harvest",
      stopReason: "INVENTORY_FULL",
      startedAt: hoursAgo(0.75),
      items: harvest.map((crop, index) => ({
        itemId: crop.id,
        name: crop.name,
        sprite: crop.sprite,
        rarity: crop.rarity,
        quantity: 18 - index * 5,
      })),
      xp: { character: 240, skill: 240 },
      levels: {
        character: { from: character.to, to: character.to },
        skill: { from: gardening, to: gardening },
      },
    });
  }

  if (dungeon) summaries.push({ kind: "DUNGEON", title: dungeon.name });

  if (summaries.length === 0) {
    fail(409, "There is no game content to build a summary from yet");
  }
  await saveSummaries(userId, summaries);
}

export async function growGardenTile(userId: string, tileId: number) {
  await prisma.userGardenTile.updateMany({
    where: { id: tileId, userId },
    data: { readyAt: new Date() },
  });
}

export async function clearGardenTile(userId: string, tileId: number) {
  await prisma.userGardenTile.deleteMany({ where: { id: tileId, userId } });
}

/* ------------------------------------------------ quests, recipes, storage */

export async function setQuestCompleted(
  userId: string,
  userQuestId: number,
  completed: boolean,
) {
  await prisma.userQuest.updateMany({
    where: { id: userQuestId, userId },
    data: { completedAt: completed ? new Date() : null },
  });
}

/** Forgets the quest for that period, so the player can take it again. */
export async function deleteUserQuest(userId: string, userQuestId: number) {
  await prisma.userQuest.deleteMany({ where: { id: userQuestId, userId } });
}

export async function learnRecipe(userId: string, recipeItemId: number) {
  await requirePlayer(userId);
  const item = await prisma.item.findUnique({
    where: { id: recipeItemId },
    select: { itemType: true },
  });
  if (item?.itemType !== ItemType.RECIPE) fail(400, "That item is not a recipe");
  await prisma.userLearnedRecipe.upsert({
    where: { userId_recipeItemId: { userId, recipeItemId } },
    create: { userId, recipeItemId },
    update: {},
  });
}

export async function forgetRecipe(userId: string, recipeItemId: number) {
  await prisma.userLearnedRecipe.deleteMany({ where: { userId, recipeItemId } });
}

/** Rents a settlement storage for the player, free of charge. */
export async function grantStorage(userId: string, storageId: number) {
  await requirePlayer(userId);
  const existing = await prisma.userStorage.findUnique({
    where: { userId_storageId: { userId, storageId } },
    select: { id: true },
  });
  if (existing) fail(409, "They already rent that storage");
  await prisma.userStorage.create({ data: { userId, storageId } });
}

/** Ends a rental, and destroys everything kept in it. */
export async function removeStorage(userId: string, userStorageId: number) {
  await prisma.userStorage.deleteMany({ where: { id: userStorageId, userId } });
}

/* ----------------------------------------------------------------- market */

/** Cancels an open buy order, with or without returning its reserved gold. */
export async function cancelBuyOrder(
  userId: string,
  orderId: number,
  refund: boolean,
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.marketBuyOrder.findFirst({
      where: { id: orderId, userId, status: "OPEN" },
    });
    if (!order) fail(409, "That buy order is no longer open");
    const cancelled = await tx.marketBuyOrder.updateMany({
      where: {
        id: order.id,
        status: "OPEN",
        remainingQuantity: order.remainingQuantity,
      },
      data: { status: "CANCELLED", reservedGold: 0 },
    });
    if (cancelled.count !== 1) fail(409, "The order changed. Reload the page.");
    if (refund && Number(order.reservedGold) > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { gold: { increment: order.reservedGold } },
      });
    }
  });
}

/* ------------------------------------------------ notifications, messages */

export async function deleteNotifications(userId: string, id?: number) {
  await prisma.notification.deleteMany({
    where: id === undefined ? { userId } : { id, userId },
  });
}

async function requireThread(userId: string, conversationId: number) {
  const mine = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { conversationId: true },
  });
  if (!mine) fail(404, "That conversation is gone. Reload the page.");
}

/**
 * Deletes the whole thread, for both players. A report keeps its own copy
 * of the transcript.
 */
export async function deleteConversation(userId: string, conversationId: number) {
  await requireThread(userId, conversationId);
  await prisma.conversation.delete({ where: { id: conversationId } });
}

export async function deleteMessage(userId: string, messageId: number) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversationId: true },
  });
  if (!message) fail(404, "That message is gone. Reload the page.");
  await requireThread(userId, message.conversationId);
  await prisma.message.delete({ where: { id: messageId } });
}
