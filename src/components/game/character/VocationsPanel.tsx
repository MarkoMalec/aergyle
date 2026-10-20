"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock3, Package, Trophy, type LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { getSkillIcon } from "~/components/game/ui/Sidebars/navigation-links";
import { formatLength } from "~/components/game/actions/format";
import { cn } from "~/lib/utils";
import type { VocationSummary } from "~/server/skills/overview";

const integer = new Intl.NumberFormat("en-US");

/** Lifetime time: "45 min", "2 h 30 min", or whole hours from ten hours on. */
function formatTimeSpent(seconds: number) {
  if (seconds <= 0) return "—";
  return seconds >= 36_000
    ? `${integer.format(Math.floor(seconds / 3_600))} h`
    : formatLength(seconds);
}

const GROUPS = [
  { category: "VOCATION", title: "Gathering" },
  { category: "CRAFTING", title: "Crafting" },
] as const;

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-surface-inset/55 px-3 py-2.5">
      <Icon
        className="hidden h-4 w-4 shrink-0 text-primary [@container(min-width:420px)]:block"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function SkillTile({
  skill,
  linked,
}: {
  skill: VocationSummary;
  /** Opens the skill's page; off on another player's profile. */
  linked: boolean;
}) {
  const Icon = getSkillIcon(skill.name);
  const { level, xpProgress, xpRemaining } = skill.progress;
  const percent = Math.max(0, Math.min(100, xpProgress));
  const started = skill.progress.currentXp > 0 || level > 1;
  const tileClass =
    "group relative isolate flex h-[66px] min-w-0 items-center gap-3 overflow-hidden rounded-xl bg-surface-inset/60 pl-2.5 pr-3 transition-colors duration-150 hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const content = (
    <>
      {skill.banner ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 right-0 -z-10 w-3/4 bg-cover bg-center opacity-40 transition-opacity duration-200 [mask-image:linear-gradient(to_right,transparent,#000_75%)] group-hover:opacity-70"
          style={{ backgroundImage: `url(${skill.banner})` }}
        />
      ) : null}
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-background/60 text-primary">
        {skill.icon ? (
          <Image
            src={skill.icon}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-contain drop-shadow-[0_3px_6px_rgb(0_0_0/0.35)]"
          />
        ) : (
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13px] font-semibold",
            started ? "text-foreground" : "text-text-secondary",
          )}
        >
          {skill.name}
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span
            className="block h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-background/65"
            role="progressbar"
            aria-label={`${skill.name} experience`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(percent)}
          >
            <span
              className="block h-full rounded-full bg-xp"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="shrink-0 rounded-md bg-background/75 px-1.5 py-px text-[11px] font-semibold tabular-nums text-foreground">
            Lv {level}
          </span>
        </span>
      </span>
    </>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {linked ? (
          <Link
            href={`/skills/${encodeURIComponent(skill.name)}`}
            className={tileClass}
          >
            {content}
          </Link>
        ) : (
          <div tabIndex={0} className={tileClass}>
            {content}
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="w-56 space-y-1.5 py-2.5">
        <p className="text-[13px] font-semibold text-foreground">
          {skill.name} · Level {level}
        </p>
        <p className="tabular-nums text-text-secondary">
          {Math.floor(percent)}% · {integer.format(Math.ceil(xpRemaining))} XP
          to {level + 1}
        </p>
        {skill.secondsSpent > 0 || skill.itemsGathered > 0 ? (
          <p className="tabular-nums text-muted-foreground">
            {integer.format(skill.itemsGathered)} items ·{" "}
            {formatTimeSpent(skill.secondsSpent)} spent
          </p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export function VocationsPanel({
  skills,
  linked = true,
  className,
}: {
  skills: VocationSummary[];
  /** Tiles open the skill's page; off on another player's profile. */
  linked?: boolean;
  className?: string;
}) {
  const totalLevel = skills.reduce(
    (sum, skill) => sum + skill.progress.level,
    0,
  );
  const secondsSpent = skills.reduce(
    (sum, skill) => sum + skill.secondsSpent,
    0,
  );
  const itemsGathered = skills.reduce(
    (sum, skill) => sum + skill.itemsGathered,
    0,
  );

  return (
    <section
      aria-labelledby="vocations-heading"
      className={cn(
        "game-panel-flat min-w-0 p-4 [container-type:inline-size] sm:p-6",
        className,
      )}
    >
      <h2 id="vocations-heading" className="game-section-title mb-4">
        Vocations
      </h2>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <Fact
          icon={Trophy}
          label="Total level"
          value={integer.format(totalLevel)}
        />
        <Fact
          icon={Clock3}
          label="Time spent"
          value={formatTimeSpent(secondsSpent)}
        />
        <Fact
          icon={Package}
          label="Items"
          value={integer.format(itemsGathered)}
        />
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="grid gap-5">
          {GROUPS.map(({ category, title }) => {
            const group = skills.filter((skill) => skill.category === category);
            if (group.length === 0) return null;
            return (
              <section key={category} aria-label={title}>
                <h3 className="mb-2 text-[11px] font-semibold text-muted-foreground">
                  {title}
                </h3>
                <div className="grid gap-2 [@container(min-width:360px)]:grid-cols-2">
                  {group.map((skill) => (
                    <SkillTile key={skill.name} skill={skill} linked={linked} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </TooltipProvider>
    </section>
  );
}
