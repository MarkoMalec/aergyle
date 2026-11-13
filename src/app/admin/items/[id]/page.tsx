import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { ItemForm } from "~/components/admin/items/ItemForm";
import { ItemChainPanel } from "~/components/admin/itemGraph/ItemChainPanel";
import { StatType } from "~/generated/prisma/enums";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { loadItemGraphContent } from "~/server/itemGraph/content";
import { loadEnchantBonusTable } from "~/server/enchanting/config";
import {
  enchantOverridesCodec,
  enchantUnlocksCodec,
} from "~/components/admin/items/itemFormModel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEditItemPage(props: {
  params: { id: string };
}) {
  await requireAdminPageAccess();
  const id = Number(props.params.id);
  if (!Number.isFinite(id)) notFound();

  const [item, graphContent, enchantBonuses] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      include: {
        stats: {
          orderBy: { statType: "asc" },
          select: { statType: true, value: true, maxValue: true },
        },
        statEnchantOverrides: {
          orderBy: [{ level: "asc" }, { statType: "asc" }],
          select: { statType: true, level: true, kind: true, value: true },
        },
        toolEfficiencies: {
          orderBy: { actionType: "asc" },
          select: { actionType: true, baseEfficiency: true },
        },
        statEnchantUnlocks: {
          orderBy: [{ level: "asc" }, { statType: "asc" }],
          select: { statType: true, value: true, level: true },
        },
        foodEffectStats: {
          orderBy: { statType: "asc" },
          select: { statType: true, value: true },
        },
      },
    }),
    loadItemGraphContent(),
    loadEnchantBonusTable(),
  ]);

  if (!item) notFound();

  const toolEfficienciesCsv = [
    "actionType,baseEfficiency",
    ...item.toolEfficiencies.map(
      (e: any) => `${e.actionType},${e.baseEfficiency}`,
    ),
  ].join("\n");

  const baseStatsCsv = [
    "statType,value,maxValue",
    ...item.stats
      .filter(
        (s: any) =>
          s.statType !== StatType.PHYSICAL_DAMAGE_MIN &&
          s.statType !== StatType.PHYSICAL_DAMAGE_MAX &&
          s.statType !== StatType.MAGIC_DAMAGE_MIN &&
          s.statType !== StatType.MAGIC_DAMAGE_MAX &&
          s.statType !== StatType.ARMOR,
      )
      .map((s: any) => `${s.statType},${s.value},${s.maxValue ?? ""}`),
  ].join("\n");

  const foodEffectStatsCsv = [
    "statType,value",
    ...item.foodEffectStats.map((stat) => `${stat.statType},${stat.value}`),
  ].join("\n");

  const initialValues: React.ComponentProps<typeof ItemForm>["initialValues"] =
    {
      name: item.name,
      sprite: item.sprite,
      description: item.description ?? "",
      price: item.price,
      rarity: item.rarity,
      itemType: item.itemType,
      seedGrowSeconds: item.seedGrowSeconds ?? null,
      seedYieldItemId: item.seedYieldItemId ?? null,
      seedYieldMin: item.seedYieldMin ?? null,
      seedYieldMax: item.seedYieldMax ?? null,
      seedHarvestSeconds: item.seedHarvestSeconds ?? null,
      seedXp: item.seedXp ?? null,
      healingAmount: item.healingAmount ?? null,
      foodEffectSeconds: item.foodEffectSeconds ?? null,
      equipTo: item.equipTo,
      twoHanded: item.twoHanded,
      stackable: item.stackable,
      maxStackSize: item.maxStackSize,
      minPhysicalDamage: item.minPhysicalDamage,
      maxPhysicalDamage: item.maxPhysicalDamage,
      minMagicDamage: item.minMagicDamage,
      maxMagicDamage: item.maxMagicDamage,
      armor: item.armor,
      requiredLevel: item.requiredLevel ?? 1,
      baseStatsCsv,
      toolEfficienciesCsv,
      enchantUnlocksCsv: enchantUnlocksCodec.toCsv(item.statEnchantUnlocks),
      enchantOverridesCsv: enchantOverridesCodec.toCsv(
        item.statEnchantOverrides,
      ),
      foodEffectStatsCsv,
    };

  return (
    <ItemForm
      mode="edit"
      itemId={item.id}
      initialValues={initialValues}
      enchantBonuses={enchantBonuses}
      chain={<ItemChainPanel content={graphContent} itemId={item.id} />}
    />
  );
}
