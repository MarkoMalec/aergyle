import { redirect } from "next/navigation";
import { PlaceMap, type MapPlace } from "~/components/game/map/PlaceMap";
import { PLACE_ICONS } from "~/components/game/map/placeIcons";
import { NewQuestsDot } from "~/components/game/settlements/NewQuestsDot";
import { PresenceNotice } from "~/components/game/settlements/PresenceNotice";
import PageHeading from "~/components/game/ui/PageHeading";
import { DUNGEON_DIFFICULTY_LABELS } from "~/game/creatures";
import { SETTLEMENT_KIND_LABELS, settlementHref } from "~/game/settlements";
import { getAtlasLocationMarker } from "~/game/world/atlasLocations";
import { mapPoint } from "~/game/world/maps";
import { getServerAuthSession } from "~/server/auth";
import { getRegionPage } from "~/server/settlements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Region",
  description: "The settlements, dungeons and hunting grounds around you.",
};

export default async function RegionPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/signin");
  const { traveling, location } = await getRegionPage(session.user.id);
  const atlas = location ? getAtlasLocationMarker(location.name) : null;

  const places: MapPlace[] = location
    ? [
        ...location.settlements.map((settlement) => ({
          key: `settlement-${settlement.id}`,
          name: settlement.name,
          detail: SETTLEMENT_KIND_LABELS[settlement.kind],
          group: "Settlements",
          href: settlementHref(settlement.id),
          variant: "settlement" as const,
          face: <PLACE_ICONS.settlement />,
          indicator: (
            <NewQuestsDot
              settlementId={settlement.id}
              className="-right-1.5 -top-1.5"
            />
          ),
          point: mapPoint(settlement),
        })),
        // The dungeon and hunting pages open with this place selected.
        ...location.dungeons.map((dungeon) => ({
          key: `dungeon-${dungeon.id}`,
          name: dungeon.name,
          detail: `${DUNGEON_DIFFICULTY_LABELS[dungeon.difficulty]} · Level ${dungeon.requiredLevel}`,
          group: "Dungeons",
          href: `/dungeons?dungeon=${dungeon.id}`,
          locked: !dungeon.unlocked,
          variant: "place" as const,
          face: <PLACE_ICONS.dungeon />,
          point: mapPoint(dungeon),
        })),
        ...location.huntingGrounds.map((ground) => ({
          key: `ground-${ground.id}`,
          name: ground.name,
          detail: `Hunting ${ground.requiredHuntingLevel}`,
          group: "Hunting grounds",
          href: `/skills/Hunting?ground=${ground.id}`,
          locked: !ground.unlocked,
          variant: "place" as const,
          face: <PLACE_ICONS.ground />,
          point: mapPoint(ground),
        })),
      ]
    : [];

  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow={atlas?.region ?? "Region"}
        title={location?.name ?? "Region"}
        description={atlas?.description}
      />
      {location ? (
        <PlaceMap
          image={location.mapImage}
          alt={`Map of ${location.name}`}
          places={places}
          emptyText={`Nothing has been charted in ${location.name} yet.`}
        />
      ) : (
        <PresenceNotice traveling={traveling} locationName={null} />
      )}
    </main>
  );
}
