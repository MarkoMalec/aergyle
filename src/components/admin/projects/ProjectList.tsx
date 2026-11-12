"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { CirclePlus } from "lucide-react";
import toast from "react-hot-toast";
import { adminRequest, Field, inputClass } from "~/components/admin/fields";
import { AssetPreview } from "~/components/admin/settlements/SettlementForm";
import { Button } from "~/components/ui/button";
import { formatHours, PROJECT_PRESETS, type ProjectPreset } from "~/game/projects";
import { cn } from "~/lib/utils";
import type { ProjectListRow } from "~/server/admin/projects";

const PHASE = {
  upcoming: ["Starts later", "text-sky-300"],
  open: ["Open", "text-amber-300"],
  waiting: ["Round done", "text-emerald-300"],
  done: ["Finished", "text-emerald-300"],
  ended: ["Ended", "text-white/40"],
} as const;

/** One line per project; the whole row opens its editor. */
export function ProjectRows(props: { projects: ProjectListRow[]; showSettlement?: boolean }) {
  if (props.projects.length === 0) {
    return <p className="text-sm text-white/45">No projects yet.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {props.projects.map((project) => {
        const [label, color] = project.enabled ? PHASE[project.phase] : ["Disabled", "text-white/35"];
        return (
          <li key={project.id}>
            <Link
              href={`/admin/projects/${project.id}`}
              className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-2 hover:bg-white/[0.07]"
            >
              <AssetPreview src={project.image} width={56} height={36} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">{project.name}</strong>
                <small className="text-white/45">
                  {[
                    props.showSettlement ? `${project.settlement.name} (${project.settlement.location.name})` : null,
                    project.repeat === "ONCE"
                      ? "Once"
                      : `${project.repeat === "SCHEDULE" ? "Every" : "Repeats after"} ${formatHours(project.repeatHours)} · round ${project.round}`,
                    project.stages > 1 ? `stage ${Math.min(project.stagesReached + 1, project.stages)} of ${project.stages}` : null,
                    `${Math.floor(project.progress * 100)}% handed in`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </span>
              <span className={cn("shrink-0 text-xs", color)}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Name it, pick what kind it is, and land in the editor. */
export function NewProjectForm(props: { settlementId: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<ProjectPreset>("ONE_TIME");
  const [busy, setBusy] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const kind = PROJECT_PRESETS[preset];
      const result = await adminRequest("/api/admin/community-projects", "POST", {
        settlementId: props.settlementId,
        name: name.trim(),
        description: null,
        image: null,
        enabled: false,
        sortOrder: 0,
        repeat: kind.repeat,
        repeatHours: kind.repeatHours,
        maxRounds: null,
        startsAt: null,
        endsAt: null,
        unlockMode: kind.unlockMode,
        showFutureStages: true,
        minLevel: 1,
        requiredSkillId: null,
        requiredSkillLevel: 1,
        maxSharePercent: null,
        rewardSplit: "FLAT",
        rewardMinSharePercent: 0,
        stages: [
          { name: name.trim(), description: null, image: null, rewardGold: 0, rewardXp: 0, requirements: [], rewardItems: [], effects: [] },
        ],
      });
      toast.success("Project created (disabled). Set it up, then enable it.");
      router.push(`/admin/projects/${(result as { project: { id: number } }).project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void create(event)} className="space-y-3 rounded-lg bg-black/20 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(PROJECT_PRESETS) as ProjectPreset[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={preset === key}
            onClick={() => setPreset(key)}
            className={cn(
              "rounded-lg p-3 text-left",
              preset === key ? "bg-amber-400/15 ring-1 ring-amber-400/60" : "bg-white/[0.03] hover:bg-white/[0.07]",
            )}
          >
            <span className="block text-sm font-semibold">{PROJECT_PRESETS[key].label}</span>
            <span className="block text-xs text-white/50">{PROJECT_PRESETS[key].hint}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Name" className="min-w-[220px] flex-1">
          <input
            className={inputClass}
            value={name}
            required
            maxLength={120}
            placeholder="e.g. Rebuild the old bridge"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={busy || !name.trim()}>
          <CirclePlus className="mr-2 h-4 w-4" />
          {busy ? "Creating…" : "Create and set up"}
        </Button>
      </div>
      <p className="text-xs text-white/40">Everything can be changed afterwards; this only picks a starting point.</p>
    </form>
  );
}
