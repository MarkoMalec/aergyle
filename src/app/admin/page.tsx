import Link from "next/link";
import React from "react";
import ItemImportForm from "~/components/admin/ItemImportForm";
import { countOpenReports } from "~/server/communication";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const openReports = await countOpenReports();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-white/70">
          Manage items, vocations, skills, and balancing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link
          href="/admin/items"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Items</div>
          <div className="mt-1 text-sm text-white/70">
            Create, edit, delete items
          </div>
        </Link>

        <Link
          href="/admin/gardening"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Gardening</div>
          <div className="mt-1 text-sm text-white/70">
            Manage seeds, yields, and harvest timings
          </div>
        </Link>

        <Link
          href="/admin/gathering"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Gathering</div>
          <div className="mt-1 text-sm text-white/70">
            Balance expeditions, locations, pools, and rewards
          </div>
        </Link>

        <Link
          href="/admin/vocations"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Vocations</div>
          <div className="mt-1 text-sm text-white/70">
            Manage vocational resources + requirements
          </div>
        </Link>

        <Link
          href="/admin/locations"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Locations</div>
          <div className="mt-1 text-sm text-white/70">
            Create locations and assign resources
          </div>
        </Link>

        <Link
          href="/admin/settlements"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Settlements</div>
          <div className="mt-1 text-sm text-white/70">
            NPCs, their shops and quests, and community projects
          </div>
        </Link>

        <Link
          href="/admin/travel"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Travel</div>
          <div className="mt-1 text-sm text-white/70">
            Set travel times between locations
          </div>
        </Link>

        <Link
          href="/admin/skills"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Skills</div>
          <div className="mt-1 text-sm text-white/70">
            Create and edit skills
          </div>
        </Link>

        <Link
          href="/admin/leveling"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Leveling</div>
          <div className="mt-1 text-sm text-white/70">
            XP table and brackets
          </div>
        </Link>

        <Link
          href="/admin/character-stats"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="text-sm font-semibold">Character stats</div>
          <div className="mt-1 text-sm text-white/70">
            Base stats and how they grow with level
          </div>
        </Link>

        <Link
          href="/admin/moderation"
          className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4 hover:bg-gray-900/60"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            Moderation
            {openReports > 0 ? (
              <span className="rounded bg-amber-400/20 px-1.5 text-[11px] font-semibold tabular-nums text-amber-300">
                {openReports} new
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-sm text-white/70">
            Reported conversations, and writing to players
          </div>
        </Link>
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-4">
        <div className="mb-3 text-sm font-semibold">CSV Import/Export</div>
        <ItemImportForm />
      </div>
    </div>
  );
}
