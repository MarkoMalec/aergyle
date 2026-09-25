import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StorageExchange } from "~/components/game/settlements/StorageExchange";
import PageHeading from "~/components/game/ui/PageHeading";
import { settlementHref } from "~/game/settlements";
import { getServerAuthSession } from "~/server/auth";
import { getStoragePage } from "~/server/settlements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** The storage on its own page: a direct visit, a refresh or a share. */
export default async function StoragePage({
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
    <main className="space-y-6">
      <Link
        href={settlementHref(settlementId)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />{" "}
        {data.storage.settlement.name}
      </Link>
      <PageHeading
        eyebrow={`Storage in ${data.storage.settlement.name}`}
        title={data.storage.name}
        description={data.storage.description ?? undefined}
      />
      <StorageExchange data={data} />
    </main>
  );
}
