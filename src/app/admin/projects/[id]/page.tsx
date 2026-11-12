import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectEditor } from "~/components/admin/projects/ProjectEditor";
import { WorldCrumbs } from "~/components/admin/world/WorldNav";
import { settlementHref } from "~/game/settlements";
import { loadProjectEditor } from "~/server/admin/projects";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminProjectPage({ params }: { params: { id: string } }) {
  await requireAdminPageAccess();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const data = await loadProjectEditor(id);
  if (!data) notFound();
  const { settlement } = data.meta;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <WorldCrumbs
            trail={[
              { label: settlement.location.name, href: `/admin/world/${settlement.location.id}?tab=settlements` },
              { label: settlement.name, href: `/admin/settlements/${settlement.id}` },
              { label: data.project.name },
            ]}
          />
          <h1 className="text-3xl font-bold">{data.project.name}</h1>
          <p className="text-sm text-white/60">Community project in {settlement.name}</p>
        </div>
        <Link
          href={settlementHref(settlement.id)}
          className="rounded-md bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
        >
          Open player page
        </Link>
      </header>
      {/* Remount after a save so the draft matches what was stored. */}
      <ProjectEditor key={data.meta.updatedAt} data={data} />
    </div>
  );
}
