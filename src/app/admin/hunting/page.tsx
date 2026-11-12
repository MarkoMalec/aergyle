import Link from "next/link";
import { HuntingAdminSection } from "~/components/admin/hunting/HuntingAdminSection";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminHuntingPage() {
  await requireAdminPageAccess();
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hunting Admin</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Control global safety guardrails, expedition scaling, hunting
            grounds, animal encounters, retaliation, accidents, and material
            drop tables.
          </p>
          <p className="mt-2 text-xs text-white/50">
            Live expeditions use departure snapshots, so balance edits affect
            the next hunt. Global safety reductions also protect hunts already
            underway; they can never make an active hunt harsher.
          </p>
        </div>
        <Link
          href="/skills/Hunting"
          className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
        >
          Open player page
        </Link>
      </header>

      <HuntingAdminSection />
    </div>
  );
}
