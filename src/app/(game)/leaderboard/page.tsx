import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Leaderboard } from "~/components/game/leaderboard/Leaderboard";
import PageHeading from "~/components/game/ui/PageHeading";
import { readLeaderboardScope, readLeaderboardView } from "~/game/leaderboard";
import { authOptions } from "~/server/auth";
import { getLeaderboard, listFriendIds } from "~/server/players";

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
  searchParams: { board?: string; view?: string; players?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/play");

  const view = readLeaderboardView(searchParams.view);
  const scope = readLeaderboardScope(searchParams.players);
  const friendIds =
    scope === "friends" ? await listFriendIds(session.user.id) : null;
  const { updatedAt, ...leaderboard } = await getLeaderboard({
    board: searchParams.board,
    view,
    viewerId: session.user.id,
    friendIds,
  });

  return (
    <div className="min-w-0 space-y-4">
      <PageHeading eyebrow="Community" title="Leaderboard" />
      <Leaderboard
        {...leaderboard}
        view={view}
        scope={scope}
        noFriends={friendIds !== null && friendIds.length === 0}
        updatedAgo={updatedAgo(updatedAt)}
      />
    </div>
  );
}
