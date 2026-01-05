import { StatType, VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";

function clampEfficiency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

// Centralized tool rules per vocation action.
// - `requiredEquipmentField`: if set, the player must have a tool equipped in that Equipment.* field to start.
// - `efficiencyStatType`: which UserItemStat stat contributes to tool efficiency for this action.
const TOOL_RULES: Partial<
  Record<
    VocationalActionType,
    {
      requiredEquipmentField?:
        | "fellingAxeItemId"
        | "pickaxeItemId";
      efficiencyStatType?: StatType;
      requiredMessage?: string;
    }
  >
> = {
  [VocationalActionType.WOODCUTTING]: {
    requiredEquipmentField: "fellingAxeItemId",
    efficiencyStatType: StatType.WOODCUTTING_EFFICIENCY,
    requiredMessage: "You need to equip a Felling Axe to start woodcutting.",
  },
  [VocationalActionType.MINING]: {
    requiredEquipmentField: "pickaxeItemId",
    efficiencyStatType: StatType.MINING_EFFICIENCY,
    requiredMessage: "You need to equip a Pickaxe to start mining.",
  },
  [VocationalActionType.FISHING]: {
    efficiencyStatType: StatType.FISHING_EFFICIENCY,
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

  if (requiredEquipmentField === "fellingAxeItemId") {
    const equipment = await prisma.equipment.findUnique({
      where: { userId },
      select: { fellingAxeItemId: true },
    });
    return equipment?.fellingAxeItemId ?? null;
  }

  const equipment = await prisma.equipment.findUnique({
    where: { userId },
    select: { pickaxeItemId: true },
  });
  return equipment?.pickaxeItemId ?? null;
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
  const rule = getToolRule(actionType);
  const statType = rule?.efficiencyStatType;
  if (!statType) {
    return 0;
  }

  const toolItemId = await getEquippedToolUserItemId(userId, actionType);
  if (!toolItemId) {
    return 0;
  }

  const stats = await prisma.userItemStat.findMany({
    where: {
      userItemId: toolItemId,
      statType,
    },
    select: { value: true },
  });

  const total = stats.reduce((sum, stat) => {
    return sum + (Number.isFinite(stat.value) ? stat.value : 0);
  }, 0);

  return clampEfficiency(total);
}

export async function getToolEfficiencyMap(
  userId: string,
  actionTypes: VocationalActionType[],
): Promise<Record<VocationalActionType, number>> {
  const uniqueTypes = Array.from(new Set(actionTypes));
  const result: Record<VocationalActionType, number> = {} as Record<
    VocationalActionType,
    number
  >;

  await Promise.all(
    uniqueTypes.map(async (type) => {
      result[type] = await getToolEfficiencyForAction(userId, type);
    }),
  );

  return result;
}

export function computeEffectiveUnitSeconds(
  baseSeconds: number,
  efficiencyPercent: number,
): {
  unitSeconds: number;
  rawSeconds: number;
  appliedEfficiency: number;
} {
  const appliedEfficiency = clampEfficiency(efficiencyPercent);
  const multiplier = 1 - appliedEfficiency / 100;
  const rawSeconds = Math.max(0, baseSeconds * multiplier);
  const unitSeconds = Math.max(1, Math.floor(rawSeconds));

  return {
    unitSeconds,
    rawSeconds,
    appliedEfficiency,
  };
}
