import { ItemEquipTo, StatType, type ItemRarity } from "~/generated/prisma/enums";
import {
  combatSnapshotFromStats,
  resolveDungeonRun,
  type DungeonCombatSnapshot,
} from "~/server/dungeons/resolver";
import { createExpeditionRandom } from "~/server/expeditions/random";
import { resolveEffectiveItemStats } from "~/utils/itemInstanceStats";
import {
  aggregateStatValues,
  calculateFinalStatsFromTotals,
  calculateLevelBaseStats,
  combineStatRecords,
  weaponAttackSpeedAdjustment,
  type StatValue,
} from "~/utils/stats";
import type { BalanceContent, BalanceDungeon, BalanceItem } from "./content";

/**
 * A character of any level, optionally wearing the best gear it may equip,
 * built from the same stat rules the game uses, and dungeon survival for it
 * from the live combat resolver.
 */

export type GearPiece = {
  slot: string;
  item: BalanceItem;
  stats: StatValue[];
  /** Weapons: average damage × attack speed; armour: armor + magic resist. */
  power: number | null;
};

const ARMOR_SLOTS = new Set<ItemEquipTo>([
  ItemEquipTo.head,
  ItemEquipTo.pauldrons,
  ItemEquipTo.chest,
  ItemEquipTo.bracers,
  ItemEquipTo.gloves,
  ItemEquipTo.greaves,
  ItemEquipTo.boots,
  ItemEquipTo.belt,
  ItemEquipTo.offhand,
]);

// Combat-relevant slots; rings take two.
const COMBAT_SLOTS: Array<{ slot: string; equipTo: ItemEquipTo }> = [
  { slot: "weapon", equipTo: ItemEquipTo.weapon },
  { slot: "offhand", equipTo: ItemEquipTo.offhand },
  { slot: "head", equipTo: ItemEquipTo.head },
  { slot: "pauldrons", equipTo: ItemEquipTo.pauldrons },
  { slot: "chest", equipTo: ItemEquipTo.chest },
  { slot: "bracers", equipTo: ItemEquipTo.bracers },
  { slot: "gloves", equipTo: ItemEquipTo.gloves },
  { slot: "greaves", equipTo: ItemEquipTo.greaves },
  { slot: "boots", equipTo: ItemEquipTo.boots },
  { slot: "belt", equipTo: ItemEquipTo.belt },
  { slot: "necklace", equipTo: ItemEquipTo.necklace },
  { slot: "amulet", equipTo: ItemEquipTo.amulet },
  { slot: "ring 1", equipTo: ItemEquipTo.ring },
  { slot: "ring 2", equipTo: ItemEquipTo.ring },
];

export function itemPower(
  equipTo: ItemEquipTo | null,
  stats: readonly StatValue[],
): number | null {
  const get = (statType: StatType) =>
    stats.find((stat) => stat.statType === statType)?.value ?? 0;
  if (equipTo === ItemEquipTo.weapon) {
    const perHit =
      (get(StatType.PHYSICAL_DAMAGE_MIN) + get(StatType.PHYSICAL_DAMAGE_MAX)) / 2 +
      (get(StatType.MAGIC_DAMAGE_MIN) + get(StatType.MAGIC_DAMAGE_MAX)) / 2;
    return perHit * (get(StatType.ATTACK_SPEED) || 1);
  }
  if (equipTo && ARMOR_SLOTS.has(equipTo)) {
    return get(StatType.ARMOR) + get(StatType.MAGIC_RESIST);
  }
  return null;
}

/** An item's stats and power at one rarity. */
export function resolveGearPiece(
  item: BalanceItem,
  rarity: ItemRarity,
  multiplier: number,
  slot = item.equipTo ?? "",
): GearPiece | null {
  if (!item.balance || !item.equipTo) return null;
  const stats = resolveEffectiveItemStats({
    rarity,
    rarityMultiplier: multiplier,
    flipNegativeStatsWithRarity: item.balance.flip,
    equipTo: item.equipTo,
    stats: item.balance.stats,
    statProgressions: item.balance.progressions,
    statRarityOverrides: item.balance.overrides,
  });
  return { slot, item, stats, power: itemPower(item.equipTo, stats) };
}

export type GearChoice = { rarity: ItemRarity; multiplier: number } | null;

/**
 * The gear a player of this level would wear: in each slot the strongest
 * item it may equip (by power), or the highest-level one where power isn't
 * comparable (jewellery). A two-handed weapon leaves the off hand empty.
 */
export function gearForLevel(
  content: BalanceContent,
  level: number,
  choice: GearChoice,
): GearPiece[] {
  if (!choice) return [];
  const pieces: GearPiece[] = [];
  for (const { slot, equipTo } of COMBAT_SLOTS) {
    if (slot === "offhand" && pieces.find((piece) => piece.slot === "weapon")?.item.twoHanded) {
      continue;
    }
    let best: GearPiece | null = null;
    for (const item of content.items) {
      if (item.equipTo !== equipTo || item.requiredLevel > level) continue;
      const piece = resolveGearPiece(item, choice.rarity, choice.multiplier, slot);
      if (!piece) continue;
      const better =
        !best ||
        (piece.power !== null && best.power !== null
          ? piece.power > best.power ||
            (piece.power === best.power && item.requiredLevel > best.item.requiredLevel)
          : item.requiredLevel > best.item.requiredLevel);
      if (better) best = piece;
    }
    if (best) pieces.push(best);
  }
  return pieces;
}

export function combatAtLevel(
  content: BalanceContent,
  level: number,
  gear: readonly GearPiece[],
): DungeonCombatSnapshot {
  const base = calculateLevelBaseStats(level, content.statGrowth);
  const equipment = aggregateStatValues(gear.flatMap((piece) => piece.stats));
  const weapon = gear.find((piece) => piece.slot === "weapon");
  const offhand = gear.find((piece) => piece.slot === "offhand");
  equipment[StatType.ATTACK_SPEED] += weaponAttackSpeedAdjustment(
    weapon?.stats,
    content.statGrowth[StatType.ATTACK_SPEED].baseValue,
    offhand ? { equipTo: offhand.item.equipTo, stats: offhand.stats } : null,
  );
  return combatSnapshotFromStats(
    calculateFinalStatsFromTotals(combineStatRecords(base, equipment)),
  );
}

export type SurvivalResult = { rate: number; averageDamage: number; runs: number };

/**
 * Share of runs a character survives, starting at full health. A fixed seed
 * keeps results stable between renders. Stops early once `target` can no
 * longer be reached, which keeps hopeless level searches cheap.
 */
export function dungeonSurvival(
  dungeon: BalanceDungeon,
  combat: DungeonCombatSnapshot,
  iterations: number,
  target = 0,
): SurvivalResult {
  const random = createExpeditionRandom(`balance:${dungeon.id}`);
  const allowedDeaths = Math.floor(iterations * (1 - target));
  let cleared = 0;
  let damage = 0;
  let runs = 0;
  for (; runs < iterations; runs += 1) {
    const { report } = resolveDungeonRun({
      pool: dungeon.monsters,
      combat,
      packSize: dungeon.packSize,
      startingHealth: combat.maxHealth,
      deathRules: { keepChance: 0, quantityPercent: 0 },
      random,
    });
    damage += report.damageTaken;
    if (report.outcome === "CLEARED") cleared += 1;
    if (target > 0 && runs + 1 - cleared > allowedDeaths) {
      runs += 1;
      break;
    }
  }
  return { rate: cleared / runs, averageDamage: damage / runs, runs };
}

/**
 * The lowest level that survives `target` of runs, assuming survival only
 * improves with level. Null when even `maxLevel` falls short.
 */
export function lowestSurvivingLevel(
  dungeon: BalanceDungeon,
  combatFor: (level: number) => DungeonCombatSnapshot,
  target: number,
  maxLevel: number,
  iterations: number,
): number | null {
  const survives = (level: number) =>
    dungeonSurvival(dungeon, combatFor(level), iterations, target).rate >= target;
  if (!survives(maxLevel)) return null;
  let low = 1;
  let high = maxLevel;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (survives(mid)) high = mid;
    else low = mid + 1;
  }
  return low;
}
