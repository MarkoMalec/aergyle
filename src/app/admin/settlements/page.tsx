import Link from "next/link";
import { NewSettlementForm } from "~/components/admin/settlements/NewSettlementForm";
import { SETTLEMENT_KIND_LABELS } from "~/game/settlements";
import { prisma } from "~/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSettlementsPage() {
  const [locations, npcs, offers, quests, openProjects] = await Promise.all([
    prisma.location.findMany({
      orderBy: [{ requiredLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        settlements: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            kind: true,
            enabled: true,
            _count: { select: { npcs: true, projects: true } },
          },
        },
      },
    }),
    prisma.npc.count(),
    prisma.npcOffer.count(),
    prisma.quest.count(),
    prisma.communityProject.count({
      where: { enabled: true, completedAt: null },
    }),
  ]);

  const stats = [
    {
      label: "Settlements",
      value: locations.reduce((sum, row) => sum + row.settlements.length, 0),
    },
    { label: "NPCs", value: npcs },
    { label: "Items for sale", value: offers },
    { label: "Quests", value: quests },
    { label: "Open projects", value: openProjects },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Settlements</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/70">
          Each location can hold any number of villages, towns or cities.
          Settlements hold NPCs (each with a shop and quests) and community
          projects. Players must be at the location to use its settlements.
        </p>
        <p className="mt-2 text-xs text-white/50">
          Open a settlement to edit it, add NPCs and run community projects.
          Open an NPC to set up what it sells and the quests it gives.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div
            className="rounded-lg border border-white/10 bg-gray-900/35 p-3"
            key={stat.label}
          >
            <div className="text-2xl font-semibold">{stat.value}</div>
            <div className="text-xs text-white/50">{stat.label}</div>
          </div>
        ))}
      </div>

      <NewSettlementForm
        locations={locations.map(({ id, name }) => ({ id, name }))}
      />

      <div className="space-y-4">
        {locations.map((location) => (
          <section
            key={location.id}
            className="rounded-xl border border-white/10 bg-gray-950/45 p-4"
          >
            <h2 className="text-sm font-semibold text-white/80">
              {location.name}
            </h2>
            {location.settlements.length === 0 ? (
              <p className="mt-2 text-sm text-white/40">No settlements yet.</p>
            ) : (
              <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {location.settlements.map((settlement) => (
                  <li key={settlement.id}>
                    <Link
                      href={`/admin/settlements/${settlement.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3 hover:bg-gray-900/60"
                    >
                      <span className="min-w-0">
                        <strong className="block truncate">
                          {settlement.name}
                        </strong>
                        <small className="text-white/45">
                          {SETTLEMENT_KIND_LABELS[settlement.kind]} ·{" "}
                          {settlement._count.npcs} NPCs ·{" "}
                          {settlement._count.projects} projects
                        </small>
                      </span>
                      <span
                        className={
                          settlement.enabled
                            ? "text-xs text-emerald-300"
                            : "text-xs text-white/35"
                        }
                      >
                        {settlement.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
