import Link from "next/link";
import React from "react";
import { prisma } from "~/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLocationsPage() {
  const locations = await prisma.location.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { resources: true } },
    },
    orderBy: [{ id: "desc" }],
    take: 500,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-sm text-white/70">Create locations and configure which resources are available.</p>
        </div>
        <Link
          href="/admin/locations/new"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          New Location
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/50 text-white/80">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-right">Resources</th>
              <th className="p-3 text-right">ID</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id} className="border-t border-gray-800/60">
                <td className="p-3">
                  <Link href={`/admin/locations/${l.id}`} className="font-semibold text-white hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className="p-3 text-right text-white/80">{l._count.resources}</td>
                <td className="p-3 text-right font-mono text-white/60">{l.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-white/60">Showing {locations.length} locations.</div>
    </div>
  );
}
