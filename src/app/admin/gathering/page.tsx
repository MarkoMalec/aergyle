import Link from "next/link";
import { GatheringAdminSection } from "~/components/admin/gathering/GatheringAdminSection";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminGatheringPage() {
  await requireAdminPageAccess();
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gathering Admin</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Balance location availability, resource pools, find chances,
            quantities, level gates, rarity, duration scaling, and rewards.
          </p>
          <p className="mt-2 text-xs text-white/50">
            Player Luck, Gathering level, and active bonuses are applied by the
            reward engine on top of these base values.
          </p>
        </div>
        <Link
          href="/skills/Gathering"
          className="rounded-md border border-white/10 bg-gray-900/50 px-3 py-2 text-sm text-white/80 hover:bg-gray-800"
        >
          Open player page
        </Link>
      </header>

      <GatheringAdminSection />
    </div>
  );
}
