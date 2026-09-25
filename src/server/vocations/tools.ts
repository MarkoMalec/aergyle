import { VocationalActionType } from "~/generated/prisma/enums";
import { getVocationalEfficiencyStatType } from "~/game/vocationStats";
import { prisma } from "~/lib/prisma";
import {
  getCharacterStatSnapshot,
  type CharacterStatSnapshot,
  USABLE_EQUIPMENT_ITEM_STATUSES,
} from "~/server/stats";

export { computeEffectiveUnitSeconds } from "~/game/vocationStats";

// No upper bound: the time curve never reaches zero, so every point counts.
function clampEfficiency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

// Centralized tool rules per vocation action.
// - `requiredEquipmentField`: if set, the player must have a tool equipped in that Equipment.* field to start.
const TOOL_RULES: Partial<
  Record<
    VocationalActionType,
    {
      requiredEquipmentField?:
        | "fellingAxeItemId"
        | "pickaxeItemId"
        | "fishingRodItemId"
        | "hoeItemId";
      requiredMessage?: string;
    }
  >
> = {
  [VocationalActionType.WOODCUTTING]: {
    requiredEquipmentField: "fellingAxeItemId",
    requiredMessage: "You need to equip a Felling Axe to start woodcutting.",
  },
  [VocationalActionType.MINING]: {
    requiredEquipmentField: "pickaxeItemId",
    requiredMessage: "You need to equip a Pickaxe to start mining.",
  },
  [VocationalActionType.FISHING]: {
    requiredEquipmentField: "fishingRodItemId",
    requiredMessage: "You need to equip a Fishing Rod to start fishing.",
  },
  [VocationalActionType.GARDENING]: {
    requiredEquipmentField: "hoeItemId",
    requiredMessage: "You need to equip a Hoe to plant seeds.",
  },
};

export function getToolRule(actionType: VocationalActionType) {
  return TOOL_RULES[actionType] ?? null;
}

async function getEquippedToolUserItemId(
  userId: string,
  actionType: VocationalActionType,
): Promise<number | null> {
  const rule = getToolRule(actionType);
  const requiredEquipmentField = rule?.requiredEquipmentField;
  if (!requiredEquipmentField) {
    return null;
  }

  const equipment = await prisma.equipment.findUnique({
    where: { userId },
    select: {
      fellingAxeItemId: true,
      pickaxeItemId: true,
      fishingRodItemId: true,
      hoeItemId: true,
    },
  });
  const userItemId = equipment?.[requiredEquipmentField] ?? null;
  if (!userItemId) return null;

  const usableItem = await prisma.userItem.findFirst({
    where: {
      id: userItemId,
      userId,
      status: { in: USABLE_EQUIPMENT_ITEM_STATUSES },
    },
    select: { id: true },
  });
  return usableItem?.id ?? null;
}

export async function assertRequiredToolEquipped(
  userId: string,
  actionType: VocationalActionType,
): Promise<void> {
  const rule = getToolRule(actionType);
  const requiredEquipmentField = rule?.requiredEquipmentField;
  if (!requiredEquipmentField) {
    return;
  }

  const toolUserItemId = await getEquippedToolUserItemId(userId, actionType);
  if (!toolUserItemId) {
    throw new Error(rule?.requiredMessage ?? "Required tool is not equipped");
  }
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
