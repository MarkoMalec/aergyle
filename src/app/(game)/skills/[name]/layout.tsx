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
import { NearbyPlayers } from "~/components/game/skills/NearbyPlayers";
import { SkillMetricsPanel } from "~/components/game/skills/SkillMetricsPanel";
import { SkillProgressPanel } from "~/components/game/skills/SkillProgressPanel";
import type { SkillMetrics } from "~/server/skills/metrics";

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
  const [metrics, setMetrics] = useState<SkillMetrics | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setProgressLoading(true);
      const skill = encodeURIComponent(decodedSkillName);
      try {
        const [progressRes, metricsRes] = await Promise.all([
          fetch(`/api/skills/progress?skill=${skill}`, { cache: "no-store" }),
          fetch(`/api/skills/metrics?skill=${skill}`, { cache: "no-store" }),
        ]);
        if (!cancelled) {
          setSkillProgress(
            progressRes.ok
              ? ((await progressRes.json()) as SkillProgressResponse)
              : null,
          );
          setMetrics(
            metricsRes.ok ? ((await metricsRes.json()) as SkillMetrics) : null,
          );
        }
      } catch {
        if (!cancelled) {
          setSkillProgress(null);
          setMetrics(null);
        }
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
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="game-section-label">Nearby</h2>
            <NearbyPlayers />
          </section>

          <section>
            <h2 className="game-section-label">Your progress</h2>
            <SkillProgressPanel
              skillName={decodedSkillName}
              progress={skillProgress}
              loading={progressLoading}
            />
          </section>

          {showActive ? (
            <section>
              <h2 className="game-section-label">Current activity</h2>
              <div className="game-panel-flat relative p-4">
                <div className="absolute -top-2 right-1">
                  <div className="flex items-center gap-1">
                    <Badge className="border-transparent bg-secondary">
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
                        <Badge className="border-transparent bg-secondary tabular-nums">
                          + {viewModel.sessionAmount}
                        </Badge>
                        {viewModel.nextItemInTime ? (
                          <Badge className="border-transparent bg-secondary tabular-nums">
                            Next item in: {viewModel.nextItemInTime}
                          </Badge>
                        ) : null}
                        {Number(viewModel.xpPerSecond) > 0 ? (
                          <Badge className="border-transparent bg-secondary">
                            {viewModel.xpPerSecond} XP/s
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="game-section-label">Metrics</h2>
            <SkillMetricsPanel metrics={metrics} loading={progressLoading} />
          </section>
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
