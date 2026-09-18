import DungeonExplorer from "~/components/game/dungeons/DungeonExplorer";
import PageHeading from "~/components/game/ui/PageHeading";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Dungeons",
  description:
    "Enter a dungeon, defeat its monsters, and live to claim the loot.",
};

export default function DungeonsPage() {
  return (
    <main className="space-y-6">
      <PageHeading
        eyebrow="Danger below"
        title="Dungeons"
        description="Fight through a dungeon with your current health and gear. Clear it for experience and whatever its monsters carried; fall, and you crawl out with scraps."
      />
      <DungeonExplorer />
    </main>
  );
}
