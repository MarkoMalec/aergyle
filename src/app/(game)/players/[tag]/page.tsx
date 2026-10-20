import { cache } from "react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { StaticCharacterSheetProvider } from "~/components/game/character/CharacterSheetContext";
import { AttributeSheet } from "~/components/game/character/AttributeSheet";
import { VocationsPanel } from "~/components/game/character/VocationsPanel";
import { StatArtProvider } from "~/components/game/character/stat-display";
import { ActivityCharts } from "~/components/game/players/ActivityCharts";
import { PlayerAbout } from "~/components/game/players/PlayerAbout";
import { PlayerEquipment } from "~/components/game/players/PlayerEquipment";
import { PlayerHero } from "~/components/game/players/PlayerHero";
import { ProfileComments } from "~/components/game/players/ProfileComments";
import { authOptions } from "~/server/auth";
import { playerProfileHref, playerTag } from "~/game/players";
import { getPlayerProfile, listProfileComments } from "~/server/players";
import { findPlayerByTag } from "~/server/players/names";
import { listPublicArt } from "~/server/publicAssets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// The page and its metadata look the player up once per request.
const playerByTag = cache(findPlayerByTag);

/** The tag as typed in the URL; Next may hand it over still encoded. */
function readTag(param: string) {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { tag: string };
}) {
  const player = await playerByTag(readTag(params.tag));
  return { title: player ? `${player.name} · Aergyle` : "Aergyle" };
}

/**
 * A player's profile, at /@Name (the middleware rewrites it here): the
 * character sheet, read-only, with worn gear but never the bag, plus what
 * they're doing, how active they have been and a comment wall. The owner sees
 * the same page; their gear is managed on /inventory.
 */
const PlayerProfilePage = async ({ params }: { params: { tag: string } }) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/play");

  const tag = readTag(params.tag);
  const player = await playerByTag(tag);
  if (!player) notFound();
  // One address per player: /@test-name or /@Test name land on /@Test-name.
  if (playerTag(player.name).normalize("NFC") !== tag.normalize("NFC")) {
    redirect(playerProfileHref(player.name));
  }

  const [profile, comments, statArt] = await Promise.all([
    getPlayerProfile(player.id),
    listProfileComments({ viewerId: session.user.id, profileId: player.id }),
    listPublicArt("assets/stats"),
  ]);
  if (!profile) notFound();

  const isOwner = profile.id === session.user.id;

  return (
    <main>
      <StatArtProvider slugs={statArt}>
        <StaticCharacterSheetProvider sheet={profile.sheet}>
          <PlayerHero profile={profile} isOwner={isOwner} />
          {/*
            Two columns from xl: equipment over vocations, and About and
            Activity over the attribute sheet. Below 1280px the columns dissolve and `order` keeps
            about, activity, equipment, attributes, vocations.
          */}
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(420px,540px)_minmax(508px,1fr)]">
            <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
              <div className="order-3 min-w-0">
                <PlayerEquipment equipment={profile.equipment} />
              </div>
              <VocationsPanel
                skills={profile.vocations}
                linked={isOwner}
                className="order-5"
              />
            </div>
            <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
              <PlayerAbout
                bio={profile.bio}
                createdAt={profile.createdAt}
                history={profile.history}
                isOwner={isOwner}
                className="order-1"
              />
              <ActivityCharts history={profile.history} className="order-2" />
              <AttributeSheet className="order-4" />
            </div>
          </div>
          <ProfileComments
            profileId={profile.id}
            profileName={profile.name}
            isOwner={isOwner}
            initialPage={comments}
          />
        </StaticCharacterSheetProvider>
      </StatArtProvider>
    </main>
  );
};

export default PlayerProfilePage;
