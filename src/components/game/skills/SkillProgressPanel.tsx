"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { getSkillIcon } from "~/components/game/ui/Sidebars/navigation-links";
import type { SkillProgressResponse } from "./SkillProgressContext";

function formatInt(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.floor(value)));
}

/**
 * The skill's level and experience, collapsible so the column can be reduced
 * to a single glanceable row.
 */
export function SkillProgressPanel({
  skillName,
  progress,
  loading,
}: {
  skillName: string;
  progress: SkillProgressResponse | null;
  loading: boolean;
}) {
  const [open, setOpen] = useState(true);
  const Icon = getSkillIcon(skillName);
  const percent = progress ? Math.floor(progress.xpProgress) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="game-panel-flat">
      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-4 pb-3 pt-4 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/30 text-primary">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="truncate text-[15px] font-semibold text-foreground">
          {skillName}
        </span>
        {!open && progress ? (
          <span className="shrink-0 rounded-md bg-secondary/50 px-2 py-0.5 text-xs font-semibold text-foreground">
            Lv. {progress.level}
          </span>
        ) : null}
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={`ml-auto shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
        <span className="sr-only">
          {open ? "Hide" : "Show"} {skillName} progress
        </span>
      </CollapsibleTrigger>

      <div className="px-4 pb-4">
        <div
          className="game-progress-track"
          role="progressbar"
          aria-label={`${skillName} experience`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="game-progress-fill" style={{ width: `${percent}%` }} />
        </div>

        <CollapsibleContent>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {loading ? (
              <span className="text-xs text-muted-foreground">
                Loading progress…
              </span>
            ) : progress ? (
              <>
                <span className="rounded-md bg-secondary/50 px-2.5 py-1 text-xs font-semibold text-foreground">
                  Lv. {progress.level}
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-md bg-secondary/30 px-2.5 py-1 text-xs tabular-nums text-text-secondary">
                    {formatInt(progress.xpRemaining)} XP needed
                  </span>
                  <span className="rounded-md bg-secondary/50 px-2 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                    {percent}%
                  </span>
                </span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                No progression data yet.
              </span>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
