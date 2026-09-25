import { notFound } from "next/navigation";
import { PlayerEditor } from "~/components/admin/players/PlayerEditor";
import { requireAdminPageAccess } from "~/server/admin/auth";
import { getAdminPlayer, getAdminPlayerOptions } from "~/server/admin/players";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPlayerPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdminPageAccess();
  const [player, options] = await Promise.all([
    getAdminPlayer(params.id),
    getAdminPlayerOptions(),
  ]);
  if (!player) notFound();

  return <PlayerEditor player={player} options={options} />;
}
