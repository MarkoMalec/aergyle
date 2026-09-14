import Link from "next/link";
import React from "react";
import Image from "next/image";
import { prisma } from "~/lib/prisma";
import { ItemType } from "~/generated/prisma/enums";
import { GatheringSeedsTableClient } from "~/components/admin/gathering/GatheringSeedsTableClient";

export default async function AdminGatheringPage() {
  const seeds = await prisma.item.findMany({
    where: { itemType: ItemType.SEED },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sprite: true,
      seedGrowSeconds: true,
      seedHarvestSeconds: true,
      seedYieldItemId: true,
      seedYieldMin: true,
      seedYieldMax: true,
      seedYieldItem: { select: { id: true, name: true, sprite: true } },
    },
  });

  const yieldedResources = new Map<
    number,
    { id: number; name: string; sprite: string; seedCount: number }
  >();
  for (const s of seeds) {
    const yi = s.seedYieldItem;
    if (!yi) continue;
    const prev = yieldedResources.get(yi.id);
    if (prev) prev.seedCount += 1;
    else yieldedResources.set(yi.id, { ...yi, seedCount: 1 });
  }

  const resources = [...yieldedResources.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const missingConfigCount = seeds.filter(
    (s) =>
      !s.seedGrowSeconds ||
      !s.seedHarvestSeconds ||
      !s.seedYieldItem ||
      !s.seedYieldMin ||
      !s.seedYieldMax ||
      (typeof s.seedYieldMin === "number" &&
        typeof s.seedYieldMax === "number" &&
        s.seedYieldMax < s.seedYieldMin),
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Gathering (Garden) Admin</h1>
        <p className="mt-1 text-sm text-white/70">
          Overview of seed items and their grow/harvest/yield configuration.
        </p>
        <p className="mt-1 text-sm text-white/70">Time fields are in seconds.</p>
        <div className="mt-2 text-sm text-white/70">
          Seeds: <span className="text-white">{seeds.length}</span>
          {" · "}
          Yield resources: <span className="text-white">{resources.length}</span>
          {" · "}
          Missing config: <span className="text-white">{missingConfigCount}</span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Seeds</div>
            <div className="mt-1 text-sm text-white/70">
              Click a seed to open the full item editor. Use the pencil icons to
              edit values inline.
            </div>
          </div>
          <Link
            href="/admin/items/new"
            className="rounded-md bg-gray-800/70 px-3 py-2 text-sm text-white/90 hover:bg-gray-800"
          >
            New item
          </Link>
        </div>

        <GatheringSeedsTableClient initialSeeds={seeds} />
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4">
        <div className="text-sm font-semibold">Yield resources</div>
        <div className="mt-1 text-sm text-white/70">
          Items that are yielded by at least one seed.
        </div>

        {resources.length === 0 ? (
          <div className="mt-3 text-sm text-white/70">
            No yield items configured yet.
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {resources.map((r) => (
              <Link
                key={r.id}
                href={`/admin/items/${r.id}`}
                className="flex items-center justify-between rounded-md border border-white/10 bg-gray-900/20 px-3 py-2 hover:bg-gray-900/40"
              >
                <span className="flex items-center gap-2">
                  <Image
                    src={r.sprite}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 object-contain"
                  />
                  <span className="text-sm font-medium text-white/90">
                    {r.name}
                  </span>
                  <span className="text-sm text-white/50">#{r.id}</span>
                </span>
                <span className="text-sm text-white/70">
                  used by {r.seedCount}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
