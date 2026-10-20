"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { StatType, ComputedStats } from "~/types/stats";
import {
  COMPUTED_STAT_TYPE_MAP,
  calculateEquipmentBonuses,
  calculateFinalStats,
  combineStatRecords,
} from "~/utils/stats";
import { useEquipmentContext } from "~/context/equipmentContext";
import {
  useActiveFoodEffect,
  type ActiveFoodEffect,
} from "~/hooks/use-active-food-effect";
import { roundStat } from "./stat-display";

type StatRecord = Record<StatType, number>;

export type CharacterSheet = {
  /** Level-scaled base stats plus per-character additions. */
  base: StatRecord;
  gear: StatRecord;
  meal: Partial<StatRecord>;
  /** Base + gear + meal before caps. */
  totals: StatRecord;
  /** After caps and minimums: what the character fights with. */
  final: StatRecord;
  computed: ComputedStats;
  /** What the last equipment change did to each shown value; clears after a moment. */
  changes: Partial<StatRecord>;
  mealEffect: ActiveFoodEffect | null;
};

const CharacterSheetContext = createContext<CharacterSheet | null>(null);

export function useCharacterSheet() {
  const sheet = useContext(CharacterSheetContext);
  if (!sheet) {
    throw new Error(
      "useCharacterSheet must be used within CharacterSheetProvider",
    );
  }
  return sheet;
}

const CHANGE_VISIBLE_MS = 2800;

/** Diffs the shown values whenever the equipment itself changes, not when a meal loads or expires. */
function useEquipmentChanges(
  equipment: unknown,
  final: StatRecord,
): Partial<StatRecord> {
  const previous = useRef({ equipment, final });
  const timer = useRef<number>();
  const [changes, setChanges] = useState<Partial<StatRecord>>({});

  useEffect(() => {
    const before = previous.current;
    previous.current = { equipment, final };
    if (before.equipment === equipment) return;

    const next: Partial<StatRecord> = {};
    for (const stat of Object.keys(final) as StatType[]) {
      const change =
        roundStat(stat, final[stat]) - roundStat(stat, before.final[stat]);
      if (Math.abs(change) > 1e-9) next[stat] = change;
    }
    if (Object.keys(next).length === 0) return;

    setChanges(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setChanges({}), CHANGE_VISIBLE_MS);
  }, [equipment, final]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return changes;
}

export function CharacterSheetProvider({
  baseStats,
  unarmedAttackSpeed,
  children,
}: {
  baseStats: StatRecord;
  /** Level 1 Attack Speed, which an equipped weapon's own speed replaces. */
  unarmedAttackSpeed: number;
  children: ReactNode;
}) {
  const { equipment } = useEquipmentContext();
  const { effect: mealEffect } = useActiveFoodEffect();

  const gear = useMemo(
    () => calculateEquipmentBonuses(equipment, unarmedAttackSpeed),
    [equipment, unarmedAttackSpeed],
  );

  const meal = useMemo(() => {
    const bonuses: Partial<StatRecord> = {};
    for (const stat of mealEffect?.item.foodEffectStats ?? []) {
      bonuses[stat.statType] = (bonuses[stat.statType] ?? 0) + stat.value;
    }
    return bonuses;
  }, [mealEffect]);

  const { totals, computed, final } = useMemo(() => {
    const computed = calculateFinalStats(baseStats, gear, meal);
    const final = {} as StatRecord;
    for (const [key, stat] of Object.entries(COMPUTED_STAT_TYPE_MAP)) {
      final[stat] = computed[key as keyof ComputedStats];
    }
    return {
      totals: combineStatRecords(baseStats, gear, meal),
      computed,
      final,
    };
  }, [baseStats, gear, meal]);

  const changes = useEquipmentChanges(equipment, final);

  const sheet = useMemo(
    () => ({
      base: baseStats,
      gear,
      meal,
      totals,
      final,
      computed,
      changes,
      mealEffect,
    }),
    [baseStats, gear, meal, totals, final, computed, changes, mealEffect],
  );

  return (
    <CharacterSheetContext.Provider value={sheet}>
      {children}
    </CharacterSheetContext.Provider>
  );
}

/**
 * Another player's sheet, resolved on the server: nothing to equip or eat
 * here, so it never changes while the page is open.
 */
export function StaticCharacterSheetProvider({
  sheet,
  children,
}: {
  sheet: Omit<CharacterSheet, "final" | "changes">;
  children: ReactNode;
}) {
  const value = useMemo(() => {
    const final = {} as StatRecord;
    for (const [key, stat] of Object.entries(COMPUTED_STAT_TYPE_MAP)) {
      final[stat] = sheet.computed[key as keyof ComputedStats];
    }
    return { ...sheet, final, changes: {} };
  }, [sheet]);

  return (
    <CharacterSheetContext.Provider value={value}>
      {children}
    </CharacterSheetContext.Provider>
  );
}
