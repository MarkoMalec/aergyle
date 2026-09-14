import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";
import { ItemType } from "~/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSchema = z
  .object({
    seedGrowSeconds: z.number().int().nullable().optional(),
    seedHarvestSeconds: z.number().int().nullable().optional(),
    seedYieldMin: z.number().int().nullable().optional(),
    seedYieldMax: z.number().int().nullable().optional(),
    seedYieldItemId: z.number().int().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields provided" });

function toOptionalPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.floor(n);
  return int > 0 ? int : null;
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const denied = await requireAdminApiAccess(req);
  if (denied) return denied;

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors?.[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: {
      id: true,
      itemType: true,
      seedGrowSeconds: true,
      seedHarvestSeconds: true,
      seedYieldMin: true,
      seedYieldMax: true,
      seedYieldItemId: true,
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (item.itemType !== ItemType.SEED) {
    return NextResponse.json({ error: "Item is not a seed" }, { status: 400 });
  }

  const nextGrow =
    "seedGrowSeconds" in parsed.data
      ? toOptionalPositiveInt(parsed.data.seedGrowSeconds)
      : item.seedGrowSeconds;
  const nextHarvest =
    "seedHarvestSeconds" in parsed.data
      ? toOptionalPositiveInt(parsed.data.seedHarvestSeconds)
      : item.seedHarvestSeconds;
  const nextMin =
    "seedYieldMin" in parsed.data
      ? toOptionalPositiveInt(parsed.data.seedYieldMin)
      : item.seedYieldMin;
  const nextMax =
    "seedYieldMax" in parsed.data
      ? toOptionalPositiveInt(parsed.data.seedYieldMax)
      : item.seedYieldMax;
  const nextYieldItemId =
    "seedYieldItemId" in parsed.data
      ? toOptionalPositiveInt(parsed.data.seedYieldItemId)
      : item.seedYieldItemId;

  if (
    typeof nextMin === "number" &&
    typeof nextMax === "number" &&
    Number.isFinite(nextMin) &&
    Number.isFinite(nextMax) &&
    nextMax < nextMin
  ) {
    return NextResponse.json(
      { error: "Yield max must be >= yield min" },
      { status: 400 },
    );
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      seedGrowSeconds: nextGrow,
      seedHarvestSeconds: nextHarvest,
      seedYieldMin: nextMin,
      seedYieldMax: nextMax,
      seedYieldItemId: nextYieldItemId,
    },
    select: {
      id: true,
      seedGrowSeconds: true,
      seedHarvestSeconds: true,
      seedYieldMin: true,
      seedYieldMax: true,
      seedYieldItemId: true,
    },
  });

  return NextResponse.json({ ok: true, item: updated });
}
