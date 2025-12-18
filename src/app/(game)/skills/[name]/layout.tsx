"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  VocationalActiveActionProvider,
  useVocationalActiveActionContext,
} from "~/components/game/actions/VocationalActiveActionProvider";
import { ActionFillBar } from "~/components/game/actions/ActionFillBar";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { formatDuration } from "~/components/game/actions/format";
import { X } from "lucide-react";
import Image from "next/image";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";

type SkillProgressResponse = {
  trackKey: string;
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  xpProgress: number;
  xpRemaining: number;
};

function formatInt(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.floor(value)));
}

const SkillsLayoutContent = ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { name: string };
}) => {
  const { active, viewModel, stop, activeActionType } =
    useVocationalActiveActionContext();
  const currentActionType = toVocationalActionTypeFromSkillName(params.name);

  const decodedSkillName = useMemo(() => {
    try {
      return decodeURIComponent(params.name);
    } catch {
      return params.name;
    }
  }, [params.name]);

  const [skillProgress, setSkillProgress] = useState<SkillProgressResponse | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setProgressLoading(true);
      try {
        const res = await fetch(
          `/api/skills/progress?skill=${encodeURIComponent(decodedSkillName)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setSkillProgress(null);
          return;
        }
        const json = (await res.json()) as SkillProgressResponse;
        if (!cancelled) setSkillProgress(json);
      } catch {
        if (!cancelled) setSkillProgress(null);
      } finally {
        if (!cancelled) setProgressLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [decodedSkillName]);

  const showActive =
    active &&
    !!viewModel &&
    !!currentActionType &&
    activeActionType === currentActionType;

  return (
    <div className="flex gap-5">
      <div className="w-3/4">{children}</div>
      <div className="w-2/4">
        <Separator className="mb-5 text-sm">YOUR PROGRESS</Separator>
        <div className="mb-6 rounded-lg border border-gray-700/40 bg-gray-800 p-4">
          <div className="space-y-1">
            <div className="text-lg font-semibold text-white">{decodedSkillName}</div>
            {progressLoading ? (
              <div className="text-sm text-white/70">Loading...</div>
            ) : skillProgress ? (
              <>
                <div className="text-sm text-white/80">Lv. {skillProgress.level}</div>
                <div className="text-sm text-white/70">
                  {formatInt(skillProgress.xpRemaining)} EXP Needed
                </div>
                <div className="text-sm text-white/70">
                  {Math.floor(skillProgress.xpProgress)}%
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-[#20c05c]"
                    style={{
                      width: `${Math.floor(skillProgress.xpProgress)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="text-sm text-white/70">No progression data yet.</div>
            )}
          </div>
        </div>

        {showActive ? (
          <>
            <Separator className="mb-5 text-sm">ACTIVE</Separator>
            <div className="relative rounded-lg border border-gray-700/40 bg-gray-800 p-4">
              <div className="absolute -top-2 right-1">
                <div className="flex items-center gap-1">
                  <Badge className="bg-gray-700/60">
                    {formatDuration(viewModel.sessionRemainingSeconds)}
                  </Badge>
                  <Badge
                    onClick={stop}
                    className="cursor-pointer bg-gray-700/60 p-1"
                  >
                    <X size={13} />
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Image src={viewModel.sprite} alt="" width={1080} height={1080} className="w-14 h-14" />
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium">{viewModel.label}</p>
                    </div>
                  </div>
                  <ActionFillBar
                    value={viewModel.progress}
                    sessionAmount={viewModel.sessionAmount}
                    title={viewModel.label}
                    href={viewModel.href}
                    sprite={viewModel.sprite}
                    trackClassName="bg-white/10"
                    variant="simple"
                  />
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gray-700/60 tabular-nums">
                      + {viewModel.sessionAmount}
                    </Badge>
                    <Badge className="bg-gray-700/60">
                      Next item in: {viewModel.nextItemInSeconds}s
                    </Badge>
                    <Badge className="bg-gray-700/60">
                      {viewModel.xpPerSecond} XP/s
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

const SkillsLayout = (props: {
  children: React.ReactNode;
  params: { name: string };
}) => {
  return (
    <VocationalActiveActionProvider>
      <SkillsLayoutContent {...props} />
    </VocationalActiveActionProvider>
  );
};

export default SkillsLayout;