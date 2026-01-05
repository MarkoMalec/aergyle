import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "~/lib/prisma";
import { SkillForm } from "~/components/admin/skills/SkillForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEditSkillPage(props: { params: { id: string } }) {
  const id = Number(props.params.id);
  if (!Number.isFinite(id)) return notFound();

  const skill = await prisma.skills.findUnique({
    where: { skill_id: id },
    select: { skill_id: true, skill_name: true, description: true },
  });

  if (!skill) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Edit Skill</h1>
          <p className="text-sm text-white/70">Update name and description.</p>
        </div>
        <Link href="/admin/skills" className="text-sm text-white/70 hover:text-white">
          Back
        </Link>
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
        <SkillForm
          mode="edit"
          skillId={skill.skill_id}
          initialValues={{
            skill_name: skill.skill_name,
            description: skill.description ?? "",
          }}
        />
      </div>

      <div className="text-xs text-white/60">
        Note: game vocational pages map skill name → vocational action type in code.
      </div>
    </div>
  );
}
