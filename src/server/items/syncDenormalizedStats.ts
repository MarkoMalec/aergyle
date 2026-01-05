import "server-only";

import { StatType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";

/**
 * Sync denormalized stat columns on Item when stats change.
 *
 * This must stay server-only (uses Prisma).
 */
export async function syncItemDenormalizedStats(itemId: number): Promise<void> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { stats: true },
  });

  if (!item) return;

  const getStat = (statType: StatType): number | null => {
    const stat = item.stats.find((s) => s.statType === statType);
    return stat ? stat.value : null;
  };

  await prisma.item.update({
    where: { id: itemId },
    data: {
      minPhysicalDamage: getStat(StatType.PHYSICAL_DAMAGE_MIN),
      maxPhysicalDamage: getStat(StatType.PHYSICAL_DAMAGE_MAX),
      minMagicDamage: getStat(StatType.MAGIC_DAMAGE_MIN),
      maxMagicDamage: getStat(StatType.MAGIC_DAMAGE_MAX),
      armor: getStat(StatType.ARMOR),
    },
  });
}
