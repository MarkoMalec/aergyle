import Link from "next/link";
import React from "react";
import { prisma } from "~/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSkillsPage() {
  const skills = await prisma.skills.findMany({
    select: {
      skill_id: true,
      skill_name: true,
      description: true,
    },
    orderBy: [{ skill_name: "asc" }],
    take: 500,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="text-sm text-white/70">Manage the base skills list (name + description).</p>
        </div>
        <Link
          href="/admin/skills/new"
          className="rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          New Skill
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-800/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/50 text-white/80">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-right">ID</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.skill_id} className="border-t border-gray-800/60">
                <td className="p-3">
                  <Link
                    href={`/admin/skills/${s.skill_id}`}
                    className="font-semibold text-white hover:underline"
                  >
                    {s.skill_name}
                  </Link>
                </td>
                <td className="p-3 text-white/80">
                  {s.description ? (
                    <span className="line-clamp-2">{s.description}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-3 text-right font-mono text-white/60">{s.skill_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-white/60">Showing {skills.length} skills.</div>
    </div>
  );
}
