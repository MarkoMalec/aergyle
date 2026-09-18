import Link from "next/link";
import React from "react";
import { prisma } from "~/lib/prisma";
import { ItemsDataTable } from "~/components/admin/items/ItemsDataTable";
import {
  ATLAS_EQUIPMENT,
  atlasSpritePath,
} from "../../../../prisma/content/atlasEquipment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminItemsPage({
  searchParams,
}: {
  searchParams: { collection?: string };
}) {
  const showAtlas = searchParams.collection === "atlas-v1";
  const items = await prisma.item.findMany({
    where: showAtlas
      ? { sprite: { in: ATLAS_EQUIPMENT.map(atlasSpritePath) } }
      : undefined,
    select: {
      id: true,
      name: true,
      sprite: true,
      price: true,
      rarity: true,
      itemType: true,
      equipTo: true,
      stackable: true,
      maxStackSize: true,
      requiredLevel: true,
    },
    orderBy: [{ id: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {showAtlas ? "Atlas equipment" : "Items"}
          </h1>
          <p className="text-sm text-white/70">
            {showAtlas
              ? "Five weapons · Trailwarden Rare set, level 1 · Duskwarden Epic set, level 50"
              : "Create and manage item templates."}
          </p>
        </div>
        <Link
          href="/admin/items/new"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          New Item
        </Link>
      </div>

      <nav className="flex gap-4 text-sm" aria-label="Item collections">
        <Link
          href="/admin/items"
          className="text-white/80 hover:underline"
          aria-current={!showAtlas ? "page" : undefined}
        >
          All items
        </Link>
        <Link
          href="/admin/items?collection=atlas-v1"
          className="text-white/80 hover:underline"
          aria-current={showAtlas ? "page" : undefined}
        >
          Atlas equipment
        </Link>
      </nav>

      <ItemsDataTable key={showAtlas ? "atlas-v1" : "all"} data={items} />
    </div>
  );
}
