import Link from "next/link";
import { HuntingAdminSection } from "~/components/admin/hunting/HuntingAdminSection";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminHuntingPage(props: {
  searchParams: { tab?: string };
}) {
  await requireAdminPageAccess();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Hunting Admin</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/60">
            Where animals live, what they drop, how long hunts take and how
            dangerous they may be. Hunts already underway keep their departure
            snapshot, so edits apply to the next hunt.
          </p>
        </div>
        <Link
          href="/skills/Hunting"
          className="rounded-[8px] bg-white/[0.06] px-3 py-2 text-sm text-white/80 hover:bg-white/[0.1]"
        >
          Open player page
        </Link>
      </header>

      <HuntingAdminSection tab={props.searchParams.tab} />
    </div>
  );
}
