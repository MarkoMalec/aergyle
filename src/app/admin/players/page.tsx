import { PlayersDataTable } from "~/components/admin/players/PlayersDataTable";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { listAdminPlayers } from "~/server/admin/players";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPlayersPage() {
  await requireAdminPageAccess();
  const players = await listAdminPlayers();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Players</h1>
        <p className="mt-1 text-sm text-white/70">
          Every player account, most recently online first. Open one to see and
          change everything it holds.
        </p>
      </header>
      <PlayersDataTable data={players} />
    </div>
  );
}
