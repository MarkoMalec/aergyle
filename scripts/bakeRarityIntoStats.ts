// One-off (2026-11-13): rarity stops changing stats.
//
// 1. Bakes every item's stats at its own rarity into its base stats, from
//    prisma/rebalance/enchant-scaling-plan.json (computed with the old
//    resolver), then neutralises the old rarity tables: multipliers 1, no rarity
//    unlocks/overrides, no negative flip. Code from before this change computes
//    the same numbers afterwards, so the live site keeps working until deploy.
// 2. Removes player items whose rarity differs from their item's rarity, after
//    writing them to prisma/rebalance/removed-user-items-<time>.json.
//
// Run after migration 20261113120000_enchant_stat_scaling and before
// 20261113130000_drop_rarity_stat_scaling. Full backup:
// prisma/rebalance/backup-before-enchant-scaling.json.
//
//   node --import tsx scripts/bakeRarityIntoStats.ts            (dry run)
//   node --import tsx scripts/bakeRarityIntoStats.ts --apply
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, type StatType } from "../src/generated/prisma/client";
import { withoutItem } from "../src/server/admin/playerRules";
import { lockInventory } from "../src/server/items/inventoryLock";
import {
  normalizeInventorySlots,
  slotsToInputJson,
} from "../src/utils/inventorySlots";
import { EQUIPMENT_SLOTS } from "../src/utils/itemEquipTo";

const apply = process.argv[2] === "--apply";
if (process.argv.length > 3 || (process.argv[2] && !apply)) {
  throw new Error(
    "Usage: node --import tsx scripts/bakeRarityIntoStats.ts [--apply]",
  );
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL),
});

type PlanItem = {
  itemId: number;
  name: string;
  stats: Array<{
    statType: StatType;
    old: number | null;
    new: number;
    maxValue: number | null;
  }>;
  tools: Array<{ actionType: string; old: number; new: number }>;
  columns: Record<string, number>;
};
const plan = JSON.parse(
  readFileSync("prisma/rebalance/enchant-scaling-plan.json", "utf8"),
) as { items: PlanItem[] };

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// The old multipliers are still there, so nothing was baked yet.
const multipliers = await prisma.$queryRaw<Array<{ n: bigint }>>`
  SELECT COUNT(*) AS n FROM RarityConfig WHERE statMultiplier <> 1`;
if (Number(multipliers[0]?.n ?? 0) === 0) {
  throw new Error(
    "Rarity multipliers are already 1: the bake has run. Nothing done.",
  );
}

// The plan must still describe the live items, or an admin edit would be lost.
const current = await prisma.item.findMany({
  where: { id: { in: plan.items.map((i) => i.itemId) } },
  select: { id: true, stats: true, toolEfficiencies: true },
});
const stale: string[] = [];
for (const item of plan.items) {
  const live = current.find((c) => c.id === item.itemId);
  const statsMatch =
    live &&
    live.stats.length === item.stats.filter((s) => s.old !== null).length &&
    item.stats.every(
      (s) =>
        s.old === null ||
        live.stats.some(
          (r) => r.statType === s.statType && same(r.value, s.old!),
        ),
    ) &&
    item.tools.every((t) =>
      live.toolEfficiencies.some(
        (r) => r.actionType === t.actionType && same(r.baseEfficiency, t.old),
      ),
    );
  if (!statsMatch) stale.push(item.name);
}
if (stale.length > 0) {
  throw new Error(`Items changed since the plan was made: ${stale.join(", ")}`);
}

const removed = (
  await prisma.userItem.findMany({
    include: {
      statModifiers: true,
      itemTemplate: { select: { rarity: true, name: true } },
    },
  })
).filter((u) => u.rarity !== u.itemTemplate.rarity);

console.log(
  `${plan.items.length} items to bake, ${removed.length} player items to remove ` +
    `(${new Set(removed.map((u) => u.userId)).size} players).`,
);
if (!apply) {
  console.log("Dry run. Pass --apply to write.");
  process.exit(0);
}

await prisma.$transaction(
  async (tx) => {
    for (const item of plan.items) {
      for (const stat of item.stats) {
        await tx.itemStat.upsert({
          where: {
            itemId_statType: { itemId: item.itemId, statType: stat.statType },
          },
          update: { value: stat.new },
          create: {
            itemId: item.itemId,
            statType: stat.statType,
            value: stat.new,
            maxValue: stat.maxValue,
          },
        });
      }
      for (const tool of item.tools) {
        await tx.toolEfficiency.updateMany({
          where: { itemId: item.itemId, actionType: tool.actionType as never },
          data: { baseEfficiency: tool.new },
        });
      }
      if (Object.keys(item.columns).length > 0) {
        await tx.item.update({
          where: { id: item.itemId },
          data: item.columns,
        });
      }
    }
    // The old tables stay until the drop migration; make them no-ops.
    await tx.$executeRawUnsafe("DELETE FROM ItemStatProgression");
    await tx.$executeRawUnsafe("DELETE FROM ItemStatRarityOverride");
    await tx.$executeRawUnsafe(
      "UPDATE Item SET flipNegativeStatsWithRarity = 0",
    );
    await tx.$executeRawUnsafe("UPDATE RarityConfig SET statMultiplier = 1");
  },
  { timeout: 120_000 },
);
console.log("Baked.");

writeFileSync(
  `prisma/rebalance/removed-user-items-${Date.now()}.json`,
  JSON.stringify(removed, null, 1),
);
for (const userId of new Set(removed.map((u) => u.userId))) {
  const ids = removed.filter((u) => u.userId === userId).map((u) => u.id);
  await prisma.$transaction(async (tx) => {
    // Locked like every inventory write, so a live request can't race it.
    const inventory = await lockInventory(tx, userId);
    const equipment = await tx.equipment.findUnique({ where: { userId } });
    let layout = {
      slots: inventory
        ? normalizeInventorySlots(
            inventory.slots,
            Math.max(
              inventory.maxSlots,
              normalizeInventorySlots(inventory.slots, null).length,
            ),
          )
        : [],
      equipment: equipment ?? {},
      deleteSlotId: inventory?.deleteSlotId ?? null,
    };
    const cleared: Record<string, null> = {};
    for (const id of ids) {
      const next = withoutItem(layout, id);
      Object.assign(cleared, next.equipment);
      layout = {
        ...layout,
        slots: next.slots,
        deleteSlotId: next.deleteSlotId,
      };
    }
    if (inventory) {
      await tx.inventory.update({
        where: { userId },
        data: {
          slots: slotsToInputJson(layout.slots),
          deleteSlotId: layout.deleteSlotId,
        },
      });
    }
    if (equipment && Object.keys(cleared).length > 0) {
      await tx.equipment.update({ where: { userId }, data: cleared });
    }
    // Stat modifiers cascade; bait references are cleared by the database.
    await tx.userItem.deleteMany({ where: { id: { in: ids }, userId } });
  });
}
console.log(`Removed ${removed.length} player items.`);

// Leftovers: nothing may still point at a removed item.
const ids = new Set(removed.map((u) => u.id));
const dangling = (await prisma.equipment.findMany()).filter((e) =>
  EQUIPMENT_SLOTS.some(({ dbField }) => ids.has(e[dbField] ?? -1)),
);
console.log(
  dangling.length === 0
    ? "No equipment points at a removed item."
    : `Check equipment of ${dangling.map((e) => e.userId).join(", ")}`,
);
await prisma.$disconnect();
