import { ItemEquipTo, StatType, type ItemType } from "~/generated/prisma/enums";
import { armorConstant, type CombatConfig } from "~/server/combat/rules";
import { getLevelStatBonus, type StatGrowthRule } from "~/utils/stats";

/**
 * Authoring budgets: the stats gear and monsters of a level should carry, so
 * content stays consistent however far levels rise. Pure and client-safe.
 * The reasoning is in docs/COMBAT_BALANCE_DESIGN.md ("Budgets").
 *
 * Item values are Common-equivalent, the way ItemStat stores them; an item's
 * rarity multiplies them. The anchors:
 * - A full on-level armor set at the reference rarity (Rare), plus the
 *   level's base armor, equals armor K: it halves damage from on-level foes.
 * - A normal on-level monster falls in about four of the reference
 *   character's rounds, and each hit it lands costs about 0.8% of the
 *   reference character's health (dungeons field many monsters at once).
 */

export type BudgetContext = {
  combat: CombatConfig;
  growth: Record<StatType, StatGrowthRule>;
};

/** Rare: the rarity most gear templates drop at. */
export const REFERENCE_RARITY_MULTIPLIER = 1.35;

/**
 * The level current content is built up to. Percentage stats grow toward
 * their ceiling by this level and stop there, so they never run into caps as
 * the game grows. Raise it together with the level cap.
 */
export const CONTENT_LEVEL_CAP = 340;

/** A full heavy set's share of armor per slot; the eight shares sum to 1. */
export const ARMOR_SLOT_SHARE: Partial<Record<ItemEquipTo, number>> = {
  [ItemEquipTo.chest]: 0.25,
  [ItemEquipTo.greaves]: 0.18,
  [ItemEquipTo.head]: 0.13,
  [ItemEquipTo.pauldrons]: 0.11,
  [ItemEquipTo.boots]: 0.09,
  [ItemEquipTo.bracers]: 0.08,
  [ItemEquipTo.gloves]: 0.08,
  [ItemEquipTo.belt]: 0.08,
};

/** Armor material: how much of a slot's armor budget an item carries. */
export const MATERIAL = { heavy: 1, medium: 0.85, light: 0.45 } as const;

/** Armor a shield carries, as a share of a full heavy set. */
const SHIELD_ARMOR_SHARE = 0.15;

function level1(level: number) {
  return Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
}

function progress(level: number) {
  return Math.min(1, level1(level) / CONTENT_LEVEL_CAP);
}

/** A character's base stat at `level`, from the growth rules. */
export function baseStatAt(
  statType: StatType,
  level: number,
  ctx: BudgetContext,
) {
  const rule = ctx.growth[statType];
  return rule.baseValue + getLevelStatBonus(rule, level1(level));
}

/** Common-equivalent armor of a full heavy set of `level`. */
export function armorSetBudget(level: number, ctx: BudgetContext) {
  const k = armorConstant(level1(level), ctx.combat);
  const base = baseStatAt(StatType.ARMOR, level, ctx);
  return Math.max(0, k - base) / REFERENCE_RARITY_MULTIPLIER;
}

/** Common-equivalent damage per round of a one-handed weapon of `level`. */
export function weaponBudget(level: number) {
  return 6 + 1.4 * (level1(level) - 1);
}

/**
 * Common-equivalent value of one secondary stat on an average-sized item of
 * `level` that carries only that stat. Item size and the number of stats
 * sharing the item adjust it (see budgetItemStats). Null for stats that
 * aren't budgeted this way.
 */
export function secondaryStatBudget(
  statType: StatType,
  level: number,
  ctx: BudgetContext,
): number | null {
  const t = progress(level);
  const lv = level1(level);
  const health = baseStatAt(StatType.HEALTH, level, ctx);
  switch (statType) {
    case StatType.ARMOR:
      return 0.1 * armorSetBudget(level, ctx);
    case StatType.HEALTH:
      return (0.35 / 8) * health;
    case StatType.HEALTH_REGEN:
      return (0.01 / 8) * health;
    case StatType.PHYSICAL_DAMAGE_MIN:
    case StatType.MAGIC_DAMAGE_MIN:
      return 0.1 * weaponBudget(level);
    case StatType.MAGIC_RESIST:
      return 3 + 5 * t;
    case StatType.FIRE_RESIST:
    case StatType.COLD_RESIST:
    case StatType.LIGHTNING_RESIST:
    case StatType.POISON_RESIST:
      return 4 + 6 * t;
    case StatType.CRITICAL_CHANCE:
      return 2 + 3 * t;
    case StatType.CRITICAL_DAMAGE:
      return 8 + 17 * t;
    case StatType.ACCURACY:
      return 1.25 + lv / 8;
    case StatType.EVASION_MELEE:
    case StatType.EVASION_RANGED:
    case StatType.EVASION_MAGIC:
      return 2 + 3 * t;
    case StatType.BLOCK_CHANCE:
      return 1.5 + 2.5 * t;
    case StatType.MOVEMENT_SPEED:
      return 2 + 3 * t;
    case StatType.LUCK:
      return 1 + 0.02 * lv;
    case StatType.GOLD_FIND:
      return 4 + 8 * t;
    case StatType.CARRYING_CAPACITY:
      return 3 + 0.03 * lv;
    case StatType.PRAYER_POINTS:
      return 2 + 0.03 * lv;
    case StatType.LIFESTEAL:
      return 1.5 + 2.5 * t;
    case StatType.THORNS:
      return 2 + 4 * t;
    case StatType.WOODCUTTING_EFFICIENCY:
    case StatType.MINING_EFFICIENCY:
    case StatType.FISHING_EFFICIENCY:
    case StatType.GATHERING_EFFICIENCY:
    case StatType.HUNTING_EFFICIENCY:
      return 1.5 + 0.03 * lv;
    default:
      return null;
  }
}

/** Percentage stats: capped per item so rarity can at most double them. */
export const PERCENT_STATS: ReadonlySet<StatType> = new Set([
  StatType.CRITICAL_CHANCE,
  StatType.BLOCK_CHANCE,
  StatType.EVASION_MELEE,
  StatType.EVASION_RANGED,
  StatType.EVASION_MAGIC,
  StatType.MAGIC_RESIST,
  StatType.FIRE_RESIST,
  StatType.COLD_RESIST,
  StatType.LIGHTNING_RESIST,
  StatType.POISON_RESIST,
  StatType.MOVEMENT_SPEED,
  StatType.LIFESTEAL,
  StatType.THORNS,
  StatType.GOLD_FIND,
]);

/** A weapon type's usual speed and damage spread (± share of average). */
export const WEAPON_TYPES: Partial<
  Record<ItemType, { speed: number; spread: number; magic?: boolean }>
> = {
  SWORD: { speed: 1, spread: 0.25 },
  GREATSWORD: { speed: 0.75, spread: 0.2 },
  AXE: { speed: 0.9, spread: 0.3 },
  GREATAXE: { speed: 0.7, spread: 0.15 },
  DAGGER: { speed: 1.4, spread: 0.25 },
  MACE: { speed: 0.85, spread: 0.2 },
  SPEAR: { speed: 0.95, spread: 0.2 },
  FLAIL: { speed: 0.8, spread: 0.3 },
  BOW: { speed: 1, spread: 0.2 },
  CROSSBOW: { speed: 0.7, spread: 0.15 },
  STAFF: { speed: 0.85, spread: 0.2, magic: true },
  WAND: { speed: 1.2, spread: 0.2, magic: true },
};

/** Two-handed weapons give up the off hand, so they hit harder. */
export const TWO_HANDED_FACTOR = 1.3;

export type ItemProfile = {
  level: number;
  equipTo: ItemEquipTo;
  itemType: ItemType | null;
  twoHanded: boolean;
  /** Armor pieces: share of the slot's armor budget (see MATERIAL). */
  material?: number;
  /** Weapons: strikes per round; defaults to the weapon type's speed. */
  attackSpeed?: number;
  /** Weapons: deal magic instead of physical damage. */
  magic?: boolean;
  /**
   * Secondary stats and their relative weights; together they share the
   * item's budget. PHYSICAL_DAMAGE_MIN / MAGIC_DAMAGE_MIN stand for a damage
   * range on gear that isn't a weapon.
   */
  stats: Partial<Record<StatType, number>>;
};

export type BudgetedStat = {
  statType: StatType;
  value: number;
  maxValue: number | null;
};

/** Rounds to a precision that reads well at the value's size. */
export function roundStat(value: number) {
  const size = Math.abs(value);
  if (size >= 20) return Math.round(value);
  if (size >= 2) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/** Stats players read as whole points. */
const POINT_STATS: ReadonlySet<StatType> = new Set([
  StatType.ARMOR,
  StatType.HEALTH,
  StatType.ACCURACY,
  StatType.LUCK,
  StatType.CARRYING_CAPACITY,
  StatType.PRAYER_POINTS,
  StatType.CRITICAL_DAMAGE,
  StatType.WOODCUTTING_EFFICIENCY,
  StatType.MINING_EFFICIENCY,
  StatType.FISHING_EFFICIENCY,
  StatType.GATHERING_EFFICIENCY,
  StatType.HUNTING_EFFICIENCY,
]);

const DAMAGE_STATS: ReadonlySet<StatType> = new Set([
  StatType.PHYSICAL_DAMAGE_MIN,
  StatType.PHYSICAL_DAMAGE_MAX,
  StatType.MAGIC_DAMAGE_MIN,
  StatType.MAGIC_DAMAGE_MAX,
]);

/**
 * Rounds a stat the way an author would write it: whole points (at least 1)
 * for point stats, whole damage from 5 up, one decimal for percentages,
 * two for attack speed and health regeneration.
 */
export function roundForStat(statType: StatType, value: number) {
  if (value <= 0) return roundStat(value);
  if (POINT_STATS.has(statType)) return Math.max(1, Math.round(value));
  if (DAMAGE_STATS.has(statType)) {
    return value >= 5
      ? Math.round(value)
      : Math.max(0.1, Math.round(value * 10) / 10);
  }
  if (PERCENT_STATS.has(statType))
    return Math.max(0.1, Math.round(value * 10) / 10);
  return Math.round(value * 100) / 100;
}

function isShield(profile: ItemProfile) {
  return (
    profile.equipTo === ItemEquipTo.offhand && profile.itemType === "SHIELD"
  );
}

/**
 * How much secondary stat an item carries relative to an average armor
 * piece: armor pieces by slot (a chest 2, gloves 0.64), weapons 1.5 or 2
 * two-handed, shields 1.2, jewelry 1.
 */
export function itemSize(profile: ItemProfile) {
  const slot = ARMOR_SLOT_SHARE[profile.equipTo];
  if (slot !== undefined) return slot * 8;
  if (profile.equipTo === ItemEquipTo.weapon)
    return profile.twoHanded ? 2 : 1.5;
  if (isShield(profile)) return 1.2;
  return 1;
}

function damageRange(
  statMin: StatType,
  statMax: StatType,
  average: number,
  spread: number,
): BudgetedStat[] {
  const min = Math.max(0.1, average * (1 - spread));
  const max = Math.max(min, average * (1 + spread));
  return [
    { statType: statMin, value: roundForStat(statMin, min), maxValue: null },
    { statType: statMax, value: roundForStat(statMax, max), maxValue: null },
  ];
}

/**
 * Common-equivalent stats for an item from its profile. Armor pieces carry
 * their slot's armor by material; weapons carry damage per round by level,
 * type and hands; every other stat shares the item's secondary budget.
 */
export function budgetItemStats(
  profile: ItemProfile,
  ctx: BudgetContext,
): BudgetedStat[] {
  const out: BudgetedStat[] = [];
  const { level } = profile;
  const size = itemSize(profile);
  const slot = ARMOR_SLOT_SHARE[profile.equipTo];

  if (slot !== undefined && (profile.material ?? 0) > 0) {
    out.push({
      statType: StatType.ARMOR,
      value: roundForStat(
        StatType.ARMOR,
        armorSetBudget(level, ctx) * slot * profile.material!,
      ),
      maxValue: null,
    });
  }

  if (profile.equipTo === ItemEquipTo.weapon) {
    const type = (profile.itemType && WEAPON_TYPES[profile.itemType]) ?? {
      speed: 1,
      spread: 0.25,
    };
    const speed = profile.attackSpeed ?? type.speed;
    const hands = profile.twoHanded ? TWO_HANDED_FACTOR : 1;
    const average = (weaponBudget(level) * hands) / speed;
    const magic = profile.magic ?? type.magic ?? false;
    out.push(
      ...damageRange(
        magic ? StatType.MAGIC_DAMAGE_MIN : StatType.PHYSICAL_DAMAGE_MIN,
        magic ? StatType.MAGIC_DAMAGE_MAX : StatType.PHYSICAL_DAMAGE_MAX,
        average,
        type.spread,
      ),
      {
        statType: StatType.ATTACK_SPEED,
        value: Math.round(speed * 100) / 100,
        maxValue: null,
      },
    );
  }

  if (isShield(profile)) {
    const t = progress(level);
    out.push(
      {
        statType: StatType.ARMOR,
        value: roundForStat(
          StatType.ARMOR,
          armorSetBudget(level, ctx) * SHIELD_ARMOR_SHARE,
        ),
        maxValue: null,
      },
      {
        statType: StatType.BLOCK_CHANCE,
        value: roundForStat(StatType.BLOCK_CHANCE, 10 + 10 * t),
        maxValue: roundForStat(StatType.BLOCK_CHANCE, 2 * (10 + 10 * t)),
      },
    );
  }

  const weights = Object.entries(profile.stats).filter(
    ([, weight]) => (weight ?? 0) > 0,
  ) as Array<[StatType, number]>;
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  // Stats that share an item each get less, but the item's total grows a
  // little with every extra stat, so a three-stat ring isn't worthless.
  const spread = 1 + 0.5 * (weights.length - 1);
  for (const [statType, weight] of weights) {
    const single = secondaryStatBudget(statType, level, ctx);
    if (single === null || total <= 0) continue;
    const value = single * size * (weight / total) * spread;
    if (statType === StatType.PHYSICAL_DAMAGE_MIN) {
      out.push(
        ...damageRange(
          StatType.PHYSICAL_DAMAGE_MIN,
          StatType.PHYSICAL_DAMAGE_MAX,
          value,
          0.4,
        ),
      );
    } else if (statType === StatType.MAGIC_DAMAGE_MIN) {
      out.push(
        ...damageRange(
          StatType.MAGIC_DAMAGE_MIN,
          StatType.MAGIC_DAMAGE_MAX,
          value,
          0.4,
        ),
      );
    } else {
      const rounded = roundForStat(statType, value);
      out.push({
        statType,
        value: rounded,
        maxValue: PERCENT_STATS.has(statType)
          ? roundForStat(statType, rounded * 2)
          : null,
      });
    }
  }

  // One row per stat: a shield's own armor and block win over a budgeted one.
  const seen = new Set<StatType>();
  return out.filter((stat) => {
    if (seen.has(stat.statType)) return false;
    seen.add(stat.statType);
    return true;
  });
}

/** The character monsters of a level are authored against. */
export function referenceCharacter(level: number, ctx: BudgetContext) {
  const health = 1.3 * baseStatAt(StatType.HEALTH, level, ctx);
  const baseDamage =
    (baseStatAt(StatType.PHYSICAL_DAMAGE_MIN, level, ctx) +
      baseStatAt(StatType.PHYSICAL_DAMAGE_MAX, level, ctx)) /
    2;
  const critChance =
    Math.min(100, baseStatAt(StatType.CRITICAL_CHANCE, level, ctx)) / 100;
  const critDamage =
    Math.max(100, baseStatAt(StatType.CRITICAL_DAMAGE, level, ctx)) / 100;
  const damagePerRound =
    (REFERENCE_RARITY_MULTIPLIER * weaponBudget(level) + baseDamage) *
    (1 + critChance * (critDamage - 1));
  return {
    health,
    armor: armorConstant(level1(level), ctx.combat),
    damagePerRound,
  };
}

export type MonsterRank = "fodder" | "normal" | "elite" | "boss";

/**
 * Health, damage and armor multipliers per rank. Armor is a share of the
 * attacker's K: 0.25 K stops 20%, 0.5 K stops 33%.
 */
export const MONSTER_RANKS: Record<
  MonsterRank,
  { health: number; damage: number; armorShare: number }
> = {
  fodder: { health: 0.5, damage: 0.4, armorShare: 0.25 },
  normal: { health: 1, damage: 1, armorShare: 0.25 },
  elite: { health: 2.5, damage: 1.3, armorShare: 0.35 },
  boss: { health: 8, damage: 1.8, armorShare: 0.5 },
};

/** Rounds a normal monster lasts against the reference character. */
const NORMAL_MONSTER_ROUNDS = 4;
/**
 * Health share one landed normal-monster hit costs, after armor halves it.
 * Dungeons hold many monsters in packs, so this is small; tune a dungeon's
 * own monsters against its population with the admin simulators.
 */
const NORMAL_HIT_SHARE = 0.008;

/**
 * A monster of `level` and `rank`: health, raw average damage per hit (split
 * across its damage types by the caller), and armor.
 */
export function monsterBudget(
  level: number,
  rank: MonsterRank,
  ctx: BudgetContext,
) {
  const reference = referenceCharacter(level, ctx);
  const k = armorConstant(level1(level), ctx.combat);
  const multipliers = MONSTER_RANKS[rank];
  const armor = k * multipliers.armorShare;
  const taken = k / (k + armor);
  return {
    health:
      multipliers.health *
      NORMAL_MONSTER_ROUNDS *
      reference.damagePerRound *
      taken,
    damage: (multipliers.damage * NORMAL_HIT_SHARE * reference.health) / 0.5,
    armor,
  };
}

/**
 * Raw average damage per hit of a hunting animal at its home level. Animals
 * that attack more often are predators and hit harder.
 */
export function animalDamage(
  level: number,
  attackChance: number,
  ctx: BudgetContext,
) {
  const reference = referenceCharacter(level, ctx);
  return (
    0.12 * (0.5 + Math.min(1, Math.max(0, attackChance))) * reference.health
  );
}

/** Raw average damage of one hunting mishap at a location level. */
export function accidentDamage(level: number, ctx: BudgetContext) {
  return 0.02 * referenceCharacter(level, ctx).health;
}
