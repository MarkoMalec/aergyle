import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { NpcQuests } from "~/components/game/settlements/NpcQuests";
import { NpcSell } from "~/components/game/settlements/NpcSell";
import { NpcShop } from "~/components/game/settlements/NpcShop";
import { PresenceNotice } from "~/components/game/settlements/PresenceNotice";
import PageHeading from "~/components/game/ui/PageHeading";
import { NPC_PROFESSION_LABELS, settlementHref } from "~/game/settlements";
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
  if (!session?.user?.id) redirect("/signin");
  const settlementId = Number(params.id);
  const npcId = Number(params.npcId);
  if (!Number.isInteger(settlementId) || !Number.isInteger(npcId)) notFound();
  const data = await getNpcPage(session.user.id, settlementId, npcId);
  if (!data) notFound();
  const { npc, offers, quests } = data;

  return (
    <main className="space-y-6">
      <Link
        href={settlementHref(npc.settlement.id)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{" "}
        {npc.settlement.name}
      </Link>
      <PageHeading
        eyebrow={
          npc.profession
            ? NPC_PROFESSION_LABELS[npc.profession]
            : npc.settlement.name
        }
        title={npc.name}
      />

      <div className="grid gap-6 lg:grid-cols-[370px_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section className="game-panel overflow-hidden">
            <div className="relative mx-auto aspect-[2/3] max-w-[280px] bg-secondary/30 lg:max-w-none">
              {npc.portrait?.startsWith("/") ? (
                <Image
                  src={npc.portrait}
                  alt={npc.name}
                  fill
                  priority
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 280px, 360px"
                />
              ) : (
                <UserRound
                  className="absolute left-1/2 top-1/3 h-16 w-16 -translate-x-1/2 text-muted-foreground/40"
                  aria-hidden="true"
                />
              )}
            </div>
            {npc.description ? (
              <p className="whitespace-pre-line p-4 text-sm italic text-text-secondary">
                {npc.description}
              </p>
            ) : null}
          </section>

          {data.present && quests.length > 0 ? (
            <section className="game-panel">
              <div className="game-panel-header">
                <h2 className="game-section-title">Quests</h2>
              </div>
              <div className="p-3 pt-4">
                <NpcQuests npcId={npc.id} quests={quests} />
              </div>
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          {!data.present ? (
            <PresenceNotice
              traveling={data.traveling}
              locationName={npc.settlement.location.name}
            />
          ) : (
            <>
              {offers.length > 0 ? (
                <section className="game-panel">
                  <div className="game-panel-header">
                    <h2 className="game-section-title">Wares</h2>
                  </div>
                  <div className="game-panel-body">
                    <NpcShop offers={offers} gold={data.gold} />
                  </div>
                </section>
              ) : null}
              <section className="game-panel">
                <div className="game-panel-header">
                  <h2 className="game-section-title">Sell to {npc.name}</h2>
                </div>
                <div className="game-panel-body">
                  <NpcSell
                    npcId={npc.id}
                    npcName={npc.name}
                    inventory={data.inventory}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
