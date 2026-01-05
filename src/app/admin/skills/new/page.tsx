import React from "react";
import Link from "next/link";
import { SkillForm } from "~/components/admin/skills/SkillForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminNewSkillPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Skill</h1>
          <p className="text-sm text-white/70">Create a new skill entry.</p>
        </div>
        <Link href="/admin/skills" className="text-sm text-white/70 hover:text-white">
          Back
        </Link>
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
        <SkillForm mode="create" />
      </div>
    </div>
  );
}
