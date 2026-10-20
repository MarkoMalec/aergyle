import { STAT_METADATA, StatType, type ItemWithStats } from "~/types/stats";
import {
  canEquipToSlot,
  getDisplacedHand,
  getQuickEquipSlot,
} from "~/utils/inventoryClient";
import { EQUIPMENT_SLOT_KEYS, type EquipmentSlotKey } from "~/utils/itemEquipTo";
import { formatStatValue } from "~/utils/stats";

/**
 * Client-safe helpers for comparing an item with what the player wears.
 * Every stat counts as higher-is-better, the same as the character sheet.
 */

type StatLine = { statType: StatType; value: number };
type CompareItem = Pick<ItemWithStats, "equipTo" | "twoHanded">;
type WornItem = Pick<ItemWithStats, "twoHanded"> & { stats: StatLine[] };
type WornEquipment = Partial<Record<EquipmentSlotKey, WornItem | null>>;

export type StatDirection = "up" | "down" | "same";

export interface StatComparisonRow {
  /** The stat type; a damage range uses its MIN stat. */
  key: StatType;
  label: string;
  /** The value as the item card shows it, null when the item lacks the stat. */
  item: string | null;
  equipped: string | null;
  /** The signed change equipping makes, e.g. "+12" or "−0.5%"; null when none shows. */
  change: string | null;
  direction: StatDirection;
}

export const SLOT_LABELS: Record<EquipmentSlotKey, string> = {
  head: "Head",
  necklace: "Neck",
  pauldrons: "Shoulders",
  chest: "Chest",
  bracers: "Bracers",
  gloves: "Hands",
  greaves: "Legs",
  boots: "Feet",
  belt: "Belt",
  ring1: "Ring I",
  ring2: "Ring II",
  amulet: "Amulet",
  backpack: "Backpack",
  weapon: "Main hand",
  offhand: "Off hand",
  fellingAxe: "Felling axe",
  pickaxe: "Pickaxe",
  fishingRod: "Fishing rod",
  hoe: "Hoe",
};

/** Damage ranges compare by their average hit, shown as one row like the card. */
const DAMAGE_RANGES = [
  {
    label: "Physical Damage",
    min: StatType.PHYSICAL_DAMAGE_MIN,
    max: StatType.PHYSICAL_DAMAGE_MAX,
  },
  {
    label: "Magic Damage",
    min: StatType.MAGIC_DAMAGE_MIN,
    max: StatType.MAGIC_DAMAGE_MAX,
  },
] as const;

function sumStats(stats: readonly StatLine[]) {
  const totals = new Map<StatType, number>();
  for (const { statType, value } of stats) {
    if (!Number.isFinite(value)) continue;
    totals.set(statType, (totals.get(statType) ?? 0) + value);
  }
  return totals;
}

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** The value the card prints, so a change only shows when the text changes. */
function displayedValue(statType: StatType, value: number) {
  switch (STAT_METADATA[statType].formatType) {
    case "percentage":
      return Math.round(value * 10) / 10;
    case "decimal":
      return round2(value);
    default:
      return Math.floor(value);
  }
}

function formatChange(change: number, magnitude: string) {
  return `${change > 0 ? "+" : "−"}${magnitude}`;
}

function formatStatChange(statType: StatType, change: number) {
  const magnitude = Math.abs(change);
  switch (STAT_METADATA[statType].formatType) {
    case "percentage":
      return formatChange(change, `${magnitude.toFixed(1)}%`);
    case "decimal":
      return formatChange(change, magnitude.toFixed(2));
    default:
      return formatChange(
        change,
        new Intl.NumberFormat("en-US").format(magnitude),
      );
  }
}

function direction(change: number): StatDirection {
  return change > 0 ? "up" : change < 0 ? "down" : "same";
}

/**
 * One row per stat either side has, in card order. `equippedStats` holds
 * everything equipping would take off: the slot's item, plus the other hand
 * when a two-handed weapon is involved.
 */
export function compareItemStats(
  itemStats: readonly StatLine[],
  equippedStats: readonly StatLine[],
): StatComparisonRow[] {
  const mine = sumStats(itemStats);
  const worn = sumStats(equippedStats);
  const rows: Array<StatComparisonRow & { priority: number }> = [];
  const handled = new Set<StatType>();

  for (const range of DAMAGE_RANGES) {
    handled.add(range.min);
    handled.add(range.max);
    const side = (totals: Map<StatType, number>) => {
      const min = totals.get(range.min) ?? 0;
      const max = totals.get(range.max) ?? 0;
      if (min <= 0 && max <= 0) return null;
      return {
        text: `${round2(min).toFixed(2)}-${round2(max).toFixed(2)}`,
        average: round2((min + max) / 2),
      };
    };
    const a = side(mine);
    const b = side(worn);
    if (!a && !b) continue;
    const change = round2((a?.average ?? 0) - (b?.average ?? 0));
    rows.push({
      key: range.min,
      label: range.label,
      item: a?.text ?? null,
      equipped: b?.text ?? null,
      change: change ? formatChange(change, Math.abs(change).toFixed(2)) : null,
      direction: direction(change),
      priority: STAT_METADATA[range.min].priority,
    });
  }

  const statTypes = new Set([...mine.keys(), ...worn.keys()]);
  for (const statType of statTypes) {
    if (handled.has(statType)) continue;
    const a = mine.get(statType) ?? 0;
    const b = worn.get(statType) ?? 0;
    // Cards hide zero stats, so a stat at zero on both sides has no row.
    if (a === 0 && b === 0) continue;
    const change = round2(
      displayedValue(statType, a) - displayedValue(statType, b),
    );
    rows.push({
      key: statType,
      label: STAT_METADATA[statType].label,
      item: a === 0 ? null : formatStatValue(a, statType),
      equipped: b === 0 ? null : formatStatValue(b, statType),
      change: change ? formatStatChange(statType, change) : null,
      direction: direction(change),
      priority: STAT_METADATA[statType].priority,
    });
  }

  return rows
    .sort((x, y) => x.priority - y.priority)
    .map(({ priority: _priority, ...row }) => row);
}

/** What equipping `item` in `slot` takes off: the slot's item and a blocked other hand. */
export function getReplacedItems<T extends WornItem>(
  item: CompareItem,
  slot: EquipmentSlotKey,
  equipment: Partial<Record<EquipmentSlotKey, T | null>>,
) {
  const current = equipment[slot] ?? null;
  const otherHand = getDisplacedHand(
    {
      weapon: slot === "weapon" ? item : equipment.weapon,
      offhand: slot === "offhand" ? item : equipment.offhand,
    },
    slot,
  );
  const blocked = otherHand ? equipment[otherHand] ?? null : null;
  return {
    current,
    displaced:
      otherHand && blocked ? { slot: otherHand, item: blocked } : null,
  };
}

export function countChanges(rows: readonly StatComparisonRow[]) {
  return {
    better: rows.filter((row) => row.direction === "up").length,
    worse: rows.filter((row) => row.direction === "down").length,
  };
}

/**
 * The slots an item can be compared against, and the one to open on: where
 * Equip would put it, or, with both rings taken, the ring it improves most.
 */
export function getCompareSlots(
  item: CompareItem & { stats: StatLine[] },
  equipment: WornEquipment,
): { slots: EquipmentSlotKey[]; initial: EquipmentSlotKey } | null {
  const slots = EQUIPMENT_SLOT_KEYS.filter((slot) =>
    canEquipToSlot(item, slot),
  );
  const [first] = slots;
  if (!first) return null;

  const quick = getQuickEquipSlot(item, equipment);
  if (quick && slots.includes(quick)) return { slots, initial: quick };

  let initial = first;
  let best = -Infinity;
  for (const slot of slots) {
    const { current, displaced } = getReplacedItems(item, slot, equipment);
    const { better, worse } = countChanges(
      compareItemStats(item.stats, [
        ...(current?.stats ?? []),
        ...(displaced?.item.stats ?? []),
      ]),
    );
    if (better - worse > best) {
      best = better - worse;
      initial = slot;
    }
  }
  return { slots, initial };
}
