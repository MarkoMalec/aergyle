import React from "react";
import { prisma } from "~/lib/prisma";
import { RarityConfigForm } from "~/components/admin/rarity/RarityConfigForm";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRarityPage() {
  await requireAdminPageAccess();
  const configs = await prisma.rarityConfig.findMany({
    orderBy: [{ sortOrder: "asc" }],
  });

  const initialConfigs = configs.map((c) => ({
    id: c.id,
    rarity: c.rarity,
    statMultiplier: Number(c.statMultiplier),
    minStats: c.minStats,
    maxStats: c.maxStats,
    bonusStatChance: Number(c.bonusStatChance),
    color: c.color,
    displayName: c.displayName,
    sortOrder: c.sortOrder,
    upgradeEnabled: c.upgradeEnabled,
    nextRarity: c.nextRarity,
    upgradeCost: c.upgradeCost == null ? null : Number(c.upgradeCost),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rarity</h1>
        <p className="text-sm text-white/70">Manage global rarity multipliers and display settings.</p>
      </div>

      <RarityConfigForm initialConfigs={initialConfigs} />
    </div>
  );
}
