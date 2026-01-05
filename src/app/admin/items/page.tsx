import Link from "next/link";
import React from "react";
import { prisma } from "~/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminItemsPage() {
  const items = await prisma.item.findMany({
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
    },
    orderBy: [{ id: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Items</h1>
          <p className="text-sm text-white/70">Create and manage item templates.</p>
        </div>
        <Link
          href="/admin/items/new"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          New Item
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/50 text-white/80">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Equip</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Stack</th>
              <th className="p-3 text-right">ID</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gray-800/60">
                <td className="p-3">
                  <Link
                    href={`/admin/items/${item.id}`}
                    className="font-semibold text-white hover:underline"
                  >
                    {item.name}
                  </Link>
                </td>
                <td className="p-3 text-white/80">{item.itemType ?? "—"}</td>
                <td className="p-3 text-white/80">{item.equipTo ?? "—"}</td>
                <td className="p-3 text-right text-white/80">{item.price}</td>
                <td className="p-3 text-right text-white/80">
                  {item.stackable ? item.maxStackSize : "—"}
                </td>
                <td className="p-3 text-right font-mono text-white/60">{item.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-white/60">
        Showing the latest {items.length} items.
      </div>
    </div>
  );
}
