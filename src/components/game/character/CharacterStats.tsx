"use client";

import { useMemo } from "react";
import {
  ChevronRight,
  Droplets,
  Heart,
  Sparkles,
  Swords,
  type LucideIcon,
} from "lucide-react";
import {
  StatType,
  StatCategory,
  type ComputedStats,
  STAT_METADATA,
} from "~/types/stats";
import {
  COMPUTED_STAT_TYPE_MAP,
  calculateFinalStats,
  calculateEquipmentBonuses,
} from "~/utils/stats";
import { useEquipmentContext } from "~/context/equipmentContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useActiveFoodEffect } from "~/hooks/use-active-food-effect";
import { Button } from "~/components/ui/button";
import { ResponsiveModal } from "~/components/ui/responsive-modal";

interface CharacterStatsProps {
  baseStats: Array<{ statType: StatType; value: number }>;
  currentHealth?: number;
}

type StatRow = {
  key: string;
  label: string;
  value: string;
  description: string;
  isZero: boolean;
  statTypes: StatType[];
};

type CoreStat = {
  label: string;
  value: string;
  description: string;
  tone: string;
  icon: LucideIcon;
  statTypes: StatType[];
};

const CATEGORY_ORDER = [
  { category: StatCategory.CHARACTER, label: "Vitals" },
  { category: StatCategory.OFFENSIVE, label: "Offense" },
  { category: StatCategory.DEFENSIVE, label: "Defense" },
  { category: StatCategory.RESISTANCE, label: "Resistances" },
  { category: StatCategory.SPECIAL, label: "Utility & vocations" },
] as const;

function formatTotalValue(value: number, statType: StatType) {
  const metadata = STAT_METADATA[statType];

  if (metadata.formatType === "percentage") return `${value.toFixed(1)}%`;
  if (metadata.formatType === "decimal") return value.toFixed(2);
  return Math.floor(value).toString();
}

function formatDamageRange(minimum: number, maximum: number) {
  return `${Math.floor(minimum)}–${Math.floor(maximum)}`;
}

function getCategoryRows(stats: Array<[StatType, number]>): StatRow[] {
  const values = new Map(stats);
  const rows: StatRow[] = [];
  const rangePairs = [
    {
      minimum: StatType.PHYSICAL_DAMAGE_MIN,
      maximum: StatType.PHYSICAL_DAMAGE_MAX,
      label: "Physical damage",
      description: "Minimum to maximum physical damage per hit",
    },
    {
      minimum: StatType.MAGIC_DAMAGE_MIN,
      maximum: StatType.MAGIC_DAMAGE_MAX,
      label: "Magic damage",
      description: "Minimum to maximum magic damage per hit",
    },
  ];
  const consumed = new Set<StatType>();

  for (const pair of rangePairs) {
    const minimum = values.get(pair.minimum);
    const maximum = values.get(pair.maximum);
    if (minimum === undefined || maximum === undefined) continue;

    rows.push({
      key: `${pair.minimum}-${pair.maximum}`,
      label: pair.label,
      value: formatDamageRange(minimum, maximum),
      description: pair.description,
      isZero: minimum === 0 && maximum === 0,
      statTypes: [pair.minimum, pair.maximum],
    });
    consumed.add(pair.minimum);
    consumed.add(pair.maximum);
  }

  for (const [statType, value] of stats) {
    if (consumed.has(statType)) continue;
    const metadata = STAT_METADATA[statType];
    rows.push({
      key: statType,
      label: metadata.label,
      value: formatTotalValue(value, statType),
      description: metadata.description,
      isZero: value === 0,
      statTypes: [statType],
    });
  }

  return rows;
}

export const CharacterStats = ({
  baseStats,
  currentHealth,
}: CharacterStatsProps) => {
  const { equipment } = useEquipmentContext();
  const { effect: activeFoodEffect } = useActiveFoodEffect();

  const baseStatsRecord = useMemo(() => {
    const record: Partial<Record<StatType, number>> = {};
    baseStats.forEach((stat) => {
      record[stat.statType] = stat.value;
    });
    return record as Record<StatType, number>;
  }, [baseStats]);

  const equipmentStatsRecord = useMemo(
    () => calculateEquipmentBonuses(equipment),
    [equipment],
  );

  const foodStatsRecord = useMemo(() => {
    const bonuses: Partial<Record<StatType, number>> = {};
    for (const stat of activeFoodEffect?.item.foodEffectStats ?? []) {
      bonuses[stat.statType] = (bonuses[stat.statType] ?? 0) + stat.value;
    }
    return bonuses;
  }, [activeFoodEffect]);

  const finalStats = useMemo(
    () =>
      calculateFinalStats(
        baseStatsRecord,
        equipmentStatsRecord,
        foodStatsRecord,
      ),
    [baseStatsRecord, equipmentStatsRecord, foodStatsRecord],
  );

  const categoryRows = useMemo(() => {
    const grouped = new Map<StatCategory, Array<[StatType, number]>>();

    (
      Object.entries(finalStats) as Array<[keyof ComputedStats, number]>
    ).forEach(([computedKey, value]) => {
      const statType = COMPUTED_STAT_TYPE_MAP[computedKey];
      const metadata = STAT_METADATA[statType];
      const category = metadata.category;
      const categoryStats = grouped.get(category) ?? [];
      categoryStats.push([statType, value]);
      grouped.set(category, categoryStats);
    });

    return CATEGORY_ORDER.map(({ category, label }) => {
      const stats = grouped.get(category) ?? [];
      stats.sort(
        (a, b) => STAT_METADATA[a[0]].priority - STAT_METADATA[b[0]].priority,
      );
      return { category, label, rows: getCategoryRows(stats) };
    }).filter(({ rows }) => rows.length > 0);
  }, [finalStats]);

  const coreStats: CoreStat[] = [
    {
      label: "Health",
      value:
        typeof currentHealth === "number"
          ? `${Math.floor(Math.min(currentHealth, finalStats.health))}/${Math.floor(finalStats.health)}`
          : Math.floor(finalStats.health).toString(),
      description: STAT_METADATA[StatType.HEALTH].description,
      tone: "health",
      icon: Heart,
      statTypes: [StatType.HEALTH],
    },
    {
      label: "Mana",
      value: Math.floor(finalStats.mana).toString(),
      description: STAT_METADATA[StatType.MANA].description,
      tone: "mana",
      icon: Droplets,
      statTypes: [StatType.MANA],
    },
    {
      label: "Physical",
      value: formatDamageRange(
        finalStats.minPhysicalDamage,
        finalStats.maxPhysicalDamage,
      ),
      description: "Minimum to maximum physical damage per hit",
      tone: "physical",
      icon: Swords,
      statTypes: [StatType.PHYSICAL_DAMAGE_MIN, StatType.PHYSICAL_DAMAGE_MAX],
    },
    {
      label: "Magic",
      value: formatDamageRange(
        finalStats.minMagicDamage,
        finalStats.maxMagicDamage,
      ),
      description: "Minimum to maximum magic damage per hit",
      tone: "magic",
      icon: Sparkles,
      statTypes: [StatType.MAGIC_DAMAGE_MIN, StatType.MAGIC_DAMAGE_MAX],
    },
    // {
    //   label: "Armor",
    //   value: Math.floor(finalStats.armor).toString(),
    //   description: STAT_METADATA[StatType.ARMOR].description,
    //   tone: "armor",
    //   icon: Shield,
    // },
    // {
    //   label: "Capacity",
    //   value: Math.floor(finalStats.carryingCapacity).toString(),
    //   description: STAT_METADATA[StatType.CARRYING_CAPACITY].description,
    //   tone: "capacity",
    //   icon: Backpack,
    // },
  ];
  const detailedStatCount = categoryRows.reduce(
    (count, category) => count + category.rows.length,
    0,
  );

  const boostedStatTypes = new Set(
    activeFoodEffect?.item.foodEffectStats.map((effect) => effect.statType),
  );

  const attributeSource = activeFoodEffect ? "Gear + meal" : "Gear included";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="game-core-stats" aria-label="Core attributes">
        {coreStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Tooltip key={stat.label}>
              <TooltipTrigger asChild>
                <div
                  className="game-core-stat"
                  data-tone={stat.tone}
                  tabIndex={0}
                >
                  <span className="game-core-stat-icon">
                    <Icon className="h-4 w-4" aria-hidden={true} />
                  </span>
                  <span className="min-w-0">
                    <span className="game-core-stat-label">{stat.label}</span>
                    <strong
                      className={`game-core-stat-value ${stat.statTypes.some((type) => boostedStatTypes.has(type)) ? "text-primary" : ""}`}
                    >
                      {stat.value}
                    </strong>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                {stat.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="game-attributes-actions">
        <ResponsiveModal
          title="Attributes"
          description={`${detailedStatCount} values by category · ${attributeSource}`}
          className="sm:max-w-3xl"
          trigger={
            <Button variant="ghost" size="sm">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          }
        >
          <div className="game-attribute-categories">
            {categoryRows.map(({ category, label, rows }) => (
              <section className="game-attribute-category" key={category}>
                <h3>{label}</h3>
                <div>
                  {rows.map((row) => (
                    <Tooltip key={row.key}>
                      <TooltipTrigger asChild>
                        <div
                          className="game-attribute-row"
                          data-zero={row.isZero}
                          tabIndex={0}
                        >
                          <span>{row.label}</span>
                          <strong
                            className={
                              row.statTypes.some((type) =>
                                boostedStatTypes.has(type),
                              )
                                ? "!text-primary"
                                : undefined
                            }
                          >
                            {row.value}
                          </strong>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px]">
                        {row.description}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ResponsiveModal>
      </div>
    </TooltipProvider>
  );
};
