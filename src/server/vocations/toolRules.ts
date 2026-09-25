/**
 * Which tool each vocation action needs, and the check that it is equipped.
 *
 * Imported by the realtime daemon (via ~/server/garden/service), which runs as plain
 * Node outside Next.js. Keep this module free of `server-only` imports such as
 * ~/server/stats.
 */
import { VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { USABLE_EQUIPMENT_ITEM_STATUSES } from "~/utils/itemEquipTo";

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
