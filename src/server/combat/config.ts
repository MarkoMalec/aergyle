import { prisma } from "~/lib/prisma";
import { DEFAULT_COMBAT_CONFIG, type CombatConfig } from "./rules";

/** The admin's combat constants, or the code defaults before any are saved. */
export async function getCombatConfig(): Promise<CombatConfig> {
  const row = await prisma.combatConfig.findUnique({
    where: { id: 1 },
    select: { armorK0: true, armorK1: true },
  });
  return row ?? DEFAULT_COMBAT_CONFIG;
}
