import { z } from "zod";
import {
  type ItemEquipTo,
  ItemRarity,
  ItemStatRarityOverrideKind,
  ItemType,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { getVocationalEfficiencyStatType } from "~/game/vocationStats";
import { STAT_METADATA } from "~/types/stats";
import { statScalesWithRarity } from "~/utils/itemInstanceStats";

const ITEM_RARITY_VALUES = Object.values(ItemRarity) as [
  ItemRarity,
  ...ItemRarity[],
];

const ITEM_TYPE_VALUES = Object.values(ItemType) as [ItemType, ...ItemType[]];

export type ToolEfficiencyRow = {
  actionType: VocationalActionType;
  baseEfficiency: number;
};

export type StatProgressionRow = {
  statType: StatType;
  baseValue: number;
  unlocksAtRarity: ItemRarity;
};

export type BaseStatRow = {
  statType: StatType;
  value: number;
  maxValue?: number | null;
};

export type StatRarityOverrideRow = {
  statType: StatType;
  rarity: ItemRarity;
  kind: ItemStatRarityOverrideKind;
  value: number;
};

export type FoodEffectStatRow = {
  statType: StatType;
  value: number;
};

export type RarityConfigPreview = {
  rarity: ItemRarity;
  statMultiplier: number;
  sortOrder: number;
  displayName?: string;
  color?: string;
};

export type ParsedRows<Row> = { rows: Row[]; error: string | null };

/** How one balance table is read from and written to its CSV form field. */
export type CsvCodec<Row> = {
  parse: (csv: string) => ParsedRows<Row>;
  toCsv: (rows: Row[]) => string;
  /** The header line, shown as the format of the raw editor. */
  format: string;
  example: string;
};

/** Damage and armor have their own inputs and are saved as these stats. */
export const COMBAT_STAT_TYPES: ReadonlySet<StatType> = new Set([
  StatType.PHYSICAL_DAMAGE_MIN,
  StatType.PHYSICAL_DAMAGE_MAX,
  StatType.MAGIC_DAMAGE_MIN,
  StatType.MAGIC_DAMAGE_MAX,
  StatType.ARMOR,
]);

export const itemFormSchema = z.object({
  name: z.string().min(1, "Give the item a name"),
  sprite: z.string().min(1, "Add the path to its image"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price can't be negative"),
  rarity: z.enum(ITEM_RARITY_VALUES).default(ItemRarity.COMMON),
  itemType: z.enum(ITEM_TYPE_VALUES).nullable().optional(),
  // Seed / gardening configuration (used only when itemType = SEED)
  seedGrowSeconds: z.coerce
    .number()
    .int("Whole seconds only")
    .nullable()
    .optional(),
  seedYieldItemId: z.coerce.number().int().nullable().optional(),
  seedYieldMin: z.coerce
    .number()
    .int("Whole numbers only")
    .nullable()
    .optional(),
  seedYieldMax: z.coerce
    .number()
    .int("Whole numbers only")
    .nullable()
    .optional(),
  seedHarvestSeconds: z.coerce
    .number()
    .int("Whole seconds only")
    .nullable()
    .optional(),
  seedXp: z.coerce.number().int("Whole numbers only").nullable().optional(),
  healingAmount: z.coerce
    .number()
    .int("Whole numbers only")
    .nullable()
    .optional(),
  foodEffectSeconds: z.coerce
    .number()
    .int("Whole seconds only")
    .nullable()
    .optional(),
  equipTo: z.string().nullable().optional(),
  twoHanded: z.coerce.boolean().default(false),
  stackable: z.coerce.boolean().default(false),
  maxStackSize: z.coerce
    .number()
    .int("Whole numbers only")
    .min(1, "At least 1")
    .default(1),
  flipNegativeStatsWithRarity: z.coerce.boolean().default(false),
  minPhysicalDamage: z.coerce.number().nullable().optional(),
  maxPhysicalDamage: z.coerce.number().nullable().optional(),
  minMagicDamage: z.coerce.number().nullable().optional(),
  maxMagicDamage: z.coerce.number().nullable().optional(),
  armor: z.coerce.number().nullable().optional(),
  requiredLevel: z.coerce
    .number()
    .int("Whole levels only")
    .min(1, "Level starts at 1")
    .default(1),
  // Advanced (relationships)
  baseStatsCsv: z.string().optional(),
  toolEfficienciesCsv: z.string().optional(),
  statProgressionsCsv: z.string().optional(),
  statRarityOverridesCsv: z.string().optional(),
  foodEffectStatsCsv: z.string().optional(),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const CSV_FIELDS = [
  "baseStatsCsv",
  "toolEfficienciesCsv",
  "statProgressionsCsv",
  "statRarityOverridesCsv",
  "foodEffectStatsCsv",
] as const;

export type CsvField = (typeof CSV_FIELDS)[number];

export function parseCsvLines(input: string): string[] {
  return (input ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function safeParseFoodEffectStatsCsv(
  csv: string,
): ParsedRows<FoodEffectStatRow> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };
  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows: FoodEffectStatRow[] = [];
  const seen = new Set<StatType>();

  for (const [index, line] of lines.slice(startIndex).entries()) {
    const [statTypeRaw, valueRaw] = line.split(",").map((part) => part.trim());
    if (!statTypeRaw || !(statTypeRaw in StatType)) {
      return {
        rows: [],
        error: `Invalid food stat on row ${index + 1}: ${statTypeRaw ?? ""}`,
      };
    }
    const statType = statTypeRaw as StatType;
    const value = Number.parseFloat(valueRaw ?? "");
    if (!Number.isFinite(value)) {
      return { rows: [], error: `Invalid food value for ${statType}` };
    }
    if (seen.has(statType)) {
      return { rows: [], error: `Duplicate food stat: ${statType}` };
    }
    seen.add(statType);
    rows.push({ statType, value });
  }

  return { rows, error: null };
}

export function foodEffectStatsToCsv(rows: FoodEffectStatRow[]) {
  if (rows.length === 0) return "";
  return [
    "statType,value",
    ...rows.map((row) => `${row.statType},${row.value}`),
  ].join("\n");
}

export function safeParseToolEfficienciesCsv(
  csv: string,
): ParsedRows<ToolEfficiencyRow> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };

  const startIndex = lines[0]?.toLowerCase().includes("actiontype") ? 1 : 0;
  const rows: ToolEfficiencyRow[] = [];

  for (const [idx, line] of lines.slice(startIndex).entries()) {
    const [actionTypeRaw, baseRaw] = line.split(",").map((s) => s.trim());
    if (!actionTypeRaw) continue;
    if (!(actionTypeRaw in VocationalActionType)) {
      return {
        rows: [],
        error: `Invalid actionType on row ${idx + 1}: ${actionTypeRaw}`,
      };
    }
    const base = clampPercent(Number.parseFloat(baseRaw ?? ""));
    if (!Number.isFinite(base)) {
      return {
        rows: [],
        error: `Invalid baseEfficiency on row ${idx + 1} for ${actionTypeRaw}`,
      };
    }
    rows.push({
      actionType: actionTypeRaw as VocationalActionType,
      baseEfficiency: base,
    });
  }

  return { rows, error: null };
}

export function toolEfficienciesToCsv(rows: ToolEfficiencyRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "actionType,baseEfficiency",
    ...rows.map((r) => `${r.actionType},${clampPercent(r.baseEfficiency)}`),
  ].join("\n");
}

export function safeParseStatProgressionsCsv(
  csv: string,
): ParsedRows<StatProgressionRow> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows: StatProgressionRow[] = [];

  for (const [idx, line] of lines.slice(startIndex).entries()) {
    const [statTypeRaw, baseRaw, unlocksRaw] = line
      .split(",")
      .map((s) => s.trim());
    if (!statTypeRaw || !baseRaw || !unlocksRaw) continue;
    if (!(statTypeRaw in StatType)) {
      return {
        rows: [],
        error: `Invalid statType on row ${idx + 1}: ${statTypeRaw}`,
      };
    }
    if (!(unlocksRaw in ItemRarity)) {
      return {
        rows: [],
        error: `Invalid unlocksAtRarity on row ${idx + 1}: ${unlocksRaw}`,
      };
    }

    const baseValue = Number.parseFloat(baseRaw);
    if (!Number.isFinite(baseValue)) {
      return {
        rows: [],
        error: `Invalid baseValue on row ${idx + 1} for ${statTypeRaw}`,
      };
    }

    rows.push({
      statType: statTypeRaw as StatType,
      baseValue,
      unlocksAtRarity: unlocksRaw as ItemRarity,
    });
  }

  return { rows, error: null };
}

export function statProgressionsToCsv(rows: StatProgressionRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "statType,baseValue,unlocksAtRarity",
    ...rows.map((r) => `${r.statType},${r.baseValue},${r.unlocksAtRarity}`),
  ].join("\n");
}

export function safeParseBaseStatsCsv(csv: string): ParsedRows<BaseStatRow> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows: BaseStatRow[] = [];

  for (const [idx, line] of lines.slice(startIndex).entries()) {
    const [statTypeRaw, valueRaw, maxRaw] = line
      .split(",")
      .map((s) => s.trim());
    if (!statTypeRaw) continue;
    if (!(statTypeRaw in StatType)) {
      return {
        rows: [],
        error: `Invalid statType on row ${idx + 1}: ${statTypeRaw}`,
      };
    }

    const value = Number.parseFloat(valueRaw ?? "");
    if (!Number.isFinite(value)) {
      return {
        rows: [],
        error: `Invalid value on row ${idx + 1} for ${statTypeRaw}`,
      };
    }

    let maxValue: number | null = null;
    if (typeof maxRaw === "string" && maxRaw.length > 0) {
      const parsedMax = Number.parseFloat(maxRaw);
      if (!Number.isFinite(parsedMax)) {
        return {
          rows: [],
          error: `Invalid maxValue on row ${idx + 1} for ${statTypeRaw}`,
        };
      }
      maxValue = parsedMax;
    }

    rows.push({ statType: statTypeRaw as StatType, value, maxValue });
  }

  return { rows, error: null };
}

export function baseStatsToCsv(rows: BaseStatRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "statType,value,maxValue",
    ...rows.map((r) => `${r.statType},${r.value},${r.maxValue ?? ""}`),
  ].join("\n");
}

export function safeParseStatRarityOverridesCsv(
  csv: string,
): ParsedRows<StatRarityOverrideRow> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows: StatRarityOverrideRow[] = [];

  for (const [idx, line] of lines.slice(startIndex).entries()) {
    const parts = line.split(",").map((s) => s.trim());
    const [statTypeRaw, rarityRaw] = parts;
    const hasKindColumn = parts.length >= 4;
    const kindRaw = hasKindColumn
      ? parts[2]
      : ItemStatRarityOverrideKind.ABSOLUTE;
    const valueRaw = hasKindColumn ? parts[3] : parts[2];
    if (!statTypeRaw || !rarityRaw || !valueRaw) continue;

    if (!(statTypeRaw in StatType)) {
      return {
        rows: [],
        error: `Invalid statType on row ${idx + 1}: ${statTypeRaw}`,
      };
    }
    if (!(rarityRaw in ItemRarity)) {
      return {
        rows: [],
        error: `Invalid rarity on row ${idx + 1}: ${rarityRaw}`,
      };
    }
    if (!kindRaw || !(kindRaw in ItemStatRarityOverrideKind)) {
      return {
        rows: [],
        error: `Invalid override kind on row ${idx + 1}: ${kindRaw ?? ""}`,
      };
    }

    const value = Number.parseFloat(valueRaw);
    if (!Number.isFinite(value)) {
      return {
        rows: [],
        error: `Invalid value on row ${idx + 1} for ${statTypeRaw}/${rarityRaw}`,
      };
    }

    rows.push({
      statType: statTypeRaw as StatType,
      rarity: rarityRaw as ItemRarity,
      kind: kindRaw as ItemStatRarityOverrideKind,
      value,
    });
  }

  return { rows, error: null };
}

export function statRarityOverridesToCsv(
  rows: StatRarityOverrideRow[],
): string {
  if (!rows || rows.length === 0) return "";
  return [
    "statType,rarity,kind,value",
    ...rows.map((r) => `${r.statType},${r.rarity},${r.kind},${r.value}`),
  ].join("\n");
}

export const baseStatsCodec: CsvCodec<BaseStatRow> = {
  parse: safeParseBaseStatsCsv,
  toCsv: baseStatsToCsv,
  format: "statType,value,maxValue",
  example:
    "statType,value,maxValue\nCARRYING_CAPACITY,13,\nMOVEMENT_SPEED,-5,-1",
};

export const toolEfficienciesCodec: CsvCodec<ToolEfficiencyRow> = {
  parse: safeParseToolEfficienciesCsv,
  toCsv: toolEfficienciesToCsv,
  format: "actionType,baseEfficiency",
  example: "actionType,baseEfficiency\nWOODCUTTING,10\nMINING,5",
};

export const statProgressionsCodec: CsvCodec<StatProgressionRow> = {
  parse: safeParseStatProgressionsCsv,
  toCsv: statProgressionsToCsv,
  format: "statType,baseValue,unlocksAtRarity",
  example:
    "statType,baseValue,unlocksAtRarity\nCRITICAL_CHANCE,5,COMMON\nLIFESTEAL,3,DIVINE",
};

export const statRarityOverridesCodec: CsvCodec<StatRarityOverrideRow> = {
  parse: safeParseStatRarityOverridesCsv,
  toCsv: statRarityOverridesToCsv,
  format: "statType,rarity,kind,value",
  example:
    "statType,rarity,kind,value\nPHYSICAL_DAMAGE_MAX,LEGENDARY,MULTIPLIER,1.15\nMOVEMENT_SPEED,EPIC,ABSOLUTE,-1",
};

export const foodEffectStatsCodec: CsvCodec<FoodEffectStatRow> = {
  parse: safeParseFoodEffectStatsCsv,
  toCsv: foodEffectStatsToCsv,
  format: "statType,value",
  example: "statType,value\nHEALTH_REGEN,2\nLUCK,5",
};

/** The data rows of a balance CSV, without its header line. */
function csvDataRows(csv: string) {
  const lines = parseCsvLines(csv);
  const first = lines[0]?.toLowerCase() ?? "";
  const hasHeader = first.includes("stattype") || first.includes("actiontype");
  return (hasHeader ? lines.slice(1) : lines).join("\n");
}

/**
 * The form as it would be saved. Two snapshots are equal when saving would
 * write the same item, so an edit that is typed and then undone doesn't count
 * as a change.
 */
export function itemFormSnapshot(values: Partial<ItemFormValues>): string {
  const parsed = itemFormSchema.safeParse(values);
  if (!parsed.success) return `invalid:${JSON.stringify(values)}`;
  const data: Record<string, unknown> = { ...parsed.data };
  for (const field of CSV_FIELDS)
    data[field] = csvDataRows(parsed.data[field] ?? "");
  return JSON.stringify(data);
}

export type PreviewRow = {
  statType: StatType;
  baseValue: number;
  maxValue: number | null;
  progressions: Array<{ baseValue: number; unlocksAtRarity: ItemRarity }>;
  overrides: StatRarityOverrideRow[];
};

function parseWatchedNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Every stat the item ends up with, from the base stats, the damage and armor
 * inputs, tool efficiencies, progressions and overrides, in the order the game
 * lists stats.
 */
export function buildPreviewRows(input: {
  baseStatsCsv: string;
  toolEfficienciesCsv: string;
  statProgressionsCsv: string;
  statRarityOverridesCsv: string;
  minPhysicalDamage: unknown;
  maxPhysicalDamage: unknown;
  minMagicDamage: unknown;
  maxMagicDamage: unknown;
  armor: unknown;
}): PreviewRow[] {
  const baseParsed = safeParseBaseStatsCsv(input.baseStatsCsv);
  const toolParsed = safeParseToolEfficienciesCsv(input.toolEfficienciesCsv);
  const progParsed = safeParseStatProgressionsCsv(input.statProgressionsCsv);
  const overrideParsed = safeParseStatRarityOverridesCsv(
    input.statRarityOverridesCsv,
  );

  // Mirror server behavior: last duplicate wins for base stats.
  const baseByStat = new Map<
    StatType,
    { value: number; maxValue: number | null }
  >();
  for (const r of baseParsed.rows) {
    baseByStat.set(r.statType, {
      value: r.value,
      maxValue:
        typeof r.maxValue === "number" && Number.isFinite(r.maxValue)
          ? r.maxValue
          : null,
    });
  }

  // These are edited via dedicated inputs (not the base stats editor), but should
  // still appear in preview since they become ItemStat rows on save.
  const combatPairs: Array<[StatType, number]> = [
    [StatType.PHYSICAL_DAMAGE_MIN, parseWatchedNumber(input.minPhysicalDamage)],
    [StatType.PHYSICAL_DAMAGE_MAX, parseWatchedNumber(input.maxPhysicalDamage)],
    [StatType.MAGIC_DAMAGE_MIN, parseWatchedNumber(input.minMagicDamage)],
    [StatType.MAGIC_DAMAGE_MAX, parseWatchedNumber(input.maxMagicDamage)],
    [StatType.ARMOR, parseWatchedNumber(input.armor)],
  ];
  for (const [statType, value] of combatPairs) {
    if (value === 0) {
      baseByStat.delete(statType);
    } else {
      baseByStat.set(statType, { value, maxValue: null });
    }
  }

  // Tool efficiencies become stats on the user item (scaled by multiplier).
  // Mirror server behavior: these statTypes exist even if not in base stats.
  for (const row of toolParsed.rows) {
    const statType = getVocationalEfficiencyStatType(row.actionType);
    if (!statType) continue;
    baseByStat.set(statType, {
      value: clampPercent(row.baseEfficiency),
      maxValue: null,
    });
  }

  const progByStat = new Map<
    StatType,
    Array<{ baseValue: number; unlocksAtRarity: ItemRarity }>
  >();
  for (const p of progParsed.rows) {
    const arr = progByStat.get(p.statType) ?? [];
    arr.push({ baseValue: p.baseValue, unlocksAtRarity: p.unlocksAtRarity });
    progByStat.set(p.statType, arr);
  }

  const statTypesAll = new Set<StatType>([
    ...baseByStat.keys(),
    ...progByStat.keys(),
    ...overrideParsed.rows.map((o) => o.statType),
  ]);
  const ordered = Array.from(statTypesAll).sort(
    (a, b) =>
      (STAT_METADATA[a]?.priority ?? 999) -
        (STAT_METADATA[b]?.priority ?? 999) ||
      String(a).localeCompare(String(b)),
  );

  return ordered.map((statType) => ({
    statType,
    baseValue: baseByStat.get(statType)?.value ?? 0,
    maxValue: baseByStat.get(statType)?.maxValue ?? null,
    progressions: progByStat.get(statType) ?? [],
    overrides: overrideParsed.rows.filter((o) => o.statType === statType),
  }));
}

export function scaleForPreview(
  baseValue: number,
  multiplier: number,
  flipNegatives: boolean,
) {
  if (!Number.isFinite(baseValue) || !Number.isFinite(multiplier)) return NaN;
  if (!flipNegatives) return baseValue * multiplier;
  if (baseValue >= 0) return baseValue * multiplier;
  // Example base -5, mult 2.3 => -5 + (1.3 * 5) = +1.5
  return baseValue + (multiplier - 1) * Math.abs(baseValue);
}

export function formatPreviewValue(value: number) {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export type PreviewCell = {
  /** Null when the item has none of this stat at this rarity. */
  value: number | null;
  /** Base value plus every progression unlocked by this rarity. */
  baseTotal: number;
  /** The rarity's multiplier, or 1 for a stat that doesn't scale. */
  globalMultiplier: number;
  /** The multiplier actually applied (an override replaces the global one). */
  multiplier: number;
  override: StatRarityOverrideRow | null;
  /** The value before the cap, when the cap lowered it. */
  uncapped: number | null;
  scales: boolean;
};

/** One stat at one rarity, the way the game computes it. */
export function previewCell(
  row: PreviewRow,
  rarity: ItemRarity,
  context: {
    rarityIndex: ReadonlyMap<ItemRarity, number>;
    multipliers: ReadonlyMap<ItemRarity, number>;
    equipTo: ItemEquipTo | null;
    flipNegatives: boolean;
  },
): PreviewCell {
  const currentIdx = context.rarityIndex.get(rarity) ?? 0;
  const unlockedSum = row.progressions
    .filter((p) => {
      const unlockIdx = context.rarityIndex.get(p.unlocksAtRarity);
      return unlockIdx !== undefined && unlockIdx <= currentIdx;
    })
    .reduce((acc, p) => acc + p.baseValue, 0);

  const hasAny = row.baseValue !== 0 || unlockedSum !== 0;
  const scales = statScalesWithRarity(row.statType, context.equipTo);
  const globalMultiplier = scales ? context.multipliers.get(rarity) ?? 1 : 1;
  const baseTotal = row.baseValue + unlockedSum;
  const found = row.overrides.find((o) => o.rarity === rarity);
  const override =
    found && typeof found.value === "number" && Number.isFinite(found.value)
      ? found
      : null;
  const multiplier =
    override?.kind === ItemStatRarityOverrideKind.MULTIPLIER
      ? override.value
      : globalMultiplier;
  const total =
    override?.kind === ItemStatRarityOverrideKind.ABSOLUTE
      ? override.value
      : scaleForPreview(baseTotal, multiplier, context.flipNegatives);
  const capped =
    typeof row.maxValue === "number" && Number.isFinite(row.maxValue)
      ? Math.min(total, row.maxValue)
      : total;

  return {
    value: override !== null || hasAny ? capped : null,
    baseTotal,
    globalMultiplier,
    multiplier,
    override,
    uncapped: capped < total ? total : null,
    scales,
  };
}
