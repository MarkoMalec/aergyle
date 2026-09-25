import { StatGrowthEditor } from "~/components/admin/character-stats/StatGrowthEditor";
import { prisma } from "~/lib/prisma";
import { getStatGrowthRules } from "~/server/stats";
import { requireAdminPageAccess } from "~/server/admin/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCharacterStatsPage() {
  await requireAdminPageAccess();
  const [rules, characters] = await Promise.all([
    getStatGrowthRules(),
    prisma.user.aggregate({ _count: { _all: true }, _max: { level: true } }),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Character Stats Admin</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/70">
          Control how a character&apos;s base stats grow with their main level.
        </p>
        <p className="mt-2 text-xs text-white/50">
          Base stats are worked out from these rules every time they are read,
          never stored per character. Edits apply at once to all{" "}
          {characters._count._all} characters. Activities already underway keep
          the stats they started with.
        </p>
      </header>

      <StatGrowthEditor
        initial={rules}
        highestLevel={characters._max.level ?? 1}
      />
    </div>
  );
}
