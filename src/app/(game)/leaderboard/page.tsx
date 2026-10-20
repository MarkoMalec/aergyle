import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Leaderboard } from "~/components/game/leaderboard/Leaderboard";
import PageHeading from "~/components/game/ui/PageHeading";
import { readLeaderboardView } from "~/game/leaderboard";
import { authOptions } from "~/server/auth";
import { getLeaderboard } from "~/server/players";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Leaderboard",
  description: "Where every character ranks, by level and by skill.",
};

function updatedAgo(updatedAt: string) {
  const hours = Math.floor((Date.now() - Date.parse(updatedAt)) / 3_600_000);
  return hours < 1 ? "less than an hour ago" : `${hours} h ago`;
}

/** Ranks from a snapshot taken every 12 hours; the filters live in the URL. */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { board?: string; view?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/play");

  const view = readLeaderboardView(searchParams.view);
  const { updatedAt, ...leaderboard } = await getLeaderboard({
    board: searchParams.board,
    view,
    viewerId: session.user.id,
  });

  return (
    <div className="min-w-0 space-y-4">
      <PageHeading eyebrow="Community" title="Leaderboard" />
      <Leaderboard
        {...leaderboard}
        view={view}
        updatedAgo={updatedAgo(updatedAt)}
      />
    </div>
  );
}
