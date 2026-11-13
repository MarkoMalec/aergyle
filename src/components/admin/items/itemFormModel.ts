import { z } from "zod";
import {
  type ItemEquipTo,
  ItemRarity,
  ItemStatOverrideKind,
  ItemType,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { MAX_ENCHANT_LEVEL } from "~/game/enchanting";
import { getVocationalEfficiencyStatType } from "~/game/vocationStats";
import { STAT_METADATA } from "~/types/stats";
import { enchantStat, type EnchantedStat } from "~/utils/itemInstanceStats";

const ITEM_RARITY_VALUES = Object.values(ItemRarity) as [
  ItemRarity,
  ...ItemRarity[],
];

const ITEM_TYPE_VALUES = Object.values(ItemType) as [ItemType, ...ItemType[]];

export type ToolEfficiencyRow = {
  actionType: VocationalActionType;
  baseEfficiency: number;
};

/** A stat gained from an enchant level upward. */
export type EnchantUnlockRow = {
  statType: StatType;
  value: number;
  level: number;
};

export type BaseStatRow = {
  statType: StatType;
  value: number;
  maxValue?: number | null;
};

/** One stat at one enchant level: its own multiplier or an exact value. */
export type EnchantOverrideRow = {
  statType: StatType;
  level: number;
  kind: ItemStatOverrideKind;
  value: number;
};

export type FoodEffectStatRow = {
  statType: StatType;
  value: number;
};

export type RarityConfigPreview = {
  rarity: ItemRarity;
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
  enchantUnlocksCsv: z.string().optional(),
  enchantOverridesCsv: z.string().optional(),
  foodEffectStatsCsv: z.string().optional(),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const CSV_FIELDS = [
  "baseStatsCsv",
  "toolEfficienciesCsv",
  "enchantUnlocksCsv",
  "enchantOverridesCsv",
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

/** An enchant level written as a whole number from 1 to the top level. */
function parseEnchantLevel(raw: string | undefined) {
  const level = Number(raw);
  return Number.isInteger(level) && level >= 1 && level <= MAX_ENCHANT_LEVEL
    ? level
    : null;
}

export function safeParseEnchantUnlocksCsv(
  csv: string,
): ParsedRows<EnchantUnlockRow> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows: EnchantUnlockRow[] = [];

  for (const [idx, line] of lines.slice(startIndex).entries()) {
    const [statTypeRaw, valueRaw, levelRaw] = line
      .split(",")
      .map((s) => s.trim());
    if (!statTypeRaw || !valueRaw || !levelRaw) continue;
    if (!(statTypeRaw in StatType)) {
      return {
        rows: [],
        error: `Invalid statType on row ${idx + 1}: ${statTypeRaw}`,
      };
    }
    const level = parseEnchantLevel(levelRaw);
    if (level === null) {
      return {
        rows: [],
        error: `Invalid enchant level on row ${idx + 1}: ${levelRaw} (1-${MAX_ENCHANT_LEVEL})`,
      };
    }
    const value = Number.parseFloat(valueRaw);
    if (!Number.isFinite(value)) {
      return {
        rows: [],
        error: `Invalid value on row ${idx + 1} for ${statTypeRaw}`,
      };
    }
    if (rows.some((r) => r.statType === statTypeRaw)) {
      return {
        rows: [],
        error: `One unlock per stat: ${statTypeRaw} is listed twice`,
      };
    }
    rows.push({ statType: statTypeRaw as StatType, value, level });
  }

  return { rows, error: null };
}

export function enchantUnlocksToCsv(rows: EnchantUnlockRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "statType,value,level",
    ...rows.map((r) => `${r.statType},${r.value},${r.level}`),
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

export function safeParseEnchantOverridesCsv(
  csv: string,
): ParsedRows<EnchantOverrideRow> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows: EnchantOverrideRow[] = [];

  for (const [idx, line] of lines.slice(startIndex).entries()) {
    const [statTypeRaw, levelRaw, kindRaw, valueRaw] = line
      .split(",")
      .map((s) => s.trim());
    if (!statTypeRaw || !levelRaw || !kindRaw || !valueRaw) continue;

    if (!(statTypeRaw in StatType)) {
      return {
        rows: [],
        error: `Invalid statType on row ${idx + 1}: ${statTypeRaw}`,
      };
    }
    const level = parseEnchantLevel(levelRaw);
    if (level === null) {
      return {
        rows: [],
        error: `Invalid enchant level on row ${idx + 1}: ${levelRaw} (1-${MAX_ENCHANT_LEVEL})`,
      };
    }
    if (!(kindRaw in ItemStatOverrideKind)) {
      return {
        rows: [],
        error: `Invalid override kind on row ${idx + 1}: ${kindRaw}`,
      };
    }
    const value = Number.parseFloat(valueRaw);
    if (!Number.isFinite(value)) {
      return {
        rows: [],
        error: `Invalid value on row ${idx + 1} for ${statTypeRaw}/${level}`,
      };
    }
    if (rows.some((r) => r.statType === statTypeRaw && r.level === level)) {
      return {
        rows: [],
        error: `One override per stat and level: ${statTypeRaw} at ${level} is listed twice`,
      };
    }
    rows.push({
      statType: statTypeRaw as StatType,
      level,
      kind: kindRaw as ItemStatOverrideKind,
      value,
    });
  }

  return { rows, error: null };
}

export function enchantOverridesToCsv(rows: EnchantOverrideRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "statType,level,kind,value",
    ...rows.map((r) => `${r.statType},${r.level},${r.kind},${r.value}`),
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

export const enchantUnlocksCodec: CsvCodec<EnchantUnlockRow> = {
  parse: safeParseEnchantUnlocksCsv,
  toCsv: enchantUnlocksToCsv,
  format: "statType,value,level",
  example: "statType,value,level\nCRITICAL_CHANCE,5,10\nLIFESTEAL,3,16",
};

export const enchantOverridesCodec: CsvCodec<EnchantOverrideRow> = {
  parse: safeParseEnchantOverridesCsv,
  toCsv: enchantOverridesToCsv,
  format: "statType,level,kind,value",
  example:
    "statType,level,kind,value\nPHYSICAL_DAMAGE_MAX,15,MULTIPLIER,1.3\nMOVEMENT_SPEED,20,ABSOLUTE,-1",
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
  unlocks: EnchantUnlockRow[];
  overrides: EnchantOverrideRow[];
};

function parseWatchedNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Every stat the item ends up with, from the base stats, the damage and armor
 * inputs, tool efficiencies, enchant unlocks and overrides, in the order the game
 * lists stats.
 */
export function buildPreviewRows(input: {
  baseStatsCsv: string;
  toolEfficienciesCsv: string;
  enchantUnlocksCsv: string;
  enchantOverridesCsv: string;
  minPhysicalDamage: unknown;
  maxPhysicalDamage: unknown;
  minMagicDamage: unknown;
  maxMagicDamage: unknown;
  armor: unknown;
}): PreviewRow[] {
  const baseParsed = safeParseBaseStatsCsv(input.baseStatsCsv);
  const toolParsed = safeParseToolEfficienciesCsv(input.toolEfficienciesCsv);
  const unlockParsed = safeParseEnchantUnlocksCsv(input.enchantUnlocksCsv);
  const overrideParsed = safeParseEnchantOverridesCsv(
    input.enchantOverridesCsv,
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

  const statTypesAll = new Set<StatType>([
    ...baseByStat.keys(),
    ...unlockParsed.rows.map((u) => u.statType),
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
    unlocks: unlockParsed.rows.filter((u) => u.statType === statType),
    overrides: overrideParsed.rows.filter((o) => o.statType === statType),
  }));
}

export function formatPreviewValue(value: number) {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export type PreviewCell = EnchantedStat;

/** One stat at one enchant level, exactly the way the game computes it. */
export function previewCell(
  row: PreviewRow,
  level: number,
  context: {
    equipTo: ItemEquipTo | null;
    /** The level's global stat bonus in percent. */
    bonusPercent: number;
  },
): PreviewCell {
  return enchantStat({
    statType: row.statType,
    equipTo: context.equipTo,
    base: row.baseValue,
    maxValue: row.maxValue,
    unlocks: row.unlocks,
    overrides: row.overrides,
    level,
    bonusPercent: context.bonusPercent,
  });
}
