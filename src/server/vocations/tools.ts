import type { VocationalActionType } from "~/generated/prisma/enums";
import { getVocationalEfficiencyStatType } from "~/game/vocationStats";
import {
  getCharacterStatSnapshot,
  type CharacterStatSnapshot,
} from "~/server/stats";

export { computeEffectiveUnitSeconds } from "~/game/vocationStats";
export {
  assertRequiredToolEquipped,
  getToolRule,
} from "~/server/vocations/toolRules";

// No upper bound: the time curve never reaches zero, so every point counts.
function clampEfficiency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

export async function getToolEfficiencyForAction(
  userId: string,
  actionType: VocationalActionType,
): Promise<number> {
  if (!getVocationalEfficiencyStatType(actionType)) return 0;
  const character = await getCharacterStatSnapshot(userId);
  return getEfficiencyFromCharacter(character, actionType);
}

function getEfficiencyFromCharacter(
  character: Pick<CharacterStatSnapshot, "totals">,
  actionType: VocationalActionType,
): number {
  const statType = getVocationalEfficiencyStatType(actionType);
  return statType ? clampEfficiency(character.totals[statType]) : 0;
}
