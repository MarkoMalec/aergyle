import Link from "next/link";
import React from "react";
import { ChevronDown } from "lucide-react";
import { prisma } from "~/lib/prisma";
import {
  VocationResourcesTable,
  type VocationResourceRow,
} from "~/components/admin/vocations/VocationResourcesTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminVocationsPage() {
  const [resources, locationCount] = await Promise.all([
    prisma.vocationalResource.findMany({
      select: {
        id: true,
        actionType: true,
        name: true,
        itemId: true,
        requiredSkillLevel: true,
        defaultSeconds: true,
        yieldPerUnit: true,
        xpPerUnit: true,
        item: { select: { name: true, sprite: true } },
        requiredRecipeItem: { select: { name: true } },
        locations: {
          where: { enabled: true },
          select: { locationId: true },
        },
        _count: { select: { requirements: true } },
      },
      orderBy: [{ actionType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.location.count(),
  ]);

  const groups = new Map<string, VocationResourceRow[]>();
  for (const resource of resources) {
    const key = String(resource.actionType);
    const row: VocationResourceRow = {
      id: resource.id,
      name: resource.name,
      itemId: resource.itemId,
      itemName: resource.item?.name ?? null,
      itemSprite: resource.item?.sprite ?? null,
      requiredSkillLevel: resource.requiredSkillLevel,
      defaultSeconds: resource.defaultSeconds,
      yieldPerUnit: resource.yieldPerUnit,
      xpPerUnit: resource.xpPerUnit,
      recipeName: resource.requiredRecipeItem?.name ?? null,
      requirementCount: resource._count.requirements,
      enabledLocationIds: resource.locations.map(
        (location) => location.locationId,
      ),
    };

    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const groupedResources = Array.from(groups.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vocations</h1>
          <p className="text-sm text-white/70">Create vocational resources, order them per skill, and manage their per-unit requirements.</p>
        </div>
        <Link
          href="/admin/vocations/new"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          New Resource
        </Link>
      </div>

      <div className="space-y-4">
        {groupedResources.map(([actionType, items]) => (
          <details
            key={actionType}
            className="group overflow-hidden rounded-lg border border-gray-800/60 bg-gray-900/30"
            open
          >
            <summary className="cursor-pointer select-none list-none bg-gray-900/40 px-4 py-3 text-sm text-white/90 hover:bg-gray-900/50 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-semibold">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  <span>{actionType}</span>
                </div>
                <div className="text-xs text-white/60">{items.length} resources</div>
              </div>
            </summary>

            <VocationResourcesTable
              actionType={actionType}
              resources={items}
              locationCount={locationCount}
            />
          </details>
        ))}
      </div>

      <div className="text-xs text-white/60">{resources.length} resources across {groupedResources.length} skills.</div>
    </div>
  );
}
