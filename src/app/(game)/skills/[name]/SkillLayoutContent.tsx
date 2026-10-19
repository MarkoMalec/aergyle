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

const SkillLayoutContent = ({
  children,
  params,
  icon,
}: {
  children: React.ReactNode;
  params: { name: string };
  /** Painted skill icon, when one exists. */
  icon: string | null;
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
              icon={icon}
              progress={skillProgress}
              loading={progressLoading}
            />
          </section>

          {showActive ? (
            <section>
              <h2 className="game-section-label">Current activity</h2>
              <div className="game-panel-flat flex items-center gap-3 p-4">
                {viewModel.sprite && (
                  <Image
                    src={viewModel.sprite}
                    alt=""
                    width={1080}
                    height={1080}
                    className="h-14 w-14 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium">
                      {viewModel.label}
                    </p>
                    <Badge className="shrink-0 border-transparent bg-secondary tabular-nums">
                      {formatDuration(viewModel.sessionRemainingSeconds)}
                    </Badge>
                    {viewModel.canStop ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="-my-1 -mr-1.5 h-8 w-8 shrink-0"
                        onClick={stop}
                        aria-label="Stop active action"
                      >
                        <X size={16} />
                      </Button>
                    ) : null}
                  </div>
                  <ActionFillBar
                    value={viewModel.progress}
                    previewValue={viewModel.previewProgress}
                    sessionAmount={viewModel.sessionAmount}
                    title={viewModel.label}
                    href={viewModel.href}
                    sprite={viewModel.sprite}
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
            </section>
          ) : null}

          <section>
            <h2 className="game-section-label">Metrics</h2>
            <SkillMetricsPanel metrics={metrics} loading={progressLoading} />
          </section>
        </div>
      </div>
    </>
  );
};

export default SkillLayoutContent;
