import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import {
  ItemRarity,
  ItemStatRarityOverrideKind,
  ItemType,
  StatType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { normalizeItemEquipTo } from "~/utils/itemEquipTo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const itemSchema = z.object({
  name: z.string().min(1),
  sprite: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  rarity: z.nativeEnum(ItemRarity),
  itemType: z.nativeEnum(ItemType).nullable().optional(),
  seedGrowSeconds: z.number().int().nullable().optional(),
  seedYieldItemId: z.number().int().nullable().optional(),
  seedYieldMin: z.number().int().nullable().optional(),
  seedYieldMax: z.number().int().nullable().optional(),
  seedHarvestSeconds: z.number().int().nullable().optional(),
  seedXp: z.number().int().nullable().optional(),
  foodEffectSeconds: z.number().int().nullable().optional(),
  equipTo: z.string().nullable().optional(),
  twoHanded: z.boolean().optional(),
  stackable: z.boolean(),
  maxStackSize: z.number().int().min(1),
  flipNegativeStatsWithRarity: z.boolean().optional(),
  minPhysicalDamage: z.number().nullable().optional(),
  maxPhysicalDamage: z.number().nullable().optional(),
  minMagicDamage: z.number().nullable().optional(),
  maxMagicDamage: z.number().nullable().optional(),
  armor: z.number().nullable().optional(),
  requiredLevel: z.number().int().min(1),
  baseStatsCsv: z.string().optional(),
  toolEfficienciesCsv: z.string().optional(),
  statProgressionsCsv: z.string().optional(),
  statRarityOverridesCsv: z.string().optional(),
  foodEffectStatsCsv: z.string().optional(),
});

function toOptionalPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.floor(n);
  return int > 0 ? int : null;
}

function parseCsvLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function parseFoodEffectStatsCsv(
  csv: string,
): Array<{ statType: StatType; value: number }> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return [];
  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const rows = new Map<StatType, number>();

  for (const line of lines.slice(startIndex)) {
    const [statTypeRaw, valueRaw] = line.split(",").map((part) => part.trim());
    if (!statTypeRaw || !(statTypeRaw in StatType)) {
      throw new Error(`Invalid food effect statType: ${statTypeRaw ?? ""}`);
    }
    const value = Number.parseFloat(valueRaw ?? "");
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid food effect value for ${statTypeRaw}`);
    }
    if (rows.has(statTypeRaw as StatType)) {
      throw new Error(`Duplicate food effect statType: ${statTypeRaw}`);
    }
    rows.set(statTypeRaw as StatType, value);
  }

  return Array.from(rows, ([statType, value]) => ({ statType, value }));
}

function parseToolEfficienciesCsv(csv: string): Array<{
  actionType: VocationalActionType;
  baseEfficiency: number;
}> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return [];

  const startIndex = lines[0]?.toLowerCase().includes("actiontype") ? 1 : 0;
  const out: Array<{
    actionType: VocationalActionType;
    baseEfficiency: number;
  }> = [];

  for (const line of lines.slice(startIndex)) {
    const [actionTypeRaw, baseRaw] = line.split(",").map((s) => s.trim());
    if (!actionTypeRaw) continue;

    if (!(actionTypeRaw in VocationalActionType)) {
      throw new Error(`Invalid actionType: ${actionTypeRaw}`);
    }

    const base = clampPercent(Number.parseFloat(baseRaw ?? ""));
    if (!Number.isFinite(base)) {
      throw new Error(`Invalid baseEfficiency for ${actionTypeRaw}`);
    }

    out.push({
      actionType: actionTypeRaw as VocationalActionType,
      baseEfficiency: base,
    });
  }

  return out;
}

function parseStatProgressionsCsv(csv: string): Array<{
  statType: StatType;
  baseValue: number;
  unlocksAtRarity: ItemRarity;
}> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return [];

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const out: Array<{
    statType: StatType;
    baseValue: number;
    unlocksAtRarity: ItemRarity;
  }> = [];

  for (const line of lines.slice(startIndex)) {
    const [statTypeRaw, baseRaw, unlocksRaw] = line
      .split(",")
      .map((s) => s.trim());
    if (!statTypeRaw || !baseRaw || !unlocksRaw) continue;

    if (!(statTypeRaw in StatType)) {
      throw new Error(`Invalid statType: ${statTypeRaw}`);
    }
    if (!(unlocksRaw in ItemRarity)) {
      throw new Error(`Invalid unlocksAtRarity: ${unlocksRaw}`);
    }

    const baseValue = Number.parseFloat(baseRaw);
    if (!Number.isFinite(baseValue)) {
      throw new Error(`Invalid baseValue for ${statTypeRaw}`);
    }

    out.push({
      statType: statTypeRaw as StatType,
      baseValue,
      unlocksAtRarity: unlocksRaw as ItemRarity,
    });
  }

  return out;
}

function parseBaseStatsCsv(
  csv: string,
): Array<{ statType: StatType; value: number; maxValue: number | null }> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return [];

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const byStat = new Map<
    StatType,
    { value: number; maxValue: number | null }
  >();

  for (const line of lines.slice(startIndex)) {
    const [statTypeRaw, valueRaw, maxRaw] = line
      .split(",")
      .map((s) => s.trim());
    if (!statTypeRaw) continue;

    if (!(statTypeRaw in StatType)) {
      throw new Error(`Invalid statType: ${statTypeRaw}`);
    }

    const value = Number.parseFloat(valueRaw ?? "");
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid value for ${statTypeRaw}`);
    }

    let maxValue: number | null = null;
    if (typeof maxRaw === "string" && maxRaw.length > 0) {
      const parsedMax = Number.parseFloat(maxRaw);
      if (!Number.isFinite(parsedMax)) {
        throw new Error(`Invalid maxValue for ${statTypeRaw}`);
      }
      maxValue = parsedMax;
    }

    byStat.set(statTypeRaw as StatType, { value, maxValue });
  }

  return Array.from(byStat.entries()).map(([statType, v]) => ({
    statType,
    value: v.value,
    maxValue: v.maxValue,
  }));
}

function parseStatRarityOverridesCsv(csv: string): Array<{
  statType: StatType;
  rarity: ItemRarity;
  kind: ItemStatRarityOverrideKind;
  value: number;
}> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return [];

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const out: Array<{
    statType: StatType;
    rarity: ItemRarity;
    kind: ItemStatRarityOverrideKind;
    value: number;
  }> = [];

  for (const line of lines.slice(startIndex)) {
    const parts = line.split(",").map((s) => s.trim());
    const [statTypeRaw, rarityRaw] = parts;
    const hasKindColumn = parts.length >= 4;
    const kindRaw = hasKindColumn
      ? parts[2]
      : ItemStatRarityOverrideKind.ABSOLUTE;
    const valueRaw = hasKindColumn ? parts[3] : parts[2];
    if (!statTypeRaw || !rarityRaw || !valueRaw) continue;

    if (!(statTypeRaw in StatType)) {
      throw new Error(`Invalid statType: ${statTypeRaw}`);
    }
    if (!(rarityRaw in ItemRarity)) {
      throw new Error(`Invalid rarity: ${rarityRaw}`);
    }
    if (!kindRaw || !(kindRaw in ItemStatRarityOverrideKind)) {
      throw new Error(`Invalid override kind: ${kindRaw ?? ""}`);
    }

    const value = Number.parseFloat(valueRaw);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid value for ${statTypeRaw}/${rarityRaw}`);
    }

    out.push({
      statType: statTypeRaw as StatType,
      rarity: rarityRaw as ItemRarity,
      kind: kindRaw as ItemStatRarityOverrideKind,
      value,
    });
  }

  return out;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const v = parsed.data;

  const isSeed = v.itemType === ItemType.SEED;
  const supportsTimedEffect =
    v.itemType === ItemType.FOOD ||
    v.itemType === ItemType.POTION ||
    v.itemType === ItemType.ELIXIR;
  const seedGrowSeconds = isSeed
    ? toOptionalPositiveInt(v.seedGrowSeconds)
    : null;
  const seedYieldItemId = isSeed
    ? toOptionalPositiveInt(v.seedYieldItemId)
    : null;
  const seedYieldMin = isSeed ? toOptionalPositiveInt(v.seedYieldMin) : null;
  const seedYieldMax = isSeed ? toOptionalPositiveInt(v.seedYieldMax) : null;
  const seedHarvestSeconds = isSeed
    ? toOptionalPositiveInt(v.seedHarvestSeconds)
    : null;
  const seedXp = isSeed ? toOptionalPositiveInt(v.seedXp) : null;
  const foodEffectSeconds = supportsTimedEffect
    ? toOptionalPositiveInt(v.foodEffectSeconds)
    : null;
  const shouldWriteFoodEffects =
    !supportsTimedEffect || typeof v.foodEffectStatsCsv === "string";
  let foodEffectStats: Array<{ statType: StatType; value: number }> = [];
  try {
    foodEffectStats =
      supportsTimedEffect && typeof v.foodEffectStatsCsv === "string"
        ? parseFoodEffectStatsCsv(v.foodEffectStatsCsv)
        : [];
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid timed effects",
      },
      { status: 400 },
    );
  }

  let toolEfficiencies: ReturnType<typeof parseToolEfficienciesCsv> | undefined;
  let itemStats:
    | Array<{ statType: StatType; value: number; maxValue: number | null }>
    | undefined;
  let statProgressions: ReturnType<typeof parseStatProgressionsCsv> | undefined;
  let statRarityOverrides:
    | ReturnType<typeof parseStatRarityOverridesCsv>
    | undefined;
  try {
    toolEfficiencies =
      typeof v.toolEfficienciesCsv === "string"
        ? parseToolEfficienciesCsv(v.toolEfficienciesCsv)
        : undefined;
    statProgressions =
      typeof v.statProgressionsCsv === "string"
        ? parseStatProgressionsCsv(v.statProgressionsCsv)
        : undefined;
    statRarityOverrides =
      typeof v.statRarityOverridesCsv === "string"
        ? parseStatRarityOverridesCsv(v.statRarityOverridesCsv)
        : undefined;

    if (typeof v.baseStatsCsv === "string") {
      const merged = new Map<
        StatType,
        { value: number; maxValue: number | null }
      >();
      for (const stat of parseBaseStatsCsv(v.baseStatsCsv)) {
        merged.set(stat.statType, {
          value: stat.value,
          maxValue: stat.maxValue,
        });
      }
      const combatPairs: Array<[StatType, number]> = [
        [StatType.PHYSICAL_DAMAGE_MIN, Number(v.minPhysicalDamage ?? 0)],
        [StatType.PHYSICAL_DAMAGE_MAX, Number(v.maxPhysicalDamage ?? 0)],
        [StatType.MAGIC_DAMAGE_MIN, Number(v.minMagicDamage ?? 0)],
        [StatType.MAGIC_DAMAGE_MAX, Number(v.maxMagicDamage ?? 0)],
        [StatType.ARMOR, Number(v.armor ?? 0)],
      ];
      for (const [statType, raw] of combatPairs) {
        const value = Number.isFinite(raw) ? raw : 0;
        if (value === 0) merged.delete(statType);
        else merged.set(statType, { value, maxValue: null });
      }
      itemStats = Array.from(merged, ([statType, stat]) => ({
        statType,
        ...stat,
      }));
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid item balance",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.item.update({
      where: { id },
      data: {
        name: v.name,
        sprite: v.sprite,
        description: v.description ?? null,
        price: v.price,
        rarity: v.rarity,
        itemType: v.itemType ?? null,
        seedGrowSeconds,
        seedYieldItemId,
        seedYieldMin,
        seedYieldMax,
        seedHarvestSeconds,
        seedXp,
        foodEffectSeconds,
        equipTo: normalizeItemEquipTo(v.equipTo ?? null),
        // Only weapons can be two-handed.
        twoHanded:
          normalizeItemEquipTo(v.equipTo ?? null) === "weapon" &&
          (v.twoHanded ?? false),
        stackable: v.stackable,
        maxStackSize: v.stackable ? v.maxStackSize : 1,
        flipNegativeStatsWithRarity: v.flipNegativeStatsWithRarity ?? false,
        minPhysicalDamage: v.minPhysicalDamage ?? 0,
        maxPhysicalDamage: v.maxPhysicalDamage ?? 0,
        minMagicDamage: v.minMagicDamage ?? 0,
        maxMagicDamage: v.maxMagicDamage ?? 0,
        armor: v.armor ?? 0,
        requiredLevel: v.requiredLevel,
      },
    });

    if (shouldWriteFoodEffects) {
      await tx.foodEffectStat.deleteMany({ where: { itemId: id } });
      if (foodEffectStats.length > 0) {
        await tx.foodEffectStat.createMany({
          data: foodEffectStats.map((row) => ({ itemId: id, ...row })),
        });
      }
    }

    if (toolEfficiencies) {
      await tx.toolEfficiency.deleteMany({ where: { itemId: id } });
      if (toolEfficiencies.length > 0) {
        await tx.toolEfficiency.createMany({
          data: toolEfficiencies.map((row) => ({ itemId: id, ...row })),
        });
      }
    }

    if (itemStats) {
      await tx.itemStat.deleteMany({ where: { itemId: id } });
      if (itemStats.length > 0) {
        await tx.itemStat.createMany({
          data: itemStats.map((row) => ({ itemId: id, ...row })),
        });
      }
    }

    if (statProgressions) {
      await tx.itemStatProgression.deleteMany({ where: { itemId: id } });
      if (statProgressions.length > 0) {
        await tx.itemStatProgression.createMany({
          data: statProgressions.map((row) => ({ itemId: id, ...row })),
        });
      }
    }

    if (statRarityOverrides) {
      await tx.itemStatRarityOverride.deleteMany({ where: { itemId: id } });
      if (statRarityOverrides.length > 0) {
        await tx.itemStatRarityOverride.createMany({
          data: statRarityOverrides.map((row) => ({ itemId: id, ...row })),
        });
      }
    }

    return item;
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to delete item (it may be referenced elsewhere)" },
      { status: 400 },
    );
  }
}
