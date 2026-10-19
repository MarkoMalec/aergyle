"use client";

/**
 * Building blocks shared by the timed PvE screens (Dungeons, Hunting): the
 * location chip, the journal button and modal, the active-run card and the
 * small stat tiles. Surfaces are separated by tint, never by borders.
 */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  ChevronDown,
  Crosshair,
  MapPin,
  Sparkles,
  Swords,
  type LucideIcon,
} from "lucide-react";
import type { CreatureAttackStyle, ItemRarity } from "~/generated/prisma/enums";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import {
  formatAgo,
  formatRemaining,
  formatTime,
} from "~/components/game/actions/format";
import { cn } from "~/lib/utils";

type Reward = {
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

type Face = { id: number; name: string; asset: string };

export const ATTACK_STYLE_ICON: Record<CreatureAttackStyle, LucideIcon> = {
  MELEE: Swords,
  RANGED: Crosshair,
  MAGIC: Sparkles,
};

export function LocationChip({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm shadow-sm",
        className,
      )}
    >
      <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span className="font-semibold">{name}</span>
      <Link
        href="/map"
        className="ml-1 rounded-full px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Atlas
      </Link>
    </div>
  );
}

/** Opens the journal; shows how the latest entry went. */
export function JournalButton(props: {
  count: number;
  last: { good: boolean; label: string } | null;
  onClick: (() => void) | null;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick ?? undefined}
      disabled={!props.onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-[8px] pl-3 pr-2 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        props.className,
      )}
    >
      <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
      Journal
      {props.last ? (
        <span className="hidden items-center gap-1.5 text-xs font-normal text-muted-foreground sm:inline-flex">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              props.last.good ? "bg-success" : "bg-danger",
            )}
          />
          {props.last.label}
        </span>
      ) : null}
      <span className="rounded-[6px] bg-secondary px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
        {props.count}
      </span>
    </button>
  );
}

export function Fact(props: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  const Icon = props.icon;
  return (
    <div className="min-w-0 rounded-[12px] bg-surface-inset/60 px-3 py-2.5">
      <dt className="flex items-start gap-1.5 text-[11px] leading-tight text-muted-foreground">
        <Icon
          className="hidden h-3.5 w-3.5 shrink-0 sm:block"
          aria-hidden="true"
        />
        <span className="min-w-0">{props.label}</span>
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums leading-snug",
          props.tone,
        )}
      >
        {props.value}
      </dd>
    </div>
  );
}

export function StatRow(props: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  const Icon = props.icon;
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] bg-secondary/20 px-3 py-2 text-sm">
      <Icon
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <dt className="flex-1 text-muted-foreground">{props.label}</dt>
      <dd className="text-right">
        <span className="font-semibold tabular-nums">{props.value}</span>
        {props.note ? (
          <span className="ml-1.5 text-[11px] text-muted-foreground">
            {props.note}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

/** Small overlapping portraits, e.g. the creatures in a dungeon or ground. */
export function CreatureFaces({
  creatures,
  size = 28,
  limit = 3,
  decorative = false,
}: {
  creatures: Face[];
  size?: 28 | 36;
  limit?: number;
  /** Inside a control that already names them. */
  decorative?: boolean;
}) {
  return (
    <span
      className="flex shrink-0 -space-x-2"
      aria-hidden={decorative || undefined}
    >
      {creatures.slice(0, limit).map((creature) => (
        <Image
          key={creature.id}
          src={creature.asset}
          alt={decorative ? "" : creature.name}
          title={decorative ? undefined : creature.name}
          width={size}
          height={size}
          className={cn(
            "rounded-full bg-surface-inset object-contain ring-2 ring-card group-data-[selected=true]:ring-accent",
            size === 28 ? "h-7 w-7" : "h-9 w-9",
          )}
        />
      ))}
    </span>
  );
}

/** A run or expedition in progress: countdown, route bar and its action. */
export function ActiveExpeditionCard(props: {
  status: "ACTIVE" | "READY" | "CLAIMED";
  startedAt: string;
  endsAt: string;
  now: number;
  eyebrow: { active: string; ready: string };
  title: string;
  meta: ReactNode;
  route: { from: LucideIcon; to: LucideIcon; startedLabel: string };
  faces: Face[];
  facesLabel: { active: string; ready: string };
  footer: (ready: boolean) => {
    title: string;
    text: string;
    action: ReactNode;
  };
}) {
  const started = new Date(props.startedAt).getTime();
  const ends = new Date(props.endsAt).getTime();
  const progress = Math.max(
    0,
    Math.min(1, (props.now - started) / Math.max(1, ends - started)),
  );
  const remaining = Math.max(0, Math.ceil((ends - props.now) / 1_000));
  const ready = props.status === "READY" || remaining === 0;
  const footer = props.footer(ready);
  const From = props.route.from;
  const To = props.route.to;

  return (
    <section
      className={cn(
        "game-panel-flat overflow-hidden",
        ready &&
          "bg-[radial-gradient(70%_90%_at_100%_0%,hsl(var(--success)/0.1),transparent_70%)]",
      )}
    >
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <p className={cn("game-eyebrow", ready && "text-success")}>
            {ready ? props.eyebrow.ready : props.eyebrow.active}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">
            {props.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {props.meta}
          </div>
        </div>
        <div className="md:text-right">
          <p className="font-display text-4xl font-semibold tabular-nums tracking-[-0.03em]">
            {ready ? "Ready" : formatRemaining(remaining)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ready
              ? `Finished at ${formatTime(props.endsAt)}`
              : `Ends at ${formatTime(props.endsAt)}`}
          </p>
        </div>
      </div>

      <div className="px-5 sm:px-6">
        <div className="flex items-center gap-3">
          <From
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-black/30"
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(progress * 100)}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-1000",
                ready ? "bg-success" : "bg-primary",
              )}
              style={{ width: `${Math.max(2, progress * 100)}%` }}
            />
          </div>
          <To
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>
            {props.route.startedLabel} {formatTime(props.startedAt)}
          </span>
          <span>{Math.floor(progress * 100)}%</span>
        </div>
      </div>

      {props.faces.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 px-5 sm:px-6">
          <span className="text-xs text-muted-foreground">
            {ready ? props.facesLabel.ready : props.facesLabel.active}
          </span>
          <CreatureFaces creatures={props.faces} size={36} limit={8} />
        </div>
      ) : null}

      <footer className="mt-6 flex flex-col gap-3 bg-surface-inset/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-sm">
          <strong className="block font-semibold">{footer.title}</strong>
          <span className="text-xs text-muted-foreground">{footer.text}</span>
        </div>
        {footer.action}
      </footer>
    </section>
  );
}

export function JournalStat(props: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[10px] bg-surface-inset/60 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{props.label}</dt>
      <dd
        className={cn("mt-0.5 text-sm font-semibold tabular-nums", props.tone)}
      >
        {props.value}
      </dd>
    </div>
  );
}

/** One creature in a journal entry, with its share of the damage taken. */
export function EncounterRow(props: {
  asset: string;
  name: string;
  tag?: ReactNode;
  detail: string;
  damage: number;
  totalDamage: number;
}) {
  return (
    <li className="flex items-center gap-3 rounded-[10px] bg-surface-inset/40 p-1.5 pr-3">
      <Image
        src={props.asset}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-[8px] bg-black/20 object-contain"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="truncate font-semibold">
            {props.name}
            {props.tag}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {props.detail}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/30">
          <div
            className="h-full rounded-full bg-danger/70"
            style={{
              width: `${(props.damage / Math.max(1, props.totalDamage)) * 100}%`,
            }}
          />
        </div>
      </div>
    </li>
  );
}

/** Item rewards as artwork with the quantity overlaid. */
export function LootGrid(props: {
  title: string;
  rewards: Reward[];
  emptyText: string;
}) {
  return (
    <section aria-label={props.title}>
      <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
        {props.title}
      </h4>
      {props.rewards.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {props.rewards.map((reward) => (
            <ItemArtwork
              key={reward.itemId}
              src={reward.sprite}
              name={reward.name}
              rarity={reward.rarity}
              size={56}
              itemId={reward.itemId}
              quantity={reward.quantity}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{props.emptyText}</p>
      )}
    </section>
  );
}

export type JournalRow = {
  id: number;
  good: boolean;
  icon: LucideIcon;
  title: string;
  status: string;
  /** Muted detail after the status, e.g. the damage taken. */
  note?: string;
  claimedAt: string;
  rewards: Reward[];
  xpLabel: string;
  body: ReactNode;
};

/** The journal modal: one collapsible row per entry, newest open. */
export function JournalDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow: string;
  title: string;
  summary: string;
  emptyText: string;
  rows: JournalRow[];
  now: number;
}) {
  const newestId = props.rows[0]?.id ?? null;
  const [openId, setOpenId] = useState<number | null>(newestId);
  // Each time the journal opens, it opens on the newest entry.
  useEffect(() => {
    if (props.open) setOpenId(newestId);
  }, [props.open, newestId]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 border-0 p-0">
        <DialogHeader className="px-5 pb-4 pt-6 sm:px-6">
          <p className="game-eyebrow">{props.eyebrow}</p>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.summary}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-3 pb-5 sm:px-6 sm:pb-6">
          {props.rows.length === 0 ? (
            <div className="rounded-[12px] bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              <BookOpen className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
              {props.emptyText}
            </div>
          ) : (
            props.rows.map((row) => {
              const Icon = row.icon;
              return (
                <Collapsible
                  key={row.id}
                  open={openId === row.id}
                  onOpenChange={(open) => setOpenId(open ? row.id : null)}
                  className="overflow-hidden rounded-[12px] bg-card"
                >
                  <CollapsibleTrigger className="group flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                        row.good
                          ? "bg-success/[0.12] text-success"
                          : "bg-danger/[0.14] text-danger",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {row.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span
                          className={row.good ? "text-success" : "text-danger"}
                        >
                          {row.status}
                        </span>
                        {row.note ? ` · ${row.note}` : ""} ·{" "}
                        {formatAgo(row.claimedAt, props.now)}
                      </span>
                    </span>
                    {row.rewards.length > 0 ? (
                      <span
                        className="hidden shrink-0 items-center gap-1 sm:flex"
                        aria-hidden="true"
                      >
                        {row.rewards.slice(0, 3).map((reward) => (
                          <Image
                            key={reward.itemId}
                            src={reward.sprite}
                            alt=""
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-[6px] bg-surface-inset object-contain p-0.5"
                          />
                        ))}
                        {row.rewards.length > 3 ? (
                          <span className="text-[11px] text-muted-foreground">
                            +{row.rewards.length - 3}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "w-16 shrink-0 text-right text-xs font-semibold tabular-nums",
                        row.good ? "text-xp" : "text-muted-foreground",
                      )}
                    >
                      {row.xpLabel}
                    </span>
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                      aria-hidden="true"
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-4 px-3 pb-4 pt-1 sm:px-4">
                      {row.body}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
