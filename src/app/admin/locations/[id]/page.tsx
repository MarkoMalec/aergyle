import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { LocationForm } from "~/components/admin/locations/LocationForm";
import { LocationResourcesEditor } from "~/components/admin/locations/LocationResourcesEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEditLocationPage(props: { params: { id: string } }) {
  const id = Number(props.params.id);
  if (!Number.isFinite(id)) return notFound();

  const [location, resources] = await Promise.all([
    prisma.location.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        resources: { select: { resourceId: true, enabled: true } },
      },
    }),
    prisma.vocationalResource.findMany({
      select: {
        id: true,
        actionType: true,
        name: true,
        item: { select: { name: true } },
      },
      orderBy: [{ actionType: "asc" }, { name: "asc" }],
      take: 2000,
    }),
  ]);

  if (!location) return notFound();

  const resourceRows = resources.map((r) => ({
    id: r.id,
    actionType: r.actionType,
    name: r.name,
    item: r.item,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Location</h1>
          <p className="text-sm text-white/70">ID: {location.id}</p>
        </div>
        <Link href="/admin/locations" className="text-sm text-white/70 hover:text-white">
          Back
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
          <LocationForm mode="edit" locationId={location.id} initialValues={{ name: location.name }} />
        </div>

        <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
          <LocationResourcesEditor
            locationId={location.id}
            resources={resourceRows}
            assigned={location.resources}
          />
        </div>
      </div>
    </div>
  );
}
