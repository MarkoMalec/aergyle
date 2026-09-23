import {
  ItemEquipTo,
  ItemRarity,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { getVocationalEfficiencyStatType } from "~/game/vocationStats";

type StatTemplate = {
  statType: StatType;
  value: number;
  maxValue?: number | null;
};

type StatProgressionTemplate = {
  statType: StatType;
  baseValue: number;
  unlocksAtRarity: ItemRarity;
};

type StatOverrideTemplate = {
  statType: StatType;
  rarity: ItemRarity;
  kind?: "MULTIPLIER" | "ABSOLUTE";
  value: number;
};

type ToolEfficiencyTemplate = {
  actionType: VocationalActionType;
  baseEfficiency: number;
};

type InstanceStatModifier = {
  statType: StatType;
  value: number;
};

const RARITY_ORDER: readonly ItemRarity[] = [
  ItemRarity.WORTHLESS,
  ItemRarity.BROKEN,
  ItemRarity.COMMON,
  ItemRarity.UNCOMMON,
  ItemRarity.RARE,
  ItemRarity.EXQUISITE,
  ItemRarity.EPIC,
  ItemRarity.ELITE,
  ItemRarity.UNIQUE,
  ItemRarity.LEGENDARY,
  ItemRarity.MYTHIC,
  ItemRarity.DIVINE,
];

export function scaleItemStat(
  baseValue: number,
  multiplier: number,
  flipNegativeStatsWithRarity: boolean,
  maxValueCap?: number | null,
) {
  let scaled: number;
  if (!flipNegativeStatsWithRarity || baseValue >= 0) {
    scaled = baseValue * multiplier;
  } else {
    scaled = baseValue + (multiplier - 1) * Math.abs(baseValue);
  }

  return typeof maxValueCap === "number" && Number.isFinite(maxValueCap)
    ? Math.min(scaled, maxValueCap)
    : scaled;
}

/**
 * A weapon's Attack Speed is how fast that weapon strikes, so rarity improves
 * its other stats but not its speed. A per-item rarity override still applies.
 */
export function statScalesWithRarity(
  statType: StatType,
  equipTo: ItemEquipTo | null | undefined,
) {
  return !(
    equipTo === ItemEquipTo.weapon && statType === StatType.ATTACK_SPEED
  );
}

/**
 * Resolves current effective stats for one item template + rarity.
 *
 * Template-derived values remain live balance data. `instanceModifiers` are
 * additive, player-item-specific adjustments reserved for systems such as
 * enchantments; they are deliberately applied after template scaling/caps.
 */
export function resolveEffectiveItemStats(params: {
  rarity: ItemRarity;
  rarityMultiplier: number;
  flipNegativeStatsWithRarity?: boolean;
  equipTo?: ItemEquipTo | null;
  stats: readonly StatTemplate[];
  statProgressions?: readonly StatProgressionTemplate[];
  statRarityOverrides?: readonly StatOverrideTemplate[];
  toolEfficiencies?: readonly ToolEfficiencyTemplate[];
  instanceModifiers?: readonly InstanceStatModifier[];
}): Array<{ statType: StatType; value: number }> {
  const flip = Boolean(params.flipNegativeStatsWithRarity);
  const rarityIndex = RARITY_ORDER.indexOf(params.rarity);
  const baseValues = new Map<StatType, number>();
  const maxCaps = new Map<StatType, number>();
  const overrides = new Map<
    StatType,
    { kind: "MULTIPLIER" | "ABSOLUTE"; value: number }
  >();
  const modifiers = new Map<StatType, number>();

  for (const stat of params.stats) {
    baseValues.set(stat.statType, stat.value);
    if (typeof stat.maxValue === "number" && Number.isFinite(stat.maxValue)) {
      maxCaps.set(stat.statType, stat.maxValue);
    }
  }

  for (const progression of params.statProgressions ?? []) {
    if (RARITY_ORDER.indexOf(progression.unlocksAtRarity) > rarityIndex) {
      continue;
    }
    baseValues.set(
      progression.statType,
      (baseValues.get(progression.statType) ?? 0) + progression.baseValue,
    );
  }

  for (const override of params.statRarityOverrides ?? []) {
    if (override.rarity === params.rarity && Number.isFinite(override.value)) {
      const kind = override.kind ?? "ABSOLUTE";
      overrides.set(override.statType, { kind, value: override.value });
      if (kind === "ABSOLUTE" && !baseValues.has(override.statType)) {
        baseValues.set(override.statType, 0);
      }
    }
  }

  for (const efficiency of params.toolEfficiencies ?? []) {
    const statType = getVocationalEfficiencyStatType(efficiency.actionType);
    if (statType) baseValues.set(statType, efficiency.baseEfficiency);
  }

  for (const modifier of params.instanceModifiers ?? []) {
    if (!Number.isFinite(modifier.value)) continue;
    modifiers.set(
      modifier.statType,
      (modifiers.get(modifier.statType) ?? 0) + modifier.value,
    );
    if (!baseValues.has(modifier.statType))
      baseValues.set(modifier.statType, 0);
  }

  return Array.from(baseValues.entries()).map(([statType, baseValue]) => {
    const override = overrides.get(statType);
    const scaledBase =
      override?.kind === "ABSOLUTE"
        ? Math.min(override.value, maxCaps.get(statType) ?? Infinity)
        : scaleItemStat(
            baseValue,
            override?.kind === "MULTIPLIER"
              ? override.value
              : statScalesWithRarity(statType, params.equipTo)
                ? params.rarityMultiplier
                : 1,
            flip,
            maxCaps.get(statType),
          );
    return {
      statType,
      value:
        Math.round((scaledBase + (modifiers.get(statType) ?? 0)) * 1_000_000) /
        1_000_000,
    };
  });
}
