import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { ItemRarity, ItemType, StatType, VocationalActionType } from "~/generated/prisma/enums";
import { normalizeItemEquipTo } from "~/utils/itemEquipTo";
import { setItemStatProgressions } from "~/utils/statProgressions";
import { setItemStatRarityOverrides } from "~/utils/statRarityOverrides";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const itemSchema = z.object({
  name: z.string().min(1),
  sprite: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  rarity: z.nativeEnum(ItemRarity),
  itemType: z.nativeEnum(ItemType).nullable().optional(),
  equipTo: z.string().nullable().optional(),
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
});

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

function parseToolEfficienciesCsv(csv: string): Array<{
  actionType: VocationalActionType;
  baseEfficiency: number;
}> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return [];

  const startIndex = lines[0]?.toLowerCase().includes("actiontype") ? 1 : 0;
  const out: Array<{ actionType: VocationalActionType; baseEfficiency: number }> = [];

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
  const out: Array<{ statType: StatType; baseValue: number; unlocksAtRarity: ItemRarity }> = [];

  for (const line of lines.slice(startIndex)) {
    const [statTypeRaw, baseRaw, unlocksRaw] = line.split(",").map((s) => s.trim());
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
  value: number;
}> {
  const lines = parseCsvLines(csv);
  if (lines.length === 0) return [];

  const startIndex = lines[0]?.toLowerCase().includes("stattype") ? 1 : 0;
  const out: Array<{ statType: StatType; rarity: ItemRarity; value: number }> = [];

  for (const line of lines.slice(startIndex)) {
    const [statTypeRaw, rarityRaw, valueRaw] = line.split(",").map((s) => s.trim());
    if (!statTypeRaw || !rarityRaw || !valueRaw) continue;

    if (!(statTypeRaw in StatType)) {
      throw new Error(`Invalid statType: ${statTypeRaw}`);
    }
    if (!(rarityRaw in ItemRarity)) {
      throw new Error(`Invalid rarity: ${rarityRaw}`);
    }

    const value = Number.parseFloat(valueRaw);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid value for ${statTypeRaw}/${rarityRaw}`);
    }

    out.push({
      statType: statTypeRaw as StatType,
      rarity: rarityRaw as ItemRarity,
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

  const body = await req.json().catch(() => null);
  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const v = parsed.data;

  const updated = await prisma.item.update({
    where: { id },
    data: {
      name: v.name,
      sprite: v.sprite,
      description: v.description ?? null,
      price: v.price,
      rarity: v.rarity,
      itemType: v.itemType ?? null,
      equipTo: normalizeItemEquipTo(v.equipTo ?? null),
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

  if (typeof v.toolEfficienciesCsv === "string") {
    const rows = parseToolEfficienciesCsv(v.toolEfficienciesCsv);
    await prisma.toolEfficiency.deleteMany({ where: { itemId: id } });
    if (rows.length > 0) {
      await prisma.toolEfficiency.createMany({
        data: rows.map((r) => ({
          itemId: id,
          actionType: r.actionType,
          baseEfficiency: r.baseEfficiency,
        })),
      });
    }
  }

  if (typeof v.baseStatsCsv === "string") {
    const baseStats = parseBaseStatsCsv(v.baseStatsCsv);
    await prisma.itemStat.deleteMany({ where: { itemId: id } });

    const merged = new Map<StatType, { value: number; maxValue: number | null }>();
    for (const s of baseStats) {
      merged.set(s.statType, { value: s.value, maxValue: s.maxValue });
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
      if (value === 0) {
        merged.delete(statType);
      } else {
        merged.set(statType, { value, maxValue: null });
      }
    }

    const stats = Array.from(merged.entries()).map(([statType, v]) => ({
      statType,
      value: v.value,
      maxValue: v.maxValue,
    }));
    if (stats.length > 0) {
      await prisma.itemStat.createMany({
        data: stats.map((s) => ({
          itemId: id,
          statType: s.statType,
          value: s.value,
          maxValue: s.maxValue,
        })),
      });
    }
  }

  if (typeof v.statProgressionsCsv === "string") {
    const progressions = parseStatProgressionsCsv(v.statProgressionsCsv);
    await setItemStatProgressions(id, progressions);
  }

  if (typeof v.statRarityOverridesCsv === "string") {
    const overrides = parseStatRarityOverridesCsv(v.statRarityOverridesCsv);
    await setItemStatRarityOverrides(id, overrides);
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
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
