import Image from "next/image";
import Link from "next/link";
import { ItemType } from "~/generated/prisma/enums";
import { prisma } from "~/lib/prisma";
import { GardeningSeedsTableClient } from "~/components/admin/gardening/GardeningSeedsTableClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminGardeningPage() {
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
      seedXp: true,
      seedYieldItem: { select: { id: true, name: true, sprite: true } },
    },
  });
  const yieldedResources = new Map<
    number,
    { id: number; name: string; sprite: string; seedCount: number }
  >();
  for (const seed of seeds) {
    if (!seed.seedYieldItem) continue;
    const current = yieldedResources.get(seed.seedYieldItem.id);
    if (current) current.seedCount += 1;
    else
      yieldedResources.set(seed.seedYieldItem.id, {
        ...seed.seedYieldItem,
        seedCount: 1,
      });
  }
  const resources = [...yieldedResources.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const missingConfigCount = seeds.filter(
    (seed) =>
      !seed.seedGrowSeconds ||
      !seed.seedHarvestSeconds ||
      !seed.seedYieldItem ||
      !seed.seedYieldMin ||
      !seed.seedYieldMax ||
      !seed.seedXp ||
      seed.seedYieldMax < seed.seedYieldMin,
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Gardening Admin</h1>
        <p className="mt-1 text-sm text-white/70">
          Balance seeds, plot growth, harvest time, crop yield, and Gardening
          XP.
        </p>
        <div className="mt-2 text-sm text-white/70">
          Seeds: <span className="text-white">{seeds.length}</span> · Yield
          resources: <span className="text-white">{resources.length}</span> ·
          Missing config:{" "}
          <span className="text-white">{missingConfigCount}</span>
        </div>
      </div>

      <section className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Plantable seeds</h2>
            <p className="mt-1 text-sm text-white/70">
              Edit common balance values inline or open the full item template.
            </p>
          </div>
          <Link
            href="/admin/items/new"
            className="rounded-md bg-gray-800/70 px-3 py-2 text-sm text-white/90 hover:bg-gray-800"
          >
            New seed item
          </Link>
        </div>
        <GardeningSeedsTableClient initialSeeds={seeds} />
      </section>

      <section className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4">
        <h2 className="text-sm font-semibold">Crop resources</h2>
        <p className="mt-1 text-sm text-white/70">
          Items yielded by at least one configured seed.
        </p>
        {resources.length === 0 ? (
          <p className="mt-3 text-sm text-white/70">
            No crop yield items are configured.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {resources.map((resource) => (
              <Link
                key={resource.id}
                href={`/admin/items/${resource.id}`}
                className="flex items-center justify-between rounded-md border border-white/10 bg-gray-900/20 px-3 py-2 hover:bg-gray-900/40"
              >
                <span className="flex items-center gap-2">
                  <Image
                    src={resource.sprite}
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 object-contain"
                  />
                  <span className="text-sm font-medium text-white/90">
                    {resource.name}
                  </span>
                </span>
                <span className="text-sm text-white/70">
                  {resource.seedCount} seed type
                  {resource.seedCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
