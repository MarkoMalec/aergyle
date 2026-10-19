import DungeonExplorer from "~/components/game/dungeons/DungeonExplorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Dungeons",
  description:
    "Enter a dungeon, defeat its monsters, and live to claim the loot.",
};

export default function DungeonsPage({
  searchParams,
}: {
  searchParams: { dungeon?: string };
}) {
  return (
    <main>
      {/* The region map links a dungeon here with ?dungeon=<id>. */}
      <DungeonExplorer
        initialDungeonId={Number(searchParams.dungeon) || null}
      />
    </main>
  );
}
