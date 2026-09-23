import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NpcHead } from "~/components/game/map/NpcHead";
import { PlaceMap, type MapPlace } from "~/components/game/map/PlaceMap";
import { StorageFace } from "~/components/game/map/StorageFace";
import { CommunityProjects } from "~/components/game/settlements/CommunityProjects";
import { NewQuestsDot } from "~/components/game/settlements/NewQuestsDot";
import { PresenceNotice } from "~/components/game/settlements/PresenceNotice";
import PageHeading from "~/components/game/ui/PageHeading";
import {
  NPC_PROFESSION_LABELS,
  npcHref,
  SETTLEMENT_KIND_LABELS,
  storageHref,
} from "~/game/settlements";
import { headCrop, mapPoint } from "~/game/world/maps";
import { formatGold } from "~/lib/marketplace";
import { getServerAuthSession } from "~/server/auth";
import { getSettlementPage } from "~/server/settlements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettlementPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/signin");
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const data = await getSettlementPage(session.user.id, id);
  if (!data) notFound();
  const { settlement, npcs, projects, storage } = data;
  const people: MapPlace[] = npcs.map((npc) => ({
    key: `npc-${npc.id}`,
    name: npc.name,
    detail: [
      npc.profession ? NPC_PROFESSION_LABELS[npc.profession] : null,
      npc.questsReady > 0
        ? "Quest ready"
        : npc.questsAvailable > 0
          ? `${npc.questsAvailable} new quest${npc.questsAvailable === 1 ? "" : "s"}`
          : null,
      npc.wares > 0 ? "Trades" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    group: "People",
    href: npcHref(settlement.id, npc.id),
    ready: npc.questsReady > 0,
    variant: "person",
    face: <NpcHead portrait={npc.portrait} crop={headCrop(npc)} />,
    indicator: <NewQuestsDot npcId={npc.id} className="-right-1.5 -top-1.5" />,
    point: mapPoint(npc),
  }));
  // The storage stands with the NPCs on the settlement's own map.
  const places: MapPlace[] = storage
    ? [
        ...people,
        {
          key: "storage",
          name: storage.name,
          detail:
            storage.used === null
              ? `Rent for ${formatGold(storage.unlockCost)} gold`
              : `${storage.used} / ${storage.slots} slots used`,
          group: "Storage",
          href: storageHref(settlement.id),
          variant: "place",
          face: <StorageFace icon={storage.icon} />,
          point: mapPoint(storage),
        },
      ]
    : people;

  return (
    <main className="space-y-6">
      <Link
        href="/region"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{" "}
        {settlement.location.name}
      </Link>
      <PageHeading
        eyebrow={`${SETTLEMENT_KIND_LABELS[settlement.kind]} in ${settlement.location.name}`}
        title={settlement.name}
        description={settlement.description ?? undefined}
      />
      {/* The map shows the settlement; the banner stands in until it has one. */}
      {!settlement.mapImage && settlement.image?.startsWith("/") ? (
        <div className="relative h-48 overflow-hidden rounded-xl border border-border md:h-64">
          <Image
            src={settlement.image}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1200px"
          />
        </div>
      ) : null}

      {!data.present ? (
        <PresenceNotice
          traveling={data.traveling}
          locationName={settlement.location.name}
        />
      ) : (
        <>
          <PlaceMap
            image={settlement.mapImage}
            alt={`Map of ${settlement.name}`}
            places={places}
            emptyText="No one is around right now."
          />

          {projects.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="game-section-title">Community projects</h2>
                <p className="text-sm text-muted-foreground">
                  Everyone in the realm builds these together. Hand in what is
                  needed; finished projects change what {settlement.name} has to
                  offer.
                </p>
              </div>
              <CommunityProjects projects={projects} />
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
