import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { VocationalResourceForm } from "~/components/admin/vocations/VocationalResourceForm";
import { ResourceLocationsEditor } from "~/components/admin/vocations/ResourceLocationsEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEditVocationResourcePage(props: { params: { id: string } }) {
  const id = Number(props.params.id);
  if (!Number.isFinite(id)) return notFound();

  const [items, resource] = await Promise.all([
    prisma.item.findMany({
      select: { id: true, name: true, itemType: true },
      orderBy: [{ name: "asc" }],
      take: 1000,
    }),
    prisma.vocationalResource.findUnique({
      where: { id },
      select: {
        id: true,
        actionType: true,
        name: true,
        itemId: true,
        requiredSkillLevel: true,
        defaultSeconds: true,
        yieldPerUnit: true,
        xpPerUnit: true,
        rarity: true,
        requirements: {
          select: { itemId: true, quantityPerUnit: true },
          orderBy: [{ id: "asc" }],
        },
        locations: {
          select: { locationId: true, enabled: true },
          orderBy: [{ locationId: "asc" }],
        },
      },
    }),
  ]);

  const locations = await prisma.location.findMany({
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }],
    take: 1000,
  });

  if (!resource) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Vocational Resource</h1>
          <p className="text-sm text-white/70">Update outputs and per-unit requirements.</p>
        </div>
        <Link href="/admin/vocations" className="text-sm text-white/70 hover:text-white">
          Back
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-1">
        <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
          <VocationalResourceForm
            mode="edit"
            resourceId={resource.id}
            items={items}
            initialValues={{
              actionType: resource.actionType,
              name: resource.name,
              itemId: resource.itemId,
              requiredSkillLevel: resource.requiredSkillLevel,
              defaultSeconds: resource.defaultSeconds,
              yieldPerUnit: resource.yieldPerUnit,
              xpPerUnit: resource.xpPerUnit,
              rarity: resource.rarity,
              requirements: resource.requirements,
            }}
          />
        </div>

        <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
          <ResourceLocationsEditor
            resourceId={resource.id}
            locations={locations}
            assigned={resource.locations}
          />
        </div>
      </div>
    </div>
  );
}
