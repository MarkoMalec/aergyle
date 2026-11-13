import "server-only";

import { randomInt } from "node:crypto";
import type { Prisma } from "~/generated/prisma/client";
import type { ItemRarity } from "~/generated/prisma/enums";
import { formatGold } from "~/lib/marketplace";
import { prisma } from "~/lib/prisma";
import {
  EnchantKind,
  enchantChance,
  enchantGoldCost,
  enchantKindOf,
  enchantLabel,
  levelAfterFailure,
  nextEnchantLevel,
} from "~/game/enchanting";
import { getActivityRows } from "~/server/activity";
import {
  consumeInventoryItems,
  loadInventoryStacks,
  removeFromStack,
} from "~/server/items/consumeItems";
import { lockUser } from "~/server/userLock";
import { loadEnchantGlobals, loadEnchantLevel } from "./config";

type Db = typeof prisma | Prisma.TransactionClient;

const ITEM_SELECT = {
  id: true,
  userId: true,
  itemId: true,
  rarity: true,
  status: true,
  enchantLevel: true,
  itemTemplate: {
    select: {
      name: true,
      sprite: true,
      equipTo: true,
      stackable: true,
      requiredLevel: true,
    },
  },
} as const;

/** Everything one attempt needs, read with `db` (the transaction when attempting). */
async function loadAttempt(db: Db, userId: string, userItemId: number) {
  const item = await db.userItem.findUnique({
    where: { id: userItemId },
    select: ITEM_SELECT,
  });
  if (!item || item.userId !== userId) throw new Error("Item not found");

  const kind = enchantKindOf(item.itemTemplate);
  if (!kind) throw new Error("This item can't be enchanted");
  const target = nextEnchantLevel(kind, item.enchantLevel);

  const [globals, settings, override, user] = await Promise.all([
    loadEnchantGlobals(db),
    target ? loadEnchantLevel(kind, target, db) : null,
    target
      ? db.itemEnchantChanceOverride.findUnique({
          where: { itemId_level: { itemId: item.itemId, level: target } },
          select: { successChance: true },
        })
      : null,
    db.user.findUnique({ where: { id: userId }, select: { gold: true, enchantFailStack: true } }),
  ]);

  const failStack = user?.enchantFailStack ?? 0;
  const baseChance = override?.successChance ?? settings?.successChance ?? 0;
  return {
    item,
    kind,
    target,
    settings,
    failStack,
    chance: enchantChance(baseChance, failStack, globals),
    goldCost: settings
      ? enchantGoldCost(
          settings.goldCost,
          item.itemTemplate.requiredLevel,
          globals.levelCostDivisor,
        )
      : 0,
    gold: Number(user?.gold ?? 0),
  };
}

/** Copies of an accessory that can be sacrificed: same item, rarity and level. */
async function copyCandidates(
  db: Db,
  userId: string,
  item: { id: number; itemId: number; rarity: ItemRarity; enchantLevel: number },
) {
  const { stacks } = await loadInventoryStacks(db, userId, { lock: false });
  const ids = stacks
    .filter((s) => s.itemId === item.itemId && s.id !== item.id)
    .map((s) => s.id);
  if (ids.length === 0) return [];
  const rows = await db.userItem.findMany({
    where: {
      id: { in: ids },
      rarity: item.rarity,
      enchantLevel: item.enchantLevel,
      status: "IN_INVENTORY",
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** What the next attempt costs and risks, for the enchant dialog. */
export async function getEnchantPreview(userId: string, userItemId: number) {
  const a = await loadAttempt(prisma, userId, userItemId);
  const materialIds = a.settings?.materials.map((m) => m.itemId) ?? [];
  const [{ stacks }, materialItems, copies] = await Promise.all([
    loadInventoryStacks(prisma, userId, { lock: false }),
    prisma.item.findMany({
      where: { id: { in: materialIds } },
      select: { id: true, name: true, sprite: true, rarity: true },
    }),
    a.kind === EnchantKind.ACCESSORY
      ? copyCandidates(prisma, userId, a.item)
      : Promise.resolve([]),
  ]);
  const owned = (itemId: number) =>
    stacks
      .filter((s) => s.itemId === itemId)
      .reduce((sum, s) => sum + s.quantity, 0);

  return {
    userItemId: a.item.id,
    name: a.item.itemTemplate.name,
    sprite: a.item.itemTemplate.sprite,
    rarity: a.item.rarity,
    kind: a.kind,
    level: a.item.enchantLevel,
    label: enchantLabel(a.item.enchantLevel),
    target: a.target,
    targetLabel: a.target ? enchantLabel(a.target) : null,
    chance: a.chance,
    failStack: a.failStack,
    goldCost: a.goldCost,
    gold: a.gold,
    failure:
      a.kind === EnchantKind.ACCESSORY
        ? ("break" as const)
        : a.settings?.dropOnFail
          ? ("drop" as const)
          : ("keep" as const),
    materials: (a.settings?.materials ?? []).map((m) => {
      const item = materialItems.find((i) => i.id === m.itemId);
      return {
        itemId: m.itemId,
        name: item?.name ?? "Unknown item",
        sprite: item?.sprite ?? null,
        rarity: item?.rarity ?? null,
        quantity: m.quantity,
        owned: owned(m.itemId),
      };
    }),
    copyCandidateIds: copies,
  };
}

export type EnchantOutcome = "success" | "failed" | "dropped" | "broken";

/**
 * One enchant attempt. Gold, materials and an accessory's copy are always
 * spent; on failure gear keeps or drops a level, accessories break.
 */
export async function attemptEnchant(params: {
  userId: string;
  userItemId: number;
  copyUserItemId?: number | null;
}) {
  const { userId, userItemId } = params;

  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const rows = await getActivityRows(userId, undefined, tx);
    if (Object.values(rows).some(Boolean)) {
      throw new Error("You can't enchant while you're busy with an activity");
    }

    const a = await loadAttempt(tx, userId, userItemId);
    const { item, kind, target, settings } = a;
    if (!target || !settings) throw new Error("This item is fully enchanted");

    const isAccessory = kind === EnchantKind.ACCESSORY;
    const allowed = isAccessory ? ["IN_INVENTORY"] : ["IN_INVENTORY", "EQUIPPED"];
    if (!allowed.includes(item.status)) {
      throw new Error(
        isAccessory
          ? "Take the accessory off and keep it in your inventory to enchant it"
          : "The item must be in your inventory or equipped",
      );
    }
    if (isAccessory && item.status === "IN_INVENTORY") {
      const { stacks } = await loadInventoryStacks(tx, userId);
      if (!stacks.some((s) => s.id === item.id)) {
        throw new Error("That item is not in your inventory");
      }
    }

    let copyId: number | null = null;
    if (isAccessory) {
      copyId = params.copyUserItemId ?? null;
      const candidates = await copyCandidates(tx, userId, item);
      if (!copyId || !candidates.includes(copyId)) {
        throw new Error(
          "You need a second copy of this accessory at the same rarity and enchant level",
        );
      }
    }

    if (a.goldCost > 0) {
      const debit = await tx.user.updateMany({
        where: { id: userId, gold: { gte: a.goldCost } },
        data: { gold: { decrement: a.goldCost } },
      });
      if (debit.count !== 1) {
        throw new Error(`You need ${formatGold(a.goldCost)} gold for this attempt`);
      }
    }
    if (settings.materials.length > 0) {
      await consumeInventoryItems({ db: tx, userId, items: settings.materials });
    }
    if (copyId) {
      await removeFromStack({ db: tx, userId, userItemId: copyId, quantity: 1 });
    }

    // randomInt is uniform over [0, 1e6): chance 1 always succeeds, 0 never.
    const success = randomInt(1_000_000) < Math.round(a.chance * 1_000_000);

    let outcome: EnchantOutcome;
    let level = item.enchantLevel;
    if (success) {
      outcome = "success";
      level = target;
      await tx.user.update({ where: { id: userId }, data: { enchantFailStack: 0 } });
    } else {
      await tx.user.update({
        where: { id: userId },
        data: { enchantFailStack: { increment: 1 } },
      });
      if (isAccessory) {
        outcome = "broken";
        await removeFromStack({ db: tx, userId, userItemId: item.id, quantity: 1 });
      } else {
        level = levelAfterFailure(item.enchantLevel, settings.dropOnFail);
        outcome = level < item.enchantLevel ? "dropped" : "failed";
      }
    }

    if (outcome !== "broken" && level !== item.enchantLevel) {
      const written = await tx.userItem.updateMany({
        where: { id: item.id, enchantLevel: item.enchantLevel },
        data: { enchantLevel: level },
      });
      if (written.count !== 1) throw new Error("The item changed. Please try again.");
    }

    return {
      outcome,
      level,
      label: enchantLabel(level),
      name: item.itemTemplate.name,
      goldSpent: a.goldCost,
      gold: a.gold - a.goldCost,
    };
  });
}
