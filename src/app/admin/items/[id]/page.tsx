import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { ItemForm } from "~/components/admin/items/ItemForm";
import { StatType } from "~/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEditItemPage(props: {
  params: { id: string };
}) {
  const id = Number(props.params.id);
  if (!Number.isFinite(id)) notFound();

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      stats: {
        orderBy: { statType: "asc" },
        select: { statType: true, value: true, maxValue: true },
      },
      statRarityOverrides: {
        orderBy: [{ rarity: "asc" }, { statType: "asc" }],
        select: { statType: true, rarity: true, value: true },
      },
      toolEfficiencies: {
        orderBy: { actionType: "asc" },
        select: { actionType: true, baseEfficiency: true },
      },
      statProgressions: {
        orderBy: [{ unlocksAtRarity: "asc" }, { statType: "asc" }],
        select: { statType: true, baseValue: true, unlocksAtRarity: true },
      },
    },
  });

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

  const statProgressionsCsv = [
    "statType,baseValue,unlocksAtRarity",
    ...item.statProgressions.map(
      (p: any) => `${p.statType},${p.baseValue},${p.unlocksAtRarity}`,
    ),
  ].join("\n");

  const statRarityOverridesCsv = [
    "statType,rarity,value",
    ...(item.statRarityOverrides ?? []).map(
      (o: any) => `${o.statType},${o.rarity},${o.value}`,
    ),
  ].join("\n");

  const initialValues: React.ComponentProps<typeof ItemForm>["initialValues"] = {
    name: item.name,
    sprite: item.sprite,
    description: item.description ?? "",
    price: item.price,
    rarity: item.rarity,
    itemType: item.itemType,
    equipTo: item.equipTo,
    stackable: item.stackable,
    maxStackSize: item.maxStackSize,
    flipNegativeStatsWithRarity: item.flipNegativeStatsWithRarity,
    minPhysicalDamage: item.minPhysicalDamage,
    maxPhysicalDamage: item.maxPhysicalDamage,
    minMagicDamage: item.minMagicDamage,
    maxMagicDamage: item.maxMagicDamage,
    armor: item.armor,
    requiredLevel: item.requiredLevel ?? 1,
    baseStatsCsv,
    toolEfficienciesCsv,
    statProgressionsCsv,
    statRarityOverridesCsv,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Item</h1>
        <p className="text-sm text-white/70">ID: {item.id}</p>
      </div>
      <ItemForm mode="edit" itemId={item.id} initialValues={initialValues} />
    </div>
  );
}
