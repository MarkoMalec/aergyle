"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ItemRarity,
  ItemType,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { getRarityTailwindClass } from "~/utils/rarity-colors";

const ITEM_RARITY_VALUES = Object.values(ItemRarity) as [
  ItemRarity,
  ...ItemRarity[],
];

const ITEM_TYPE_VALUES = Object.values(ItemType) as [ItemType, ...ItemType[]];

const rarityColorClass = (rarity: ItemRarity) => {
  return getRarityTailwindClass(rarity);
};

const VOCATIONAL_ACTION_STAT_MAP: Record<VocationalActionType, StatType | null> = {
  [VocationalActionType.WOODCUTTING]: StatType.WOODCUTTING_EFFICIENCY,
  [VocationalActionType.MINING]: StatType.MINING_EFFICIENCY,
  [VocationalActionType.FISHING]: StatType.FISHING_EFFICIENCY,
  [VocationalActionType.GATHERING]: null,
  [VocationalActionType.ALCHEMY]: null,
  [VocationalActionType.SMELTING]: null,
  [VocationalActionType.COOKING]: null,
  [VocationalActionType.FORGE]: null,
};

type ToolEfficiencyRow = {
  actionType: VocationalActionType;
  baseEfficiency: number;
};

type StatProgressionRow = {
  statType: StatType;
  baseValue: number;
  unlocksAtRarity: ItemRarity;
};

type BaseStatRow = {
  statType: StatType;
  value: number;
  maxValue?: number | null;
};

type StatRarityOverrideRow = {
  statType: StatType;
  rarity: ItemRarity;
  value: number;
};

type RarityConfigPreview = {
  rarity: ItemRarity;
  statMultiplier: number;
  sortOrder: number;
  displayName?: string;
};

function parseCsvLines(input: string): string[] {
  return (input ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function safeParseToolEfficienciesCsv(csv: string): {
  rows: ToolEfficiencyRow[];
  error: string | null;
} {
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

function toolEfficienciesToCsv(rows: ToolEfficiencyRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "actionType,baseEfficiency",
    ...rows.map((r) => `${r.actionType},${clampPercent(r.baseEfficiency)}`),
  ].join("\n");
}

function safeParseStatProgressionsCsv(csv: string): {
  rows: StatProgressionRow[];
  error: string | null;
} {
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

function statProgressionsToCsv(rows: StatProgressionRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "statType,baseValue,unlocksAtRarity",
    ...rows.map((r) => `${r.statType},${r.baseValue},${r.unlocksAtRarity}`),
  ].join("\n");
}

function safeParseBaseStatsCsv(csv: string): {
  rows: BaseStatRow[];
  error: string | null;
} {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows: BaseStatRow[] = [];

  for (const [idx, line] of lines.slice(startIndex).entries()) {
    const [statTypeRaw, valueRaw, maxRaw] = line.split(",").map((s) => s.trim());
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

function baseStatsToCsv(rows: BaseStatRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "statType,value,maxValue",
    ...rows.map((r) => `${r.statType},${r.value},${r.maxValue ?? ""}`),
  ].join("\n");
}

function safeParseStatRarityOverridesCsv(csv: string): {
  rows: StatRarityOverrideRow[];
  error: string | null;
} {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return { rows: [], error: null };

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows: StatRarityOverrideRow[] = [];

  for (const [idx, line] of lines.slice(startIndex).entries()) {
    const [statTypeRaw, rarityRaw, valueRaw] = line
      .split(",")
      .map((s) => s.trim());
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
      value,
    });
  }

  return { rows, error: null };
}

function statRarityOverridesToCsv(rows: StatRarityOverrideRow[]): string {
  if (!rows || rows.length === 0) return "";
  return [
    "statType,rarity,value",
    ...rows.map((r) => `${r.statType},${r.rarity},${r.value}`),
  ].join("\n");
}

const schema = z.object({
  name: z.string().min(1),
  sprite: z.string().min(1),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  rarity: z.enum(ITEM_RARITY_VALUES).default(ItemRarity.COMMON),
  itemType: z.enum(ITEM_TYPE_VALUES).nullable().optional(),
  equipTo: z.string().nullable().optional(),
  stackable: z.coerce.boolean().default(false),
  maxStackSize: z.coerce.number().int().min(1).default(1),
  flipNegativeStatsWithRarity: z.coerce.boolean().default(false),
  minPhysicalDamage: z.coerce.number().nullable().optional(),
  maxPhysicalDamage: z.coerce.number().nullable().optional(),
  minMagicDamage: z.coerce.number().nullable().optional(),
  maxMagicDamage: z.coerce.number().nullable().optional(),
  armor: z.coerce.number().nullable().optional(),
  requiredLevel: z.coerce.number().int().min(1).default(1),
  // Advanced (relationships)
  baseStatsCsv: z.string().optional(),
  toolEfficienciesCsv: z.string().optional(),
  statProgressionsCsv: z.string().optional(),
  statRarityOverridesCsv: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ItemForm(props: {
  mode: "create" | "edit";
  itemId?: number;
  initialValues?: Partial<FormValues>;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [rarityConfigs, setRarityConfigs] = useState<
    RarityConfigPreview[] | null
  >(null);
  const [rarityConfigsError, setRarityConfigsError] = useState<string | null>(
    null,
  );

  const defaults: FormValues = {
    name: "",
    sprite: "",
    price: 0,
    description: "",
    rarity: ItemRarity.COMMON,
    itemType: null,
    equipTo: null,
    stackable: false,
    maxStackSize: 1,
    minPhysicalDamage: null,
    flipNegativeStatsWithRarity: false,
    maxPhysicalDamage: null,
    minMagicDamage: null,
    maxMagicDamage: null,
    armor: null,
    requiredLevel: 1,
    baseStatsCsv: "",
    toolEfficienciesCsv: "",
    statProgressionsCsv: "",
    statRarityOverridesCsv: "",
    ...props.initialValues,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const actionTypes = useMemo(() => Object.values(VocationalActionType), []);
  const statTypes = useMemo(() => Object.values(StatType), []);

  const itemTypes = useMemo(() => Object.values(ItemType), []);
  const rarities = useMemo(() => Object.values(ItemRarity), []);

  const watchedBaseStatsCsv = form.watch("baseStatsCsv") ?? "";
  const watchedToolEfficienciesCsv = form.watch("toolEfficienciesCsv") ?? "";
  const watchedStatProgressionsCsv = form.watch("statProgressionsCsv") ?? "";
  const watchedStatRarityOverridesCsv = form.watch("statRarityOverridesCsv") ?? "";
  const watchedMinPhysicalDamage = form.watch("minPhysicalDamage");
  const watchedMaxPhysicalDamage = form.watch("maxPhysicalDamage");
  const watchedMinMagicDamage = form.watch("minMagicDamage");
  const watchedMaxMagicDamage = form.watch("maxMagicDamage");
  const watchedArmor = form.watch("armor");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        setRarityConfigsError(null);
        const res = await fetch("/api/admin/rarity/config", { method: "GET" });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load rarity config");
        }

        const rows = Array.isArray(json) ? (json as unknown[]) : [];
        const parsed: RarityConfigPreview[] = rows
          .map((r) => {
            const obj = r as {
              rarity?: unknown;
              statMultiplier?: unknown;
              sortOrder?: unknown;
              displayName?: unknown;
            };
            return {
              rarity: obj.rarity as ItemRarity,
              statMultiplier: Number(obj.statMultiplier ?? 1),
              sortOrder: Number(obj.sortOrder ?? 0),
              displayName:
                typeof obj.displayName === "string" ? obj.displayName : undefined,
            };
          })
          .filter((r) => Boolean(r.rarity));

        if (!active) return;
        setRarityConfigs(parsed);
      } catch (e: any) {
        if (!active) return;
        setRarityConfigsError(e?.message ?? "Failed to load rarity config");
        setRarityConfigs([]);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const previewRarities = useMemo<ItemRarity[]>(() => {
    const canonical = ITEM_RARITY_VALUES as unknown as ItemRarity[];
    const cfgs = rarityConfigs;
    if (!cfgs || cfgs.length === 0) return canonical;

    const sorted = [...cfgs].sort((a, b) => a.sortOrder - b.sortOrder);
    const inOrder = sorted.map((c) => c.rarity);
    const remaining = canonical.filter((r) => !inOrder.includes(r));
    return [...inOrder, ...remaining];
  }, [rarityConfigs]);

  const rarityIndex = useMemo(() => {
    const map = new Map<ItemRarity, number>();
    previewRarities.forEach((r, idx) => map.set(r, idx));
    return map;
  }, [previewRarities]);

  const previewMultipliers = useMemo(() => {
    const map = new Map<ItemRarity, number>();
    for (const r of previewRarities) map.set(r, 1);
    if (rarityConfigs) {
      for (const c of rarityConfigs) {
        map.set(
          c.rarity,
          Number.isFinite(c.statMultiplier) ? c.statMultiplier : 1,
        );
      }
    }
    return map;
  }, [rarityConfigs, previewRarities]);

  const previewRows = useMemo(() => {
    const baseParsed = safeParseBaseStatsCsv(watchedBaseStatsCsv);
    const toolParsed = safeParseToolEfficienciesCsv(watchedToolEfficienciesCsv);
    const progParsed = safeParseStatProgressionsCsv(watchedStatProgressionsCsv);
    const overrideParsed = safeParseStatRarityOverridesCsv(
      watchedStatRarityOverridesCsv,
    );

    const parseWatchedNumber = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const parsed = Number.parseFloat(String(value ?? "0"));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    // Mirror server behavior: last duplicate wins for base stats.
    const baseByStat = new Map<StatType, { value: number; maxValue: number | null }>();
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
      [StatType.PHYSICAL_DAMAGE_MIN, parseWatchedNumber(watchedMinPhysicalDamage)],
      [StatType.PHYSICAL_DAMAGE_MAX, parseWatchedNumber(watchedMaxPhysicalDamage)],
      [StatType.MAGIC_DAMAGE_MIN, parseWatchedNumber(watchedMinMagicDamage)],
      [StatType.MAGIC_DAMAGE_MAX, parseWatchedNumber(watchedMaxMagicDamage)],
      [StatType.ARMOR, parseWatchedNumber(watchedArmor)],
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
      const statType = VOCATIONAL_ACTION_STAT_MAP[row.actionType];
      if (!statType) continue;
      baseByStat.set(statType, { value: clampPercent(row.baseEfficiency), maxValue: null });
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
    const ordered = Array.from(statTypesAll).sort((a, b) =>
      String(a).localeCompare(String(b)),
    );

    return ordered.map((statType) => ({
      statType,
      baseValue: baseByStat.get(statType)?.value ?? 0,
      maxValue: baseByStat.get(statType)?.maxValue ?? null,
      progressions: progByStat.get(statType) ?? [],
      overrides: overrideParsed.rows.filter((o) => o.statType === statType),
    }));
  }, [
    watchedBaseStatsCsv,
    watchedToolEfficienciesCsv,
    watchedStatProgressionsCsv,
    watchedStatRarityOverridesCsv,
    watchedMinPhysicalDamage,
    watchedMaxPhysicalDamage,
    watchedMinMagicDamage,
    watchedMaxMagicDamage,
    watchedArmor,
  ]);
  const scaleForPreview = (
    baseValue: number,
    multiplier: number,
    flipNegatives: boolean,
  ) => {
    if (!Number.isFinite(baseValue) || !Number.isFinite(multiplier)) return NaN;
    if (!flipNegatives) return baseValue * multiplier;
    if (baseValue >= 0) return baseValue * multiplier;
    // Example base -5, mult 2.3 => -5 + (1.3 * 5) = +1.5
    return baseValue + (multiplier - 1) * Math.abs(baseValue);
  };

  const formatPreviewValue = (value: number) => {
    if (!Number.isFinite(value)) return "-";
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  };

  const initialToolParse = useMemo(
    () => safeParseToolEfficienciesCsv(defaults.toolEfficienciesCsv ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const initialStatParse = useMemo(
    () => safeParseStatProgressionsCsv(defaults.statProgressionsCsv ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const initialOverrideParse = useMemo(
    () => safeParseStatRarityOverridesCsv(defaults.statRarityOverridesCsv ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const initialBaseParse = useMemo(
    () => safeParseBaseStatsCsv(defaults.baseStatsCsv ?? ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [toolMode, setToolMode] = useState<"structured" | "raw">(
    initialToolParse.error ? "raw" : "structured",
  );
  const [toolError, setToolError] = useState<string | null>(
    initialToolParse.error,
  );
  const [toolRows, setToolRows] = useState<ToolEfficiencyRow[]>(
    initialToolParse.rows,
  );

  const [progMode, setProgMode] = useState<"structured" | "raw">(
    initialStatParse.error ? "raw" : "structured",
  );
  const [progError, setProgError] = useState<string | null>(
    initialStatParse.error,
  );
  const [progRows, setProgRows] = useState<StatProgressionRow[]>(
    initialStatParse.rows,
  );

  const [overrideMode, setOverrideMode] = useState<"structured" | "raw">(
    initialOverrideParse.error ? "raw" : "structured",
  );
  const [overrideError, setOverrideError] = useState<string | null>(
    initialOverrideParse.error,
  );
  const [overrideRows, setOverrideRows] = useState<StatRarityOverrideRow[]>(
    initialOverrideParse.rows,
  );

  const overrideStatTypes = useMemo(() => {
    const set = new Set<StatType>(previewRows.map((r) => r.statType));
    // Ensure we can still edit existing overrides even if other inputs are cleared.
    for (const r of overrideRows) set.add(r.statType);
    const ordered = Array.from(set).sort((a, b) =>
      String(a).localeCompare(String(b)),
    );
    return ordered.length > 0 ? ordered : statTypes;
  }, [previewRows, overrideRows, statTypes]);

  const [baseMode, setBaseMode] = useState<"structured" | "raw">(
    initialBaseParse.error ? "raw" : "structured",
  );
  const [baseError, setBaseError] = useState<string | null>(
    initialBaseParse.error,
  );
  const [baseRows, setBaseRows] = useState<BaseStatRow[]>(
    initialBaseParse.rows,
  );

  const syncToolRowsToForm = (next: ToolEfficiencyRow[]) => {
    setToolRows(next);
    form.setValue("toolEfficienciesCsv", toolEfficienciesToCsv(next), {
      shouldDirty: true,
    });
  };

  const syncProgRowsToForm = (next: StatProgressionRow[]) => {
    setProgRows(next);
    form.setValue("statProgressionsCsv", statProgressionsToCsv(next), {
      shouldDirty: true,
    });
  };

  const syncOverrideRowsToForm = (next: StatRarityOverrideRow[]) => {
    setOverrideRows(next);
    form.setValue("statRarityOverridesCsv", statRarityOverridesToCsv(next), {
      shouldDirty: true,
    });
  };

  const syncBaseRowsToForm = (next: BaseStatRow[]) => {
    setBaseRows(next);
    form.setValue("baseStatsCsv", baseStatsToCsv(next), {
      shouldDirty: true,
    });
  };

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const res = await fetch(
        props.mode === "create"
          ? "/api/admin/items"
          : `/api/admin/items/${props.itemId}`,
        {
          method: props.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "Failed to save");
        return;
      }

      router.push("/admin/items");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!props.itemId) return;
    if (!confirm("Delete this item?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/items/${props.itemId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "Failed to delete");
        return;
      }
      router.push("/admin/items");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" {...form.register("baseStatsCsv")} />
      <input type="hidden" {...form.register("toolEfficienciesCsv")} />
      <input type="hidden" {...form.register("statProgressionsCsv")} />
      <input type="hidden" {...form.register("statRarityOverridesCsv")} />

      <div
        className={cn(
          "h-16 w-16 rounded-md border border-gray-800/60 bg-gray-900/20 bg-contain bg-center bg-no-repeat",
          !form.watch("sprite") && "opacity-50",
        )}
        style={
          form.watch("sprite")
            ? { backgroundImage: `url(${form.watch("sprite")})` }
            : {}
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-white/80">Name</div>
          <Input {...form.register("name")} />
        </div>

        <div className="flex-1 space-y-2">
          <div className="text-sm text-white/80">Sprite URL</div>
          <Input {...form.register("sprite")} />
        </div>

        <div className="space-y-2">
          <div className="text-sm text-white/80">Item Description</div>
          <Input {...form.register("description")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Price</div>
          <Input type="number" {...form.register("price")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Required Level</div>
          <Input type="number" {...form.register("requiredLevel")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Rarity</div>
          <Select
            value={form.watch("rarity")}
            onValueChange={(v) => form.setValue("rarity", v as ItemRarity)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select rarity" />
            </SelectTrigger>
            <SelectContent>
              {rarities.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Item Type</div>
          <Select
            value={form.watch("itemType") ?? "__null"}
            onValueChange={(v) =>
              form.setValue("itemType", v === "__null" ? null : (v as ItemType))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__null">—</SelectItem>
              {itemTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Equip To</div>
          <Input
            placeholder="weapon, chest, fellingAxe, ..."
            {...form.register("equipTo")}
          />
          <div className="text-xs text-white/50">
            Note: equipTo is a schema enum; enter a valid value.
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-white/80">Stackable</div>
          <Select
            value={String(form.watch("stackable"))}
            onValueChange={(v) => form.setValue("stackable", v === "true")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Max Stack Size</div>
          <Input type="number" {...form.register("maxStackSize")} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <div className="text-sm text-white/80">Negative stat scaling</div>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={Boolean(form.watch("flipNegativeStatsWithRarity"))}
              onChange={(e) =>
                form.setValue("flipNegativeStatsWithRarity", e.target.checked, {
                  shouldDirty: true,
                })
              }
            />
            On higher rarities, negative stats trend toward positive
          </label>
          <div className="text-xs text-white/50">
            Example: MOVEMENT_SPEED -5 at COMMON can become + at high rarities.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <div className="text-sm text-white/80">Min Physical</div>
          <Input type="number" {...form.register("minPhysicalDamage")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Max Physical</div>
          <Input type="number" {...form.register("maxPhysicalDamage")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Armor</div>
          <Input type="number" {...form.register("armor")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Min Magic</div>
          <Input type="number" {...form.register("minMagicDamage")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Max Magic</div>
          <Input type="number" {...form.register("maxMagicDamage")} />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-800/60 p-4">
        <div>
          <div className="text-sm font-semibold text-white">Advanced</div>
          <div className="text-xs text-white/60">
            Configure base stats, progressive stats and tool efficiencies.
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-white/80">Base Stats</div>
              <div className="text-xs text-white/50">
                Always applied (then scaled by rarity multiplier). Use this for
                backpacks (capacity) and movement speed.
              </div>
            </div>
            {baseMode === "structured" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  syncBaseRowsToForm([
                    ...baseRows,
                    {
                      statType: StatType.CARRYING_CAPACITY,
                      value: 0,
                      maxValue: null,
                    },
                  ]);
                }}
              >
                Add
              </Button>
            ) : null}
          </div>

          {baseError ? (
            <div className="rounded-md border border-gray-800/60 bg-gray-900/20 p-3 text-xs text-white/70">
              {baseError}
            </div>
          ) : null}

          {baseMode === "structured" ? (
            <div className="space-y-2">
              {baseRows.length === 0 ? (
                <div className="text-xs text-white/50">No base stats set.</div>
              ) : null}

              {baseRows.map((row, index) => (
                <div
                  key={`${row.statType}-${index}`}
                  className="grid grid-cols-12 items-end gap-2"
                >
                  <div className="col-span-12 space-y-1 sm:col-span-4">
                    <div className="text-xs text-white/60">Stat</div>
                    <Select
                      value={row.statType}
                      onValueChange={(v) => {
                        const next = baseRows.slice();
                        next[index] = {
                          ...next[index]!,
                          statType: v as StatType,
                        };
                        syncBaseRowsToForm(next);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statTypes
                          .filter(
                            (t) =>
                              t !== StatType.PHYSICAL_DAMAGE_MIN &&
                              t !== StatType.PHYSICAL_DAMAGE_MAX &&
                              t !== StatType.MAGIC_DAMAGE_MIN &&
                              t !== StatType.MAGIC_DAMAGE_MAX &&
                              t !== StatType.ARMOR,
                          )
                          .map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-12 space-y-1 sm:col-span-4">
                    <div className="text-xs text-white/60">Value (COMMON)</div>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9"
                      value={row.value}
                      onChange={(e) => {
                        const nextVal = Number.parseFloat(
                          e.target.value || "0",
                        );
                        const next = baseRows.slice();
                        next[index] = {
                          ...next[index]!,
                          value: Number.isFinite(nextVal) ? nextVal : 0,
                        };
                        syncBaseRowsToForm(next);
                      }}
                    />
                  </div>

                  <div className="col-span-12 space-y-1 sm:col-span-4">
                    <div className="text-xs text-white/60">Max (cap)</div>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-9"
                      value={row.maxValue ?? ""}
                      placeholder="(no cap)"
                      onChange={(e) => {
                        const raw = e.target.value;
                        const next = baseRows.slice();
                        if (!raw) {
                          next[index] = { ...next[index]!, maxValue: null };
                          syncBaseRowsToForm(next);
                          return;
                        }
                        const parsed = Number.parseFloat(raw);
                        next[index] = {
                          ...next[index]!,
                          maxValue: Number.isFinite(parsed) ? parsed : null,
                        };
                        syncBaseRowsToForm(next);
                      }}
                    />
                  </div>

                  <div className="col-span-12">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="ml-auto block h-9 px-2 text-xs"
                      onClick={() => {
                        const next = baseRows.filter((_, i) => i !== index);
                        syncBaseRowsToForm(next);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                className="h-auto p-0 text-xs"
                onClick={() => {
                  setBaseMode("raw");
                  setBaseError(null);
                }}
              >
                Edit as raw CSV
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-white/50">
                Raw CSV format:{" "}
                <span className="font-mono">statType,value,maxValue</span>
              </div>
              <textarea
                className={cn(
                  "flex min-h-[120px] w-full rounded-md border bg-gray-900/40 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                )}
                placeholder={
                  "statType,value,maxValue\nCARRYING_CAPACITY,13,\nMOVEMENT_SPEED,-5,-1"
                }
                {...form.register("baseStatsCsv")}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/50">
                  One row per base stat.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const parsed = safeParseBaseStatsCsv(
                      form.getValues("baseStatsCsv") ?? "",
                    );
                    if (parsed.error) {
                      setBaseError(parsed.error);
                      return;
                    }
                    setBaseError(null);
                    setBaseMode("structured");
                    syncBaseRowsToForm(parsed.rows);
                  }}
                >
                  Use structured editor
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white/80">Tool Efficiencies</div>
                <div className="text-xs text-white/50">
                  Bonus efficiency (percent) for a vocation action when this
                  item is equipped.
                </div>
              </div>
              {toolMode === "structured" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    syncToolRowsToForm([
                      ...toolRows,
                      {
                        actionType: actionTypes[0] as VocationalActionType,
                        baseEfficiency: 0,
                      },
                    ]);
                  }}
                >
                  Add
                </Button>
              ) : null}
            </div>

            {toolError ? (
              <div className="rounded-md border border-gray-800/60 bg-gray-900/20 p-3 text-xs text-white/70">
                {toolError}
              </div>
            ) : null}

            {toolMode === "structured" ? (
              <div className="space-y-2">
                {toolRows.length === 0 ? (
                  <div className="text-xs text-white/50">
                    No tool efficiencies set.
                  </div>
                ) : null}

                {toolRows.map((row, index) => (
                  <div
                    key={`${row.actionType}-${index}`}
                    className="grid grid-cols-12 items-end gap-2"
                  >
                    <div className="col-span-12 space-y-1 sm:col-span-6">
                      <div className="text-xs text-white/60">Action</div>
                      <Select
                        value={row.actionType}
                        onValueChange={(v) => {
                          const next = toolRows.slice();
                          next[index] = {
                            ...next[index]!,
                            actionType: v as VocationalActionType,
                          };
                          syncToolRowsToForm(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {actionTypes.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-8 space-y-1 sm:col-span-6">
                      <div className="text-xs text-white/60">
                        Base % (COMMON)
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9"
                        value={row.baseEfficiency}
                        onChange={(e) => {
                          const nextVal = clampPercent(
                            Number.parseFloat(e.target.value || "0"),
                          );
                          const next = toolRows.slice();
                          next[index] = {
                            ...next[index]!,
                            baseEfficiency: nextVal,
                          };
                          syncToolRowsToForm(next);
                        }}
                      />
                    </div>

                    <div className="col-span-12">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="ml-auto block h-9 px-2 text-xs"
                        onClick={() => {
                          const next = toolRows.filter((_, i) => i !== index);
                          syncToolRowsToForm(next);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="text-xs text-white/50">
                  Higher rarities scale via global rarity config.
                </div>
                <Button
                  type="button"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    setToolMode("raw");
                    setToolError(null);
                  }}
                >
                  Edit as raw CSV
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-white/50">
                  Raw CSV format:{" "}
                  <span className="font-mono">actionType,baseEfficiency</span>
                </div>
                <textarea
                  className={cn(
                    "flex min-h-[140px] w-full rounded-md border bg-gray-900/40 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  placeholder={
                    "actionType,baseEfficiency\nWOODCUTTING,10\nMINING,5"
                  }
                  {...form.register("toolEfficienciesCsv")}
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-white/50">
                    One row per tool bonus (percent at COMMON rarity).
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const parsed = safeParseToolEfficienciesCsv(
                        form.getValues("toolEfficienciesCsv") ?? "",
                      );
                      if (parsed.error) {
                        setToolError(parsed.error);
                        return;
                      }
                      setToolError(null);
                      setToolMode("structured");
                      syncToolRowsToForm(parsed.rows);
                    }}
                  >
                    Use structured editor
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white/80">Stat Progressions</div>
                <div className="text-xs text-white/50">
                  Defines which stats an item gains and when they unlock by
                  rarity.
                </div>
              </div>
              {progMode === "structured" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    syncProgRowsToForm([
                      ...progRows,
                      {
                        statType: statTypes[0] as StatType,
                        baseValue: 0,
                        unlocksAtRarity: ItemRarity.COMMON,
                      },
                    ]);
                  }}
                >
                  Add
                </Button>
              ) : null}
            </div>

            {progError ? (
              <div className="rounded-md border border-gray-800/60 bg-gray-900/20 p-3 text-xs text-white/70">
                {progError}
              </div>
            ) : null}

            {progMode === "structured" ? (
              <div className="space-y-2">
                {progRows.length === 0 ? (
                  <div className="text-xs text-white/50">
                    No stat progressions set.
                  </div>
                ) : null}

                {progRows.map((row, index) => (
                  <div
                    key={`${row.statType}-${row.unlocksAtRarity}-${index}`}
                    className="grid grid-cols-12 items-end gap-2"
                  >
                    <div className="col-span-12 space-y-1 sm:col-span-12">
                      <div className="text-xs text-white/60">Stat</div>
                      <Select
                        value={row.statType}
                        onValueChange={(v) => {
                          const next = progRows.slice();
                          next[index] = {
                            ...next[index]!,
                            statType: v as StatType,
                          };
                          syncProgRowsToForm(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statTypes.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-6 space-y-1 sm:col-span-6">
                      <div className="text-xs text-white/60">Base (COMMON)</div>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9"
                        value={row.baseValue}
                        onChange={(e) => {
                          const nextVal = Number.parseFloat(
                            e.target.value || "0",
                          );
                          const next = progRows.slice();
                          next[index] = {
                            ...next[index]!,
                            baseValue: Number.isFinite(nextVal) ? nextVal : 0,
                          };
                          syncProgRowsToForm(next);
                        }}
                      />
                    </div>

                    <div className="col-span-6 space-y-1 sm:col-span-6">
                      <div className="text-xs text-white/60">Unlocks At</div>
                      <Select
                        value={row.unlocksAtRarity}
                        onValueChange={(v) => {
                          const next = progRows.slice();
                          next[index] = {
                            ...next[index]!,
                            unlocksAtRarity: v as ItemRarity,
                          };
                          syncProgRowsToForm(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {rarities.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-12">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="col-span-12 ml-auto block h-9 px-2 text-xs"
                        onClick={() => {
                          const next = progRows.filter((_, i) => i !== index);
                          syncProgRowsToForm(next);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="text-xs text-white/50">
                  Final stat values are scaled by rarity multipliers.
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    setProgMode("raw");
                    setProgError(null);
                  }}
                >
                  Edit as raw CSV
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-white/50">
                  Raw CSV format:{" "}
                  <span className="font-mono">
                    statType,baseValue,unlocksAtRarity
                  </span>
                </div>
                <textarea
                  className={cn(
                    "flex min-h-[140px] w-full rounded-md border bg-gray-900/40 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  placeholder={
                    "statType,baseValue,unlocksAtRarity\nCRITICAL_CHANCE,5,COMMON\nLIFESTEAL,3,DIVINE"
                  }
                  {...form.register("statProgressionsCsv")}
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-white/50">
                    One row per stat unlock at a rarity tier.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const parsed = safeParseStatProgressionsCsv(
                        form.getValues("statProgressionsCsv") ?? "",
                      );
                      if (parsed.error) {
                        setProgError(parsed.error);
                        return;
                      }
                      setProgError(null);
                      setProgMode("structured");
                      syncProgRowsToForm(parsed.rows);
                    }}
                  >
                    Use structured editor
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white/80">Stat Overrides (by rarity)</div>
                <div className="text-xs text-white/50">
                  Optional absolute overrides for a stat at a specific rarity.
                  If present, this value replaces multiplier scaling.
                </div>
              </div>
              {overrideMode === "structured" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    syncOverrideRowsToForm([
                      ...overrideRows,
                      {
                        statType: overrideStatTypes[0] as StatType,
                        rarity: ItemRarity.COMMON,
                        value: 0,
                      },
                    ]);
                  }}
                >
                  Add
                </Button>
              ) : null}
            </div>

            {overrideError ? (
              <div className="rounded-md border border-gray-800/60 bg-gray-900/20 p-3 text-xs text-white/70">
                {overrideError}
              </div>
            ) : null}

            {overrideMode === "structured" ? (
              <div className="space-y-2">
                {overrideRows.length === 0 ? (
                  <div className="text-xs text-white/50">
                    No overrides set.
                  </div>
                ) : null}

                {overrideRows.map((row, index) => (
                  <div
                    key={`${row.statType}-${row.rarity}-${index}`}
                    className="grid grid-cols-12 items-end gap-2"
                  >
                    <div className="col-span-12 space-y-1 sm:col-span-12">
                      <div className="text-xs text-white/60">Stat</div>
                      <Select
                        value={row.statType}
                        onValueChange={(v) => {
                          const next = overrideRows.slice();
                          next[index] = {
                            ...next[index]!,
                            statType: v as StatType,
                          };
                          syncOverrideRowsToForm(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {overrideStatTypes.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-6 space-y-1 sm:col-span-6">
                      <div className="text-xs text-white/60">Rarity</div>
                      <Select
                        value={row.rarity}
                        onValueChange={(v) => {
                          const next = overrideRows.slice();
                          next[index] = {
                            ...next[index]!,
                            rarity: v as ItemRarity,
                          };
                          syncOverrideRowsToForm(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {rarities.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-6 space-y-1 sm:col-span-6">
                      <div className="text-xs text-white/60">Value</div>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9"
                        value={row.value}
                        onChange={(e) => {
                          const nextVal = Number.parseFloat(
                            e.target.value || "0",
                          );
                          const next = overrideRows.slice();
                          next[index] = {
                            ...next[index]!,
                            value: Number.isFinite(nextVal) ? nextVal : 0,
                          };
                          syncOverrideRowsToForm(next);
                        }}
                      />
                    </div>

                    <div className="col-span-12">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="col-span-12 ml-auto block h-9 px-2 text-xs"
                        onClick={() => {
                          const next = overrideRows.filter(
                            (_, i) => i !== index,
                          );
                          syncOverrideRowsToForm(next);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="text-xs text-white/50">
                  Override wins over multiplier for that rarity.
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    setOverrideMode("raw");
                    setOverrideError(null);
                  }}
                >
                  Edit as raw CSV
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-white/50">
                  Raw CSV format: <span className="font-mono">statType,rarity,value</span>
                </div>
                <textarea
                  className={cn(
                    "flex min-h-[140px] w-full rounded-md border bg-gray-900/40 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  placeholder={
                    "statType,rarity,value\nMOVEMENT_SPEED,EPIC,-1\nCRITICAL_CHANCE,LEGENDARY,12"
                  }
                  {...form.register("statRarityOverridesCsv")}
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-white/50">
                    One row per (stat, rarity) override.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const parsed = safeParseStatRarityOverridesCsv(
                        form.getValues("statRarityOverridesCsv") ?? "",
                      );
                      if (parsed.error) {
                        setOverrideError(parsed.error);
                        return;
                      }
                      setOverrideError(null);
                      setOverrideMode("structured");
                      syncOverrideRowsToForm(parsed.rows);
                    }}
                  >
                    Use structured editor
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/20 p-3">
          <div className="text-sm text-white/80">Rarity config (global)</div>
          <div className="text-xs text-white/60">
            Rarity multipliers, colors, upgrade rules, and display names are
            configured globally (not per item).
          </div>
          <div className="mt-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/rarity">Open Rarity Config</Link>
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-xs text-white/70">
              Preview: stat values by rarity
            </div>
            <div className="text-[11px] text-white/50">
              Uses global <span className="font-mono">statMultiplier</span> and
              progression unlock rarity.
            </div>

            {rarityConfigs === null ? (
              <div className="text-xs text-white/50">
                Loading rarity config…
              </div>
            ) : null}

            {rarityConfigsError ? (
              <div className="text-xs text-white/50">{rarityConfigsError}</div>
            ) : null}

            <div className="overflow-x-auto rounded-md border border-gray-800/60">
              <table className="w-full text-xs">
                <thead className="bg-gray-900/50 text-white/80">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-900/50 px-2 py-1.5 text-left">
                      Stat
                    </th>
                    {previewRarities.map((r) => (
                      <th
                        key={r}
                        className="whitespace-nowrap px-2 py-1.5 text-right"
                      >
                        <span
                          className={cn(
                            rarityColorClass(r),
                            "rounded px-[2px] py-[3px]",
                          )}
                        >
                          {r}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.length === 0 ? (
                    <tr>
                      <td
                        className="px-2 py-2 text-white/50"
                        colSpan={1 + previewRarities.length}
                      >
                        No base stats or progressions to preview.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row) => (
                      <tr
                        key={row.statType}
                        className="border-t border-gray-800/60"
                      >
                        <td className="sticky left-0 z-10 bg-gray-950 px-2 py-1.5 font-mono text-[11px] text-white/80">
                          {row.statType}
                        </td>
                        {previewRarities.map((rarity) => {
                          const currentIdx = rarityIndex.get(rarity) ?? 0;
                          const unlockedSum = row.progressions
                            .filter((p) => {
                              const unlockIdx = rarityIndex.get(
                                p.unlocksAtRarity,
                              );
                              return (
                                unlockIdx !== undefined &&
                                unlockIdx <= currentIdx
                              );
                            })
                            .reduce((acc, p) => acc + p.baseValue, 0);

                          const hasAny =
                            row.baseValue !== 0 || unlockedSum !== 0;
                          const mult = previewMultipliers.get(rarity) ?? 1;
                          const baseTotal = row.baseValue + unlockedSum;
                          const override = row.overrides?.find((o) => o.rarity === rarity);

                          let total = typeof override?.value === "number" && Number.isFinite(override.value)
                            ? override.value
                            : scaleForPreview(
                                baseTotal,
                                mult,
                                Boolean(
                                  form.getValues("flipNegativeStatsWithRarity"),
                                ),
                              );

                          if (
                            typeof row.maxValue === "number" &&
                            Number.isFinite(row.maxValue)
                          ) {
                            total = Math.min(total, row.maxValue);
                          }

                          return (
                            <td
                              key={rarity}
                              className="whitespace-nowrap px-2 py-1.5 text-right text-white/80"
                            >
                              {typeof override?.value === "number" && Number.isFinite(override.value)
                                ? formatPreviewValue(total)
                                : hasAny
                                  ? formatPreviewValue(total)
                                  : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : props.mode === "create" ? "Create" : "Save"}
        </Button>

        {props.mode === "edit" ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
