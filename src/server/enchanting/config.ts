import "server-only";

import type { ItemEquipTo } from "~/generated/prisma/enums";
import type { PrismaClient } from "~/generated/prisma/client";
import { prisma } from "~/lib/prisma";
import {
  DEFAULT_ENCHANT_GLOBALS,
  defaultEnchantLevel,
  EnchantKind,
  enchantBonusTable,
  enchantKindOf,
  type EnchantGlobalSettings,
  type EnchantLevelSettings,
} from "~/game/enchanting";

type ConfigDb = Pick<PrismaClient, "enchantLevelConfig">;

/** A level's settings: the saved row, or the code default. */
export async function loadEnchantLevel(
  kind: EnchantKind,
  level: number,
  db: Pick<PrismaClient, "enchantLevelConfig"> = prisma,
): Promise<
  EnchantLevelSettings & { materials: { itemId: number; quantity: number }[] }
> {
  const row = await db.enchantLevelConfig.findUnique({
    where: { kind_level: { kind, level } },
    include: { materials: { select: { itemId: true, quantity: true } } },
  });
  return row ?? { ...defaultEnchantLevel(kind, level), materials: [] };
}

export async function loadEnchantGlobals(
  db: Pick<PrismaClient, "enchantConfig"> = prisma,
): Promise<EnchantGlobalSettings> {
  return (
    (await db.enchantConfig.findUnique({ where: { id: 1 } })) ??
    DEFAULT_ENCHANT_GLOBALS
  );
}

/**
 * The enchant bonus (percent) per item, for items already loaded. Reads the
 * same table as the admin grid; unenchanted items cost no query.
 */
export async function loadEnchantBonuses(
  items: ReadonlyArray<{
    enchantLevel?: number;
    itemTemplate: { equipTo: ItemEquipTo | null };
  }>,
  db: ConfigDb = prisma,
) {
  const table = items.some((item) => (item.enchantLevel ?? 0) > 0)
    ? await loadEnchantBonusTable(db)
    : null;

  return (item: (typeof items)[number]) => {
    const level = item.enchantLevel ?? 0;
    if (!table || level <= 0) return 0;
    const kind =
      enchantKindOf({ equipTo: item.itemTemplate.equipTo, stackable: false }) ??
      EnchantKind.GEAR;
    return table[kind][level] ?? 0;
  };
}

/** Every level's global stat bonus, for the item editor and balance tools. */
export async function loadEnchantBonusTable(db: ConfigDb = prisma) {
  return enchantBonusTable(
    await db.enchantLevelConfig.findMany({
      select: { kind: true, level: true, statBonusPercent: true },
    }),
  );
}
