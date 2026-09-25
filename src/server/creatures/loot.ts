import type { Prisma } from "~/generated/prisma/client";
import { ItemRarity } from "~/generated/prisma/enums";
import {
  calculateExpeditionEffectiveFindChance,
  type ExpeditionRewardModifiers,
  finiteNumber,
} from "~/server/expeditions/rewards";
import { rollInclusive } from "~/server/expeditions/random";

// Creature drop-table rules shared by Hunting and dungeons. Pure and
// client-safe so the admin simulators can run the production rules.

export type CreatureDropPoolEntry = {
  dropId: number;
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  baseChance: number;
  minQuantity: number;
  maxQuantity: number;
};

export type CreatureLootReward = {
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

/** The drop columns `buildCreatureDropPool` reads. */
export const CREATURE_DROP_SELECT = {
  id: true,
  baseChance: true,
  minQuantity: true,
  maxQuantity: true,
  requiredLevel: true,
  item: { select: { id: true, name: true, sprite: true, rarity: true } },
} satisfies Prisma.CreatureDropSelect;

type DropRow = {
  id: number;
  baseChance: number;
  minQuantity: number;
  maxQuantity: number;
  requiredLevel: number;
  item: {
    id: number;
    name: string;
    sprite: string;
    rarity: ItemRarity;
  };
};

export function isObtainableDrop(
  drop: Pick<
    CreatureDropPoolEntry,
    "baseChance" | "minQuantity" | "maxQuantity"
  >,
) {
  return (
    drop.baseChance > 0 &&
    drop.minQuantity > 0 &&
    drop.maxQuantity >= drop.minQuantity
  );
}

/** Snapshot the enabled drops a character of `level` can obtain. */
export function buildCreatureDropPool(
  drops: readonly DropRow[],
  level: number,
): CreatureDropPoolEntry[] {
  return drops
    .filter((drop) => drop.requiredLevel <= level && isObtainableDrop(drop))
    .map((drop) => ({
      dropId: drop.id,
      itemId: drop.item.id,
      name: drop.item.name,
      sprite: drop.item.sprite,
      rarity: drop.item.rarity,
      baseChance: Math.min(1, drop.baseChance),
      minQuantity: drop.minQuantity,
      maxQuantity: drop.maxQuantity,
    }));
}

/** Aggregates rewards by item, preserving first-found order. */
export function createLootTally() {
  const entries = new Map<number, CreatureLootReward>();
  return {
    add(drop: CreatureDropPoolEntry, quantity: number) {
      const existing = entries.get(drop.itemId);
      if (existing) {
        existing.quantity += quantity;
        return;
      }
      entries.set(drop.itemId, {
        itemId: drop.itemId,
        name: drop.name,
        sprite: drop.sprite,
        rarity: drop.rarity,
        quantity,
      });
    },
    get size() {
      return entries.size;
    },
    rewards(): CreatureLootReward[] {
      return [...entries.values()].map((reward) => ({ ...reward }));
    },
  };
}

export type LootTally = ReturnType<typeof createLootTally>;

export function rollDropQuantity(
  drop: CreatureDropPoolEntry,
  quantityScale: number,
  random: () => number,
) {
  return Math.max(
    1,
    Math.round(
      rollInclusive(drop.minQuantity, drop.maxQuantity, random) * quantityScale,
    ),
  );
}

/** Rolls every drop of one defeated creature independently. */
export function rollCreatureDrops(
  drops: readonly CreatureDropPoolEntry[],
  modifiers: ExpeditionRewardModifiers,
  random: () => number,
  tally: LootTally,
) {
  for (const drop of drops) {
    if (!isObtainableDrop(drop)) continue;
    const chance = calculateExpeditionEffectiveFindChance(
      drop.baseChance,
      modifiers.findModifierPercent,
    );
    if (random() >= chance) continue;
    tally.add(drop, rollDropQuantity(drop, modifiers.quantityScale, random));
  }
}

function isRarity(value: unknown): value is ItemRarity {
  return Object.values(ItemRarity).includes(value as ItemRarity);
}

export function parseCreatureDropPool(value: unknown): CreatureDropPoolEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const drop = entry as Record<string, unknown>;
    if (
      typeof drop.dropId !== "number" ||
      typeof drop.itemId !== "number" ||
      typeof drop.name !== "string" ||
      typeof drop.sprite !== "string" ||
      !isRarity(drop.rarity)
    ) {
      return [];
    }
    return [
      {
        dropId: drop.dropId,
        itemId: drop.itemId,
        name: drop.name,
        sprite: drop.sprite,
        rarity: drop.rarity,
        baseChance: finiteNumber(drop.baseChance),
        minQuantity: Math.max(1, Math.floor(finiteNumber(drop.minQuantity, 1))),
        maxQuantity: Math.max(1, Math.floor(finiteNumber(drop.maxQuantity, 1))),
      },
    ];
  });
}

export function parseLootRewards(value: unknown): CreatureLootReward[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    if (
      typeof row.itemId !== "number" ||
      typeof row.name !== "string" ||
      typeof row.sprite !== "string" ||
      typeof row.quantity !== "number" ||
      !isRarity(row.rarity)
    ) {
      return [];
    }
    return [
      {
        itemId: row.itemId,
        name: row.name,
        sprite: row.sprite,
        rarity: row.rarity,
        quantity: Math.max(1, Math.floor(row.quantity)),
      },
    ];
  });
}
