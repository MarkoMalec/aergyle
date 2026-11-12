"use client";

import Image from "next/image";
import { useState } from "react";
import { CircleCheck, Gift, Hammer, Lock, Repeat, Trophy } from "lucide-react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { ProjectView } from "~/server/settlements";
import type { ProjectStageView } from "~/server/settlements/projects";
import { contributionShare } from "~/server/settlements/rules";
import { useSettlementAction } from "./useSettlementAction";

function formatShare(share: number) {
  const percent = share * 100;
  return `${percent > 0 && percent < 10 ? percent.toFixed(1) : Math.floor(percent)}%`;
}

/** "in 2 d 5 h" style countdown, rounded to what matters. */
function timeUntil(iso: string) {
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function rewardText(reward: { gold: number; xp: number; items: number | Array<{ name: string; quantity: number }> }) {
  const items =
    typeof reward.items === "number"
      ? reward.items > 0
        ? [`${reward.items} item${reward.items === 1 ? "" : "s"}`]
        : []
      : reward.items.map((item) => `${item.name} ×${item.quantity}`);
  return [
    reward.gold > 0 ? `${reward.gold.toLocaleString()} gold` : null,
    reward.xp > 0 ? `${reward.xp.toLocaleString()} XP` : null,
    ...items,
  ]
    .filter(Boolean)
    .join(", ");
}

function Requirement(props: {
  projectId: number;
  requirement: ProjectStageView["requirements"][number];
  open: boolean;
  capped: boolean;
}) {
  const { requirement } = props;
  const { run, pending } = useSettlementAction();
  const most = requirement.canGive;
  const [quantity, setQuantity] = useState(Math.max(1, most));
  // Holdings shrink after contributing, so never offer more than is left.
  const amount = Math.min(quantity, Math.max(1, most));
  const key = `give:${props.projectId}:${requirement.item.id}`;
  const done = requirement.contributed >= requirement.quantity;

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <ItemArtwork
        src={requirement.item.sprite}
        name={requirement.item.name}
        rarity={requirement.item.rarity}
        size={48}
        itemId={requirement.item.id}
      />
      <div className="min-w-[180px] flex-1">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <strong className="truncate">{requirement.item.name}</strong>
          <span className={`tabular-nums ${done ? "text-success" : "text-muted-foreground"}`}>
            {requirement.contributed.toLocaleString()} / {requirement.quantity.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-inset">
          <div
            className={`h-full rounded-full ${done ? "bg-success" : "bg-primary"}`}
            style={{ width: `${Math.floor((requirement.contributed / requirement.quantity) * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          You gave {requirement.mine.toLocaleString()} · you hold {requirement.held.toLocaleString()}
          {props.capped && !done && most < 1 && requirement.held > 0 ? " · you've given your share" : ""}
        </p>
      </div>
      {props.open && !done ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            aria-label={`How many ${requirement.item.name} to give`}
            className="h-9 w-24"
            min={1}
            max={Math.max(1, most)}
            value={amount}
            disabled={most < 1}
            onChange={(event) => {
              const value = Math.floor(Number(event.target.value));
              setQuantity(Number.isFinite(value) ? Math.min(Math.max(1, most), Math.max(1, value)) : 1);
            }}
          />
          <Button
            variant="secondary"
            disabled={pending !== null || most < 1}
            title={most < 1 ? `You can't give ${requirement.item.name} right now` : undefined}
            onClick={() =>
              void run(
                key,
                "/api/settlements/projects/contribute",
                { projectId: props.projectId, itemId: requirement.item.id, quantity: amount },
                (result) =>
                  result.completed
                    ? `${String(result.stage ?? result.name)} reached! Thank you.`
                    : `You gave ${requirement.item.name} ×${amount}`,
              )
            }
          >
            {pending === key ? "Giving…" : "Contribute"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function Stage(props: { project: ProjectView; stage: ProjectStageView }) {
  const { project, stage } = props;
  const multi = project.stageCount > 1;
  const reward = rewardText(stage.reward);
  const open = project.phase === "open" && !project.blocked && stage.state === "current";

  if (multi && stage.state !== "current") {
    return (
      <li className="flex items-center gap-3 rounded-lg bg-secondary/20 px-3 py-2 text-sm">
        {stage.state === "reached" ? (
          <CircleCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className={stage.state === "reached" ? "" : "text-muted-foreground"}>
            {stage.position}. {stage.name}
          </span>
          {reward ? <span className="block text-xs text-muted-foreground">Helpers get {reward}</span> : null}
        </span>
        <span className="text-xs text-muted-foreground">
          {stage.state === "reached" ? "Built" : `${stage.requirements.length} items`}
        </span>
      </li>
    );
  }

  return (
    <li className="space-y-1">
      {multi ? (
        <div className="rounded-lg bg-primary/10 px-3 py-2">
          <p className="text-sm font-semibold text-primary">
            Now building: {stage.position}. {stage.name}
          </p>
          {stage.description ? (
            <p className="whitespace-pre-line text-xs text-text-secondary">{stage.description}</p>
          ) : null}
        </div>
      ) : null}
      {reward ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Gift className="h-3.5 w-3.5 text-currency" aria-hidden="true" />
          {project.rewardSplit === "FLAT" ? "Every helper gets" : "Helpers share, by what they gave,"} {reward}
          {project.rewardMinSharePercent > 0 ? ` (give at least ${project.rewardMinSharePercent}%)` : ""}
        </p>
      ) : null}
      <ul className="divide-y divide-border">
        {stage.requirements.map((requirement) => (
          <Requirement
            key={requirement.item.id}
            projectId={project.id}
            requirement={requirement}
            open={open}
            capped={project.maxSharePercent !== null}
          />
        ))}
      </ul>
    </li>
  );
}

function Status({ project }: { project: ProjectView }) {
  const progress = contributionShare(project.requirements);
  const label =
    project.phase === "done"
      ? "Completed"
      : project.phase === "waiting"
        ? "Round complete"
        : `${formatShare(progress)} built`;
  const done = project.phase === "done" || project.phase === "waiting";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${done ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"}`}
    >
      {label}
    </span>
  );
}

function ClaimRewards({ project }: { project: ProjectView }) {
  const { run, pending } = useSettlementAction();
  if (project.unclaimed.length === 0) return null;
  return (
    <ul className="space-y-2">
      {project.unclaimed.map((reward) => (
        <li
          key={reward.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-currency/30 bg-currency/10 px-3 py-2 text-sm"
        >
          <Gift className="h-4 w-4 text-currency" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Your reward for <strong>{reward.stage}</strong>
            {project.repeat !== "ONCE" ? ` (round ${reward.round})` : ""}: {rewardText(reward)}
          </span>
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() =>
              void run(
                `claim:${reward.id}`,
                "/api/settlements/projects/claim",
                { rewardId: reward.id },
                () => `Claimed ${rewardText(reward)}`,
              )
            }
          >
            {pending === `claim:${reward.id}` ? "Claiming…" : "Claim"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Project({ project }: { project: ProjectView }) {
  const youInTop = project.leaderboard.some((row) => row.you);
  const current = project.stages.find((stage) => stage.state === "current");
  const image = current?.image ?? project.image;

  return (
    <article className="game-panel overflow-hidden">
      {image?.startsWith("/") ? (
        <div className="relative h-36 w-full">
          <Image src={image} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 960px" />
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
      ) : null}
      <div className="game-panel-body space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="game-section-title flex items-center gap-2">
              {project.phase === "done" ? (
                <CircleCheck className="h-5 w-5 text-success" aria-hidden="true" />
              ) : (
                <Hammer className="h-5 w-5 text-primary" aria-hidden="true" />
              )}
              {project.name}
            </h3>
            {project.description ? (
              <p className="mt-1 whitespace-pre-line text-sm text-text-secondary">{project.description}</p>
            ) : null}
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground" suppressHydrationWarning>
              {project.repeat !== "ONCE" ? (
                <span className="inline-flex items-center gap-1">
                  <Repeat className="h-3 w-3" aria-hidden="true" />
                  Round {project.round}
                </span>
              ) : null}
              {project.until && project.phase === "open" ? <span>Closes in {timeUntil(project.until)}</span> : null}
              {project.until && project.phase === "waiting" ? <span>Next round in {timeUntil(project.until)}</span> : null}
              {project.maxSharePercent ? <span>Up to {project.maxSharePercent}% of each item per player</span> : null}
            </p>
          </div>
          <Status project={project} />
        </div>

        <ClaimRewards project={project} />

        {project.blocked && project.phase === "open" ? (
          <p className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" aria-hidden="true" />
            {project.blocked} to help with this project.
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          {project.phase === "open" || project.stageCount > 1 ? (
            <ol className="space-y-2">
              {project.stages.map((stage) => (
                <Stage key={stage.position} project={project} stage={stage} />
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              {project.phase === "waiting"
                ? "Everything was handed in this round. Thank you, everyone!"
                : "Finished. Thank you, everyone!"}
            </p>
          )}

          <aside className="rounded-xl bg-secondary/20 p-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-currency" aria-hidden="true" />
              Top contributors{project.repeat !== "ONCE" ? " this round" : ""}
            </h4>
            {project.leaderboard.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No one has contributed yet. Be the first.</p>
            ) : (
              <ol className="mt-2 space-y-1 text-sm">
                {project.leaderboard.map((row, index) => (
                  <li
                    key={`${row.name}-${index}`}
                    className={`flex justify-between gap-2 rounded-md px-2 py-1 ${row.you ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <span className="truncate">
                      <span className="mr-2 tabular-nums text-muted-foreground">{index + 1}.</span>
                      {row.name}
                    </span>
                    <span className="tabular-nums">{formatShare(row.share)}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {project.contributors} contributor{project.contributors === 1 ? "" : "s"}
              {project.rank !== null && !youInTop ? ` · you are #${project.rank} with ${formatShare(project.share)}` : ""}
            </p>
          </aside>
        </div>
      </div>
    </article>
  );
}

export function CommunityProjects({ projects }: { projects: ProjectView[] }) {
  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <Project key={project.id} project={project} />
      ))}
    </div>
  );
}

