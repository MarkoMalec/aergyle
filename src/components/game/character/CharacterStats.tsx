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
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { useEquipmentContext } from "~/context/equipmentContext";
import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface CharacterStatsProps {
  baseStats: Array<{ statType: StatType; value: number }>;
}

export const CharacterStats = ({ baseStats }: CharacterStatsProps) => {
  const { equipment } = useEquipmentContext();

  const baseStatsRecord = useMemo(() => {
    const record: Partial<Record<StatType, number>> = {};
    baseStats.forEach((stat) => {
      record[stat.statType] = stat.value;
    });
    return record as Record<StatType, number>;
  }, [baseStats]);

  const equipmentStatsRecord = useMemo(() => {
    const bonuses = calculateEquipmentBonuses(equipment);
    return bonuses;
  }, [equipment]);

  const finalStats = useMemo(
    () => calculateFinalStats(baseStatsRecord, equipmentStatsRecord),
    [baseStatsRecord, equipmentStatsRecord],
  );

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
    woodcuttingEfficiency: StatType.WOODCUTTING_EFFICIENCY,
    miningEfficiency: StatType.MINING_EFFICIENCY,
    fishingEfficiency: StatType.FISHING_EFFICIENCY,
  };

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

  const renderStatCategory = (title: string, stats: Array<[StatType, number]>) => {
    if (stats.length === 0) return null;

    return (
      <div className="rounded-lg border border-gray-700/40 bg-gray-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
            {title}
          </div>
          <div className="text-[11px] text-white/40 tabular-nums">
            {stats.length}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(([statType, value]) => {
            const metadata = STAT_METADATA[statType];
            if (!metadata) return null;

            const isZero = value === 0;
            const label = metadata.shortLabel ?? metadata.label;

            return (
              <Tooltip key={statType}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "flex cursor-default items-center justify-between gap-3 rounded-md border border-gray-700/40 bg-gray-700/20 px-3 py-2",
                      isZero ? "opacity-40" : "opacity-100",
                    )}
                    aria-label={metadata.label}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-sm">{metadata.icon}</span>
                      <span className="truncate text-[13px] text-white/80">
                        {label}
                      </span>
                    </div>

                    <span
                      className="shrink-0 font-mono text-[13px] font-semibold tabular-nums"
                      style={{ color: metadata.color }}
                    >
                      {formatStatValue(value, statType)}
                    </span>
                  </div>
                </TooltipTrigger>

                <TooltipContent side="top" className="max-w-[260px]">
                  {metadata.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className="my-8 w-full border border-gray-700/40 bg-gray-800/40 shadow-none">
      <CardContent className="p-4">
        <Separator className="mb-4 text-sm">CHARACTER STATS</Separator>

        <TooltipProvider delayDuration={150}>
          <div className="flex flex-col gap-4">
            {renderStatCategory(
              "Character",
              statsByCategory.get(StatCategory.CHARACTER) || [],
            )}
            {renderStatCategory(
              "Offensive",
              statsByCategory.get(StatCategory.OFFENSIVE) || [],
            )}
            {renderStatCategory(
              "Defensive",
              statsByCategory.get(StatCategory.DEFENSIVE) || [],
            )}
            {renderStatCategory(
              "Resistance",
              statsByCategory.get(StatCategory.RESISTANCE) || [],
            )}
            {renderStatCategory(
              "Special",
              statsByCategory.get(StatCategory.SPECIAL) || [],
            )}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
