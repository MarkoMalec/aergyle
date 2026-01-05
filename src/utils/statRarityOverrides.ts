import { prisma } from "~/lib/prisma";
import { ItemRarity, StatType } from "~/generated/prisma/enums";

export async function setItemStatRarityOverrides(
  itemId: number,
  overrides: Array<{ statType: StatType; rarity: ItemRarity; value: number }>,
) {
  await prisma.itemStatRarityOverride.deleteMany({ where: { itemId } });

  const rows = overrides
    .filter((o) => Number.isFinite(o.value))
    .map((o) => ({
      itemId,
      statType: o.statType,
      rarity: o.rarity,
      value: o.value,
    }));

  if (rows.length > 0) {
    await prisma.itemStatRarityOverride.createMany({ data: rows });
  }

  return await prisma.itemStatRarityOverride.findMany({
    where: { itemId },
    orderBy: [{ rarity: "asc" }, { statType: "asc" }],
  });
}
