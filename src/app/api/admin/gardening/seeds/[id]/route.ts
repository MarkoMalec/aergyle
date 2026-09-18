import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ItemType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchSchema = z
  .object({
    seedGrowSeconds: z.number().int().nullable().optional(),
    seedHarvestSeconds: z.number().int().nullable().optional(),
    seedYieldMin: z.number().int().nullable().optional(),
    seedYieldMax: z.number().int().nullable().optional(),
    seedYieldItemId: z.number().int().nullable().optional(),
    seedXp: z.number().int().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No fields provided",
  });

function positiveOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  const integer = Math.floor(number);
  return integer > 0 ? integer : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;
  const id = Number(context.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid seed id" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const item = await prisma.item.findUnique({
    where: { id },
    select: {
      itemType: true,
      seedGrowSeconds: true,
      seedHarvestSeconds: true,
      seedYieldMin: true,
      seedYieldMax: true,
      seedYieldItemId: true,
      seedXp: true,
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.itemType !== ItemType.SEED) {
    return NextResponse.json({ error: "Item is not a seed" }, { status: 400 });
  }

  const data = {
    seedGrowSeconds:
      "seedGrowSeconds" in parsed.data
        ? positiveOrNull(parsed.data.seedGrowSeconds)
        : item.seedGrowSeconds,
    seedHarvestSeconds:
      "seedHarvestSeconds" in parsed.data
        ? positiveOrNull(parsed.data.seedHarvestSeconds)
        : item.seedHarvestSeconds,
    seedYieldMin:
      "seedYieldMin" in parsed.data
        ? positiveOrNull(parsed.data.seedYieldMin)
        : item.seedYieldMin,
    seedYieldMax:
      "seedYieldMax" in parsed.data
        ? positiveOrNull(parsed.data.seedYieldMax)
        : item.seedYieldMax,
    seedYieldItemId:
      "seedYieldItemId" in parsed.data
        ? positiveOrNull(parsed.data.seedYieldItemId)
        : item.seedYieldItemId,
    seedXp:
      "seedXp" in parsed.data
        ? positiveOrNull(parsed.data.seedXp)
        : item.seedXp,
  };
  if (
    data.seedYieldMin !== null &&
    data.seedYieldMax !== null &&
    data.seedYieldMax < data.seedYieldMin
  ) {
    return NextResponse.json(
      { error: "Yield max must be greater than or equal to yield min" },
      { status: 400 },
    );
  }

  const updated = await prisma.item.update({
    where: { id },
    data,
    select: {
      id: true,
      seedGrowSeconds: true,
      seedHarvestSeconds: true,
      seedYieldMin: true,
      seedYieldMax: true,
      seedYieldItemId: true,
      seedXp: true,
    },
  });
  return NextResponse.json({ ok: true, item: updated });
}
