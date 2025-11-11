"use client";

import { useMemo } from "react";
import {
  StatType,
  StatCategory,
  ComputedStats,
  STAT_METADATA,
} from "~/types/stats";
import {
  calculateFinalStats,
  formatStatValue,
  calculateEquipmentBonuses,
} from "~/utils/stats";
import { Card, CardContent, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { useEquipmentContext } from "~/context/equipmentContext";

interface CharacterStatsProps {
  baseStats: Array<{ statType: StatType; value: number }>;
}

export const CharacterStats = ({ baseStats }: CharacterStatsProps) => {
  // Get real-time equipment from global Equipment context
  const { equipment } = useEquipmentContext();

  // Convert array format to Record format
  const baseStatsRecord = useMemo(() => {
    const record: Partial<Record<StatType, number>> = {};
    baseStats.forEach((stat) => {
      record[stat.statType] = stat.value;
    });
    return record as Record<StatType, number>;
  }, [baseStats]);

  // Calculate equipment bonuses from current equipment (updates in real-time)
  const equipmentStatsRecord = useMemo(() => {
    const bonuses = calculateEquipmentBonuses(equipment);
    return bonuses;
  }, [equipment]);

  const finalStats = useMemo(
    () => calculateFinalStats(baseStatsRecord, equipmentStatsRecord),
    [baseStatsRecord, equipmentStatsRecord],
  );

  // Map ComputedStats camelCase keys to StatType enum values
  const statKeyToEnumMap: Record<keyof ComputedStats, StatType> = {
    minPhysicalDamage: StatType.PHYSICAL_DAMAGE_MIN,
    maxPhysicalDamage: StatType.PHYSICAL_DAMAGE_MAX,
    minMagicDamage: StatType.MAGIC_DAMAGE_MIN,
    maxMagicDamage: StatType.MAGIC_DAMAGE_MAX,
    criticalChance: StatType.CRITICAL_CHANCE,
    criticalDamage: StatType.CRITICAL_DAMAGE,
    attackSpeed: StatType.ATTACK_SPEED,
    accuracy: StatType.ACCURACY,
    armor: StatType.ARMOR,
    magicResist: StatType.MAGIC_RESIST,
    evasionMelee: StatType.EVASION_MELEE,
    evasionRanged: StatType.EVASION_RANGED,
    evasionMagic: StatType.EVASION_MAGIC,
    blockChance: StatType.BLOCK_CHANCE,
    fireResist: StatType.FIRE_RESIST,
    coldResist: StatType.COLD_RESIST,
    lightningResist: StatType.LIGHTNING_RESIST,
    poisonResist: StatType.POISON_RESIST,
    health: StatType.HEALTH,
    mana: StatType.MANA,
    healthRegen: StatType.HEALTH_REGEN,
    manaRegen: StatType.MANA_REGEN,
    prayerPoints: StatType.PRAYER_POINTS,
    movementSpeed: StatType.MOVEMENT_SPEED,
    luck: StatType.LUCK,
    goldFind: StatType.GOLD_FIND,
    experienceGain: StatType.EXPERIENCE_GAIN,
    lifesteal: StatType.LIFESTEAL,
    thorns: StatType.THORNS,
  };

  // Group stats by category
  const statsByCategory = useMemo(() => {
    const categories = new Map<StatCategory, Array<[StatType, number]>>();

    Object.entries(finalStats).forEach(([camelCaseKey, value]) => {
      const statType = statKeyToEnumMap[camelCaseKey as keyof ComputedStats];
      const metadata = STAT_METADATA[statType];
      if (!metadata) return;

      if (!categories.has(metadata.category)) {
        categories.set(metadata.category, []);
      }
      categories.get(metadata.category)!.push([statType, value]);
    });

    // Sort stats within each category by priority
    categories.forEach((stats) => {
      stats.sort((a, b) => {
        const priorityA = STAT_METADATA[a[0]].priority;
        const priorityB = STAT_METADATA[b[0]].priority;
        return priorityA - priorityB;
      });
    });

    return categories;
  }, [finalStats]);

  const renderStatCategory = (
    category: StatCategory,
    title: string,
    stats: Array<[StatType, number]>,
  ) => {
    if (stats.length === 0) return null;

    return (
      <div className="mb-4">
        <h3 className="mb-2 text-sm font-semibold uppercase text-gray-400">
          {title}
        </h3>
        <div className="space-y-1">
          {stats.map(([statType, value]) => {
            const metadata = STAT_METADATA[statType];
            if (!metadata) return null;

            // Don't display stats with 0 value (unless it's a base stat)
            // if (value === 0 && !isBaseStat(statType)) return null;

            return (
              <div
                key={statType}
                className="flex items-center justify-between gap-8 text-sm"
                style={value === 0 ? { opacity: 0.2, fontWeight: 'normal' } : { opacity: 1, fontWeight: 'bold' }}
              >
                <div className="flex items-center gap-2">
                  <span>{metadata.icon}</span>
                  <span style={{ color: metadata.color }}>
                    {metadata.label}
                  </span>
                </div>
                <span className="font-medium" style={{ color: metadata.color }}>
                  {formatStatValue(value, statType)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="mb-6 w-full border border-white/10 bg-white/5 p-2">
      <CardContent className="p-2">
        <CardTitle className="mb-4 text-lg font-bold">
          Character Stats
        </CardTitle>
        <Separator className="mb-4" />
        <div className="flex flex-col justify-between gap-6 md:flex-row">
          {renderStatCategory(
            StatCategory.CHARACTER,
            "Character",
            statsByCategory.get(StatCategory.CHARACTER) || [],
          )}

          {renderStatCategory(
            StatCategory.OFFENSIVE,
            "Offensive",
            statsByCategory.get(StatCategory.OFFENSIVE) || [],
          )}

          {renderStatCategory(
            StatCategory.DEFENSIVE,
            "Defensive",
            statsByCategory.get(StatCategory.DEFENSIVE) || [],
          )}

          {renderStatCategory(
            StatCategory.RESISTANCE,
            "Resistance",
            statsByCategory.get(StatCategory.RESISTANCE) || [],
          )}

          {renderStatCategory(
            StatCategory.SPECIAL,
            "Special",
            statsByCategory.get(StatCategory.SPECIAL) || [],
          )}
        </div>
      </CardContent>
    </Card>
  );
};
