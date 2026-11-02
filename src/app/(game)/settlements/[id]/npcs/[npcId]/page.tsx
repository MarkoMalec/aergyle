import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NpcHero } from "~/components/game/settlements/NpcHero";
import { NpcQuests } from "~/components/game/settlements/NpcQuests";
import {
  NpcTrade,
  type QuestNeed,
} from "~/components/game/settlements/NpcTrade";
import { PresenceNotice } from "~/components/game/settlements/PresenceNotice";
import {
  npcQuestMarker,
  questMarkerKind,
  settlementHref,
} from "~/game/settlements";
import { getServerAuthSession } from "~/server/auth";
import { getNpcPage } from "~/server/settlements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NpcPage({
  params,
}: {
  params: { id: string; npcId: string };
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/play");
  const settlementId = Number(params.id);
  const npcId = Number(params.npcId);
  if (!Number.isInteger(settlementId) || !Number.isInteger(npcId)) notFound();
  const data = await getNpcPage(session.user.id, settlementId, npcId);
  if (!data) notFound();
  const { npc, offers, quests } = data;

  const open = quests.filter((quest) => quest.status !== "COMPLETED").length;
  const ready = quests.filter((quest) => quest.ready).length;
  const marker = npcQuestMarker(quests.map(questMarkerKind));
  // What this NPC's accepted quests still ask for, flagged in the shop and pack.
  const needs: QuestNeed[] = quests.flatMap((quest) =>
    quest.status === "ACTIVE"
      ? quest.objectives.flatMap((objective) =>
          objective.type === "DELIVER" && objective.target.itemId !== null
            ? [
                {
                  itemId: objective.target.itemId,
                  quantity: objective.quantity,
                  quest: quest.name,
                },
              ]
            : [],
        )
      : [],
  );

  return (
    <main className="space-y-6">
      <Link
        href={settlementHref(npc.settlement.id)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{" "}
        {npc.settlement.name}
      </Link>

      <NpcHero
        name={npc.name}
        portrait={npc.portrait}
        description={npc.description}
        profession={npc.profession?.name ?? null}
        scene={npc.settlement.mapImage ?? npc.settlement.image}
        marker={marker}
        wares={offers.length}
        quests={{ open, ready }}
      />

      {!data.present ? (
        <PresenceNotice
          traveling={data.traveling}
          locationName={npc.settlement.location.name}
        />
      ) : (
        // Quests come first on phones, as a sidebar beside the shop on wide screens.
        <div
          className={
            quests.length > 0
              ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:items-start"
              : undefined
          }
        >
          {quests.length > 0 ? (
            <section
              id="quests"
              className="game-panel-flat min-w-0 scroll-mt-6 xl:col-start-2 xl:row-start-1"
            >
              <div className="game-panel-header">
                <h2 className="game-section-title">Quests</h2>
                {ready > 0 ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                    {ready} ready
                  </span>
                ) : null}
              </div>
              <div className="p-3 pt-4">
                <NpcQuests npcId={npc.id} quests={quests} />
              </div>
            </section>
          ) : null}
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
            <NpcTrade
              npcId={npc.id}
              npcName={npc.name}
              gold={data.gold}
              offers={offers}
              inventory={data.inventory}
              needs={needs}
            />
          </div>
        </div>
      )}
    </main>
  );
}
