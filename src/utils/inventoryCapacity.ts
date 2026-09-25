import { getCharacterStatSnapshot } from "~/server/stats";
import type { EquipmentItemReferences } from "~/utils/itemEquipTo";

/**
 * Calculate total inventory capacity for a user
 * Base capacity: 25 slots
 * Additional capacity: the character's canonical CARRYING_CAPACITY stat.
 */
export async function calculateInventoryCapacity(
  userId: string,
  /** Capacity with this equipment instead of what is saved. */
  options: { equipment?: EquipmentItemReferences } = {},
): Promise<number> {
  const BASE_CAPACITY = 25;
  const character = await getCharacterStatSnapshot(userId, options);
  return BASE_CAPACITY + Math.floor(character.finalStats.carryingCapacity);
}
