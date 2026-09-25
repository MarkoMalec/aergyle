import Link from "next/link";
import React from "react";
import { prisma } from "~/lib/prisma";
import {
  VocationResourcesBoard,
  type VocationResourceRow,
} from "~/components/admin/vocations/VocationResourcesBoard";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { getSkillItemRules } from "~/server/vocations/skillRules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminVocationsPage() {
  await requireAdminPageAccess();
  const [resources, locationCount, itemRules] = await Promise.all([
    prisma.vocationalResource.findMany({
      select: {
        id: true,
        actionType: true,
        name: true,
        itemId: true,
        requiredRecipeItemId: true,
        requiredSkillLevel: true,
        defaultSeconds: true,
        yieldPerUnit: true,
        xpPerUnit: true,
        item: { select: { name: true, sprite: true, itemType: true } },
        requiredRecipeItem: { select: { name: true } },
        // Item types decide which skills a resource may move to.
        requirements: { select: { item: { select: { itemType: true } } } },
        locations: {
          where: { enabled: true },
          select: { locationId: true },
        },
      },
      orderBy: [{ actionType: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.location.count(),
    getSkillItemRules(),
  ]);

  const rows: VocationResourceRow[] = resources.map((resource) => ({
    id: resource.id,
    actionType: resource.actionType,
    name: resource.name,
    itemId: resource.itemId,
    itemName: resource.item?.name ?? null,
    itemSprite: resource.item?.sprite ?? null,
    itemType: resource.item?.itemType ?? null,
    requirementItemTypes: resource.requirements.map(
      (requirement) => requirement.item.itemType,
    ),
    hasRecipeGate: resource.requiredRecipeItemId !== null,
    requiredSkillLevel: resource.requiredSkillLevel,
    defaultSeconds: resource.defaultSeconds,
    yieldPerUnit: resource.yieldPerUnit,
    xpPerUnit: resource.xpPerUnit,
    recipeName: resource.requiredRecipeItem?.name ?? null,
    enabledLocationIds: resource.locations.map(
      (location) => location.locationId,
    ),
  }));
  const skillCount = new Set(rows.map((row) => row.actionType)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vocations</h1>
          <p className="text-sm text-white/70">
            Drag a row by its handle (or use the arrows) to reorder a
            skill&apos;s list; the Skill picker (or the checkboxes for several
            at once) moves resources to another skill. Nothing is stored until
            you save from the bar at the bottom.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/vocations/rules"
            className="rounded-md border border-gray-700 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-gray-800 hover:text-white"
          >
            Item Rules
          </Link>
          <Link
            href="/admin/vocations/new"
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            New Resource
          </Link>
        </div>
      </div>

      <VocationResourcesBoard
        resources={rows}
        locationCount={locationCount}
        itemRules={itemRules}
      />

      <div className="text-xs text-white/60">
        {rows.length} resources across {skillCount} skills.
      </div>
    </div>
  );
}
