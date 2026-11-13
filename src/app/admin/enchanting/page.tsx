import React from "react";
import { prisma } from "~/lib/prisma";
import { EnchantingForm } from "~/components/admin/enchanting/EnchantingForm";
import { EnchantOverridesEditor } from "~/components/admin/enchanting/EnchantOverridesEditor";
import { requireAdminPageAccess } from "~/server/admin/auth";
import {
  defaultEnchantLevel,
  enchantKindOf,
  enchantLevelsFor,
  EnchantKind,
} from "~/game/enchanting";
import { loadEnchantGlobals } from "~/server/enchanting/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEnchantingPage() {
  await requireAdminPageAccess();
  const [globals, saved, overrides, items] = await Promise.all([
    loadEnchantGlobals(),
    prisma.enchantLevelConfig.findMany({
      include: { materials: { select: { itemId: true, quantity: true } } },
    }),
    prisma.itemEnchantChanceOverride.findMany({
      orderBy: [{ itemId: "asc" }, { level: "asc" }],
    }),
    prisma.item.findMany({
      select: { id: true, name: true, sprite: true, equipTo: true, stackable: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const savedByKey = new Map(saved.map((row) => [`${row.kind}:${row.level}`, row]));
  const levels = Object.values(EnchantKind).flatMap((kind) =>
    enchantLevelsFor(kind).map((level) => {
      const row = savedByKey.get(`${kind}:${level}`);
      const values = row ?? { ...defaultEnchantLevel(kind, level), materials: [] };
      return {
        kind,
        level,
        saved: Boolean(row),
        successChance: values.successChance,
        goldCost: values.goldCost,
        statBonusPercent: values.statBonusPercent,
        dropOnFail: values.dropOnFail,
        materials: values.materials,
      };
    }),
  );

  const itemOptions = items.map((item) => ({
    id: item.id,
    name: item.name,
    image: item.sprite,
  }));
  const enchantable = items.flatMap((item) => {
    const kind = enchantKindOf(item);
    return kind ? [{ id: item.id, name: item.name, image: item.sprite, kind }] : [];
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enchanting</h1>
        <p className="text-sm text-white/70">
          Success chances, costs, materials and stat bonuses per enchant level.
          Levels without a saved row show the code defaults; saving writes every
          row.
        </p>
      </div>

      <EnchantingForm
        globals={globals}
        levels={levels}
        items={itemOptions}
      />
      <EnchantOverridesEditor
        enchantable={enchantable}
        initialOverrides={overrides.map((o) => ({
          itemId: o.itemId,
          level: o.level,
          successChance: o.successChance,
        }))}
      />
    </div>
  );
}
