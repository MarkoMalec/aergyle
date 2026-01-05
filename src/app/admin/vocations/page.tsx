import Image from "next/image";
import Link from "next/link";
import React from "react";
import { ChevronDown } from "lucide-react";
import { prisma } from "~/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminVocationsPage() {
  const resources = await prisma.vocationalResource.findMany({
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
      item: { select: { name: true, sprite: true } },
      _count: { select: { requirements: true } },
    },
    orderBy: [{ id: "desc" }],
    take: 300,
  });

  const groups = new Map<string, typeof resources>();
  for (const resource of resources) {
    const key = String(resource.actionType);
    const existing = groups.get(key);
    if (existing) {
      existing.push(resource);
    } else {
      groups.set(key, [resource]);
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
          <p className="text-sm text-white/70">Create vocational resources and manage their per-unit requirements.</p>
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

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/50 text-white/80">
                  <tr>
                    <th className="w-0 p-3 text-left"></th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Output Item</th>
                    <th className="p-3 text-right">Req Lvl</th>
                    <th className="p-3 text-right">Sec</th>
                    <th className="p-3 text-right">Yield</th>
                    <th className="p-3 text-right">XP</th>
                    <th className="p-3 text-right">Reqs</th>
                    <th className="p-3 text-right">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-gray-800/60">
                      <td className="w-[56px]">
                        {r.item?.sprite ? (
                          <Image
                            src={r.item.sprite}
                            alt={r.item?.name ?? r.name}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-md object-contain ml-2"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-800/60" />
                        )}
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/admin/vocations/${r.id}`}
                          className="font-semibold text-white hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="p-3 text-white/80">
                        {r.item?.name ?? "—"}{" "}
                        <span className="font-mono text-white/50">#{r.itemId}</span>
                      </td>
                      <td className="p-3 text-right text-white/80">{r.requiredSkillLevel}</td>
                      <td className="p-3 text-right text-white/80">{r.defaultSeconds}</td>
                      <td className="p-3 text-right text-white/80">{r.yieldPerUnit}</td>
                      <td className="p-3 text-right text-white/80">{r.xpPerUnit}</td>
                      <td className="p-3 text-right text-white/80">{r._count.requirements}</td>
                      <td className="p-3 text-right font-mono text-white/60">{r.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>

      <div className="text-xs text-white/60">Showing the latest {resources.length} resources.</div>
    </div>
  );
}
