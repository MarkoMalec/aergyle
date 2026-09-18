import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { VocationalActionType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { requireAdminApiAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const resourceSchema = z
  .object({
    resourceId: z.number().int().positive(),
    enabled: z.boolean(),
    baseChance: z.number().min(0).max(1),
    minQuantity: z.number().int().min(1).max(10_000),
    maxQuantity: z.number().int().min(1).max(10_000),
  })
  .refine((resource) => resource.maxQuantity >= resource.minQuantity, {
    message: "Maximum quantity must be at least the minimum quantity",
    path: ["maxQuantity"],
  });

const patchSchema = z.object({
  gatheringEnabled: z.boolean(),
  gatheringRequiredLevel: z.number().int().min(1).max(10_000),
  resources: z.array(resourceSchema).max(500),
});

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const denied = await requireAdminApiAccess(request);
  if (denied) return denied;

  const locationId = Number(context.params.id);
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return NextResponse.json({ error: "Invalid location id" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const resourceIds = parsed.data.resources.map(
    (resource) => resource.resourceId,
  );
  if (new Set(resourceIds).size !== resourceIds.length) {
    return NextResponse.json(
      { error: "Each Gathering resource may appear only once" },
      { status: 400 },
    );
  }

  const [location, gatheringResources] = await Promise.all([
    prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true },
    }),
    prisma.vocationalResource.findMany({
      where: {
        id: { in: resourceIds },
        actionType: VocationalActionType.GATHERING,
      },
      select: { id: true },
    }),
  ]);
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }
  if (gatheringResources.length !== resourceIds.length) {
    return NextResponse.json(
      { error: "One or more resources are not Gathering resources" },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.location.update({
      where: { id: locationId },
      data: {
        gatheringEnabled: parsed.data.gatheringEnabled,
        gatheringRequiredLevel: parsed.data.gatheringRequiredLevel,
      },
    });

    for (const resource of parsed.data.resources) {
      await transaction.locationVocationalResource.upsert({
        where: {
          locationId_resourceId: {
            locationId,
            resourceId: resource.resourceId,
          },
        },
        create: {
          locationId,
          resourceId: resource.resourceId,
          enabled: resource.enabled,
          gatheringBaseChance: resource.baseChance,
          gatheringMinQuantity: resource.minQuantity,
          gatheringMaxQuantity: resource.maxQuantity,
        },
        update: {
          enabled: resource.enabled,
          gatheringBaseChance: resource.baseChance,
          gatheringMinQuantity: resource.minQuantity,
          gatheringMaxQuantity: resource.maxQuantity,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
