import { notFound, redirect } from "next/navigation";
import { StorageDialog } from "~/components/game/settlements/StorageDialog";
import { StorageExchange } from "~/components/game/settlements/StorageExchange";
import { getServerAuthSession } from "~/server/auth";
import { getStoragePage } from "~/server/settlements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The storage over the settlement map, opened from its pin. */
export default async function StorageModal({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/play");
  const settlementId = Number(params.id);
  if (!Number.isInteger(settlementId) || settlementId < 1) notFound();
  const data = await getStoragePage(session.user.id, settlementId);
  if (!data) notFound();

  return (
    <StorageDialog
      title={data.storage.name}
      description={`In ${data.storage.settlement.name}`}
    >
      <StorageExchange data={data} />
    </StorageDialog>
  );
}
