"use client";

import Image from "next/image";
import { useState } from "react";
import { CircleCheck, Hammer, Trophy } from "lucide-react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { ProjectView } from "~/server/settlements";
import { contributionShare } from "~/server/settlements/rules";
import { useSettlementAction } from "./useSettlementAction";

function formatShare(share: number) {
  const percent = share * 100;
  return `${percent > 0 && percent < 10 ? percent.toFixed(1) : Math.floor(percent)}%`;
}

function Requirement(props: {
  projectId: number;
  requirement: ProjectView["requirements"][number];
  open: boolean;
}) {
  const { requirement } = props;
  const { run, pending } = useSettlementAction();
  const remaining = requirement.quantity - requirement.contributed;
  const most = Math.min(requirement.held, remaining);
  const [quantity, setQuantity] = useState(Math.max(1, most));
  // Holdings shrink after contributing, so never offer more than is left.
  const amount = Math.min(quantity, Math.max(1, most));
  const key = `give:${props.projectId}:${requirement.item.id}`;
  const done = remaining <= 0;

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
          <span
            className={`tabular-nums ${done ? "text-success" : "text-muted-foreground"}`}
          >
            {requirement.contributed.toLocaleString()} /{" "}
            {requirement.quantity.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-inset">
          <div
            className={`h-full rounded-full ${done ? "bg-success" : "bg-primary"}`}
            style={{
              width: `${Math.floor((requirement.contributed / requirement.quantity) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          You gave {requirement.mine.toLocaleString()} · you hold{" "}
          {requirement.held.toLocaleString()}
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
              setQuantity(
                Number.isFinite(value)
                  ? Math.min(Math.max(1, most), Math.max(1, value))
                  : 1,
              );
            }}
          />
          <Button
            variant="secondary"
            disabled={pending !== null || most < 1}
            title={
              most < 1 ? `You have no ${requirement.item.name}` : undefined
            }
            onClick={() =>
              void run(
                key,
                "/api/settlements/projects/contribute",
                {
                  projectId: props.projectId,
                  itemId: requirement.item.id,
                  quantity: amount,
                },
                (result) =>
                  result.completed
                    ? `${String(result.name)} is complete! Thank you.`
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

function Project({ project }: { project: ProjectView }) {
  const completed = project.completedAt !== null;
  const progress = contributionShare(project.requirements);
  const youInTop = project.leaderboard.some((row) => row.you);

  return (
    <article className="game-panel overflow-hidden">
      {project.image?.startsWith("/") ? (
        <div className="relative h-36 w-full">
          <Image
            src={project.image}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 960px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
      ) : null}
      <div className="game-panel-body space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="game-section-title flex items-center gap-2">
              {completed ? (
                <CircleCheck
                  className="h-5 w-5 text-success"
                  aria-hidden="true"
                />
              ) : (
                <Hammer className="h-5 w-5 text-primary" aria-hidden="true" />
              )}
              {project.name}
            </h3>
            {project.description ? (
              <p className="mt-1 whitespace-pre-line text-sm text-text-secondary">
                {project.description}
              </p>
            ) : null}
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${completed ? "border-success/30 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"}`}
          >
            {completed ? "Completed" : `${formatShare(progress)} built`}
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <ul className="divide-y divide-border">
            {project.requirements.map((requirement) => (
              <Requirement
                key={requirement.item.id}
                projectId={project.id}
                requirement={requirement}
                open={!completed}
              />
            ))}
          </ul>

          <aside className="rounded-xl bg-secondary/20 p-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-currency" aria-hidden="true" />
              Top contributors
            </h4>
            {project.leaderboard.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No one has contributed yet. Be the first.
              </p>
            ) : (
              <ol className="mt-2 space-y-1 text-sm">
                {project.leaderboard.map((row, index) => (
                  <li
                    key={`${row.name}-${index}`}
                    className={`flex justify-between gap-2 rounded-md px-2 py-1 ${row.you ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <span className="truncate">
                      <span className="mr-2 tabular-nums text-muted-foreground">
                        {index + 1}.
                      </span>
                      {row.name}
                    </span>
                    <span className="tabular-nums">
                      {formatShare(row.share)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {project.contributors} contributor
              {project.contributors === 1 ? "" : "s"}
              {project.rank !== null && !youInTop
                ? ` · you are #${project.rank} with ${formatShare(project.share)}`
                : ""}
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
