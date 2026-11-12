import Link from "next/link";
import { DungeonAdminSection } from "~/components/admin/dungeons/DungeonAdminSection";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDungeonsPage() {
  await requireAdminPageAccess();
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dungeons Admin</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Place dungeons in world locations, choose their monsters and how
            many fight at once, and balance monster stats and drop tables.
          </p>
          <p className="mt-2 text-xs text-white/50">
            Runs snapshot the character and monsters on entry, so edits apply to
            the next run. Dungeons grant XP only; every item comes from the
            monsters defeated inside.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dungeons"
            className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
          >
            Open player page
          </Link>
          <Link
            href="/monsters"
            className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
          >
            Open bestiary
          </Link>
        </div>
      </header>

      <DungeonAdminSection />
    </div>
  );
}
