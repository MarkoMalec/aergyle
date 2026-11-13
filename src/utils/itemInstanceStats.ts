import {
  ItemEquipTo,
  ItemStatOverrideKind,
  StatType,
  type VocationalActionType,
} from "~/generated/prisma/enums";
import { getVocationalEfficiencyStatType } from "~/game/vocationStats";

type StatTemplate = {
  statType: StatType;
  value: number;
  maxValue?: number | null;
};

/** A stat gained from an enchant level upward. */
export type EnchantUnlockTemplate = {
  statType: StatType;
  value: number;
  level: number;
};

/** One stat at one enchant level: its own multiplier or an exact value. */
export type EnchantOverrideTemplate = {
  statType: StatType;
  level: number;
  kind: ItemStatOverrideKind;
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

/**
 * A weapon's Attack Speed is how fast that weapon strikes, so enchanting
 * improves its other stats but not its speed. A per-item override still applies.
 */
export function statScalesWithEnchant(
  statType: StatType,
  equipTo: ItemEquipTo | null | undefined,
) {
  return !(
    equipTo === ItemEquipTo.weapon && statType === StatType.ATTACK_SPEED
  );
}

export type EnchantedStat = {
  /** Null when the item has none of this stat at this level. */
  value: number | null;
  /** Base value plus every unlock reached at this level. */
  baseTotal: number;
  /** The level's global multiplier, or 1 when the stat doesn't scale. */
  globalMultiplier: number;
  /** The multiplier actually applied (an override replaces the global one). */
  multiplier: number;
  override: EnchantOverrideTemplate | null;
  /** The value before the cap, when the cap lowered it. */
  uncapped: number | null;
  scales: boolean;
};

/**
 * One stat at one enchant level. The game and the /admin item grid both use
 * this, so the admin preview is exactly what players get.
 */
export function enchantStat(params: {
  statType: StatType;
  equipTo: ItemEquipTo | null | undefined;
  base: number;
  maxValue: number | null | undefined;
  unlocks: readonly EnchantUnlockTemplate[];
  overrides: readonly EnchantOverrideTemplate[];
  level: number;
  /** The level's global stat bonus in percent. */
  bonusPercent: number;
}): EnchantedStat {
  const unlocked = params.unlocks
    .filter((u) => u.statType === params.statType && u.level <= params.level)
    .reduce((sum, u) => sum + u.value, 0);
  const reached = params.unlocks.some(
    (u) => u.statType === params.statType && u.level <= params.level,
  );
  const baseTotal = params.base + unlocked;
  const found =
    params.level > 0
      ? params.overrides.find(
          (o) => o.statType === params.statType && o.level === params.level,
        )
      : undefined;
  const override = found && Number.isFinite(found.value) ? found : null;
  const scales = statScalesWithEnchant(params.statType, params.equipTo);
  // Enchanting lifts positive stats only, never a penalty.
  const globalMultiplier =
    scales && params.level > 0 && baseTotal > 0
      ? 1 + Math.max(0, params.bonusPercent) / 100
      : 1;
  const multiplier =
    override?.kind === ItemStatOverrideKind.MULTIPLIER
      ? override.value
      : globalMultiplier;
  const total =
    override?.kind === ItemStatOverrideKind.ABSOLUTE
      ? override.value
      : baseTotal * multiplier;
  const cap =
    typeof params.maxValue === "number" && Number.isFinite(params.maxValue)
      ? params.maxValue
      : Infinity;
  const capped = Math.min(total, cap);
  const present = params.base !== 0 || reached || override !== null;
  return {
    value: present ? capped : null,
    baseTotal,
    globalMultiplier,
    multiplier,
    override,
    uncapped: capped < total ? total : null,
    scales,
  };
}

/**
 * Resolves current effective stats for one item template at one enchant level.
 * Rarity is a label only and never changes stats.
 *
 * Template-derived values remain live balance data. `instanceModifiers` are
 * additive, player-item-specific adjustments; they are applied after scaling
 * and caps.
 */
export function resolveEffectiveItemStats(params: {
  equipTo?: ItemEquipTo | null;
  stats: readonly StatTemplate[];
  enchantUnlocks?: readonly EnchantUnlockTemplate[];
  enchantOverrides?: readonly EnchantOverrideTemplate[];
  toolEfficiencies?: readonly ToolEfficiencyTemplate[];
  instanceModifiers?: readonly InstanceStatModifier[];
  enchantLevel?: number;
  /** The enchant level's global stat bonus in percent (docs/ENCHANTING_SYSTEM.md). */
  enchantBonusPercent?: number;
}): Array<{ statType: StatType; value: number }> {
  const level = Math.max(0, params.enchantLevel ?? 0);
  const unlocks = params.enchantUnlocks ?? [];
  const overrides = params.enchantOverrides ?? [];
  const base = new Map<StatType, { value: number; maxValue?: number | null }>();
  for (const stat of params.stats) base.set(stat.statType, stat);
  for (const efficiency of params.toolEfficiencies ?? []) {
    const statType = getVocationalEfficiencyStatType(efficiency.actionType);
    if (statType) base.set(statType, { value: efficiency.baseEfficiency });
  }
  const modifiers = new Map<StatType, number>();
  for (const modifier of params.instanceModifiers ?? []) {
    if (!Number.isFinite(modifier.value)) continue;
    modifiers.set(
      modifier.statType,
      (modifiers.get(modifier.statType) ?? 0) + modifier.value,
    );
  }

  const statTypes = new Set<StatType>([
    ...base.keys(),
    ...unlocks.map((u) => u.statType),
    ...overrides.map((o) => o.statType),
    ...modifiers.keys(),
  ]);
  const result: Array<{ statType: StatType; value: number }> = [];
  for (const statType of statTypes) {
    const template = base.get(statType);
    const stat = enchantStat({
      statType,
      equipTo: params.equipTo,
      base: template?.value ?? 0,
      maxValue: template?.maxValue,
      unlocks,
      overrides,
      level,
      bonusPercent: params.enchantBonusPercent ?? 0,
    });
    const modifier = modifiers.get(statType);
    // Listed stats always show, as before; unreached unlocks/overrides don't.
    if (stat.value === null && !template && modifier === undefined) continue;
    result.push({
      statType,
      value:
        Math.round(((stat.value ?? 0) + (modifier ?? 0)) * 1_000_000) /
        1_000_000,
    });
  }
  return result;
}
