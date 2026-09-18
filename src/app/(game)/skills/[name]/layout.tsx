"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import { ActionFillBar } from "~/components/game/actions/ActionFillBar";
import { Badge } from "~/components/ui/badge";
import { formatDuration } from "~/components/game/actions/format";
import { Button } from "~/components/ui/button";
import { X } from "lucide-react";
import Image from "next/image";
import { toVocationalActionTypeFromSkillName } from "~/utils/vocations";
import SkillPageHeader from "./SkillPageHeader";
import {
  SkillProgressProvider,
  type SkillProgressResponse,
} from "~/components/game/skills/SkillProgressContext";
import { addSkillProgressEventListener } from "~/components/game/skills/skillProgressEvents";

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

  const [skillProgress, setSkillProgress] =
    useState<SkillProgressResponse | null>(null);
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
    const removeProgressListener = addSkillProgressEventListener(
      (skillName) => {
        if (skillName.toLowerCase() === decodedSkillName.toLowerCase()) {
          void load();
        }
      },
    );
    return () => {
      cancelled = true;
      removeProgressListener();
    };
  }, [decodedSkillName]);

  const showActive =
    active &&
    !!viewModel &&
    !!currentActionType &&
    activeActionType === currentActionType;

  return (
    <>
      <SkillPageHeader skillName={decodedSkillName} />
      <div className="game-skill-layout">
        <div className="min-w-0">
          <SkillProgressProvider
            value={{ skillProgress, progressLoading: progressLoading }}
          >
            {children}
          </SkillProgressProvider>
        </div>
        <div className="min-w-0">
          <div className="game-panel mb-6">
            <div className="space-y-1">
              <h2 className="game-panel-header text-base font-semibold text-foreground">
                {decodedSkillName} Progress
              </h2>
              {progressLoading ? (
                <div className="game-panel-body space-y-3">
                  <div className="game-progress-track"></div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <Badge className="text-xs">Level </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      XP to next level
                    </span>
                  </div>
                </div>
              ) : skillProgress ? (
                <div className="game-panel-body space-y-3">
                  <div
                    className="game-progress-track"
                    role="progressbar"
                    aria-label={`${decodedSkillName} experience`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.floor(skillProgress.xpProgress)}
                  >
                    <div
                      className="game-progress-fill"
                      style={{
                        width: `${Math.floor(skillProgress.xpProgress)}%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <Badge className="text-xs">
                      Level {skillProgress.level}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatInt(skillProgress.xpRemaining)} XP to next level
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No progression data yet.
                </div>
              )}
            </div>
          </div>

          {showActive ? (
            <>
              <h2 className="mb-3 text-sm font-semibold text-text-secondary">
                Current activity
              </h2>
              <div className="relative rounded-lg border border-border bg-card p-4">
                <div className="absolute -top-2 right-1">
                  <div className="flex items-center gap-1">
                    <Badge className="bg-secondary">
                      {formatDuration(viewModel.sessionRemainingSeconds)}
                    </Badge>
                    {viewModel.canStop ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={stop}
                        aria-label="Stop active action"
                      >
                        <X size={16} />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {viewModel.sprite && (
                    <Image
                      src={viewModel.sprite}
                      alt=""
                      width={1080}
                      height={1080}
                      className="h-14 w-14"
                    />
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{viewModel.label}</p>
                      </div>
                    </div>
                    <ActionFillBar
                      value={viewModel.progress}
                      previewValue={viewModel.previewProgress}
                      sessionAmount={viewModel.sessionAmount}
                      title={viewModel.label}
                      href={viewModel.href}
                      sprite={viewModel.sprite}
                      // trackClassName="bg-white/10"
                      // fillClassName="bg-yellow-400"
                      // tickClassName="bg-yellow-500/20"
                      variant="simple"
                    />
                    {activeActionType !== "GATHERING" &&
                    activeActionType !== "HUNTING" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-secondary tabular-nums">
                          + {viewModel.sessionAmount}
                        </Badge>
                        {viewModel.nextItemInTime ? (
                          <Badge className="bg-secondary tabular-nums">
                            Next item in: {viewModel.nextItemInTime}
                          </Badge>
                        ) : null}
                        {Number(viewModel.xpPerSecond) > 0 ? (
                          <Badge className="bg-secondary">
                            {viewModel.xpPerSecond} XP/s
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
      {decodedSkillName.toLowerCase() === "woodcutting" && (
        <blockquote className="mt-8 max-w-2xl border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground">
          <p className="font-display italic">
            “Me ma said to always be careful with sharp objects. But if ye want
            to be a great woodcutter, ye gotta take some risks!”
          </p>
          <cite className="mt-2 block text-xs not-italic text-primary">
            Roger the Lumberjack
          </cite>
        </blockquote>
      )}
    </>
  );
};

const SkillsLayout = (props: {
  children: React.ReactNode;
  params: { name: string };
}) => {
  return <SkillsLayoutContent {...props} />;
};

export default SkillsLayout;
