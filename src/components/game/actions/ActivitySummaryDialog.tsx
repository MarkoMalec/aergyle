"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Castle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { addActiveActionEventListener } from "~/components/game/actions/activeActionEvents";
import { formatLength } from "~/components/game/actions/format";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { getSkillIcon } from "~/components/game/ui/Sidebars/navigation-links";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { timeAgo } from "~/game/communication";
import { cn } from "~/lib/utils";
import { ACTIVITY_STOP_MESSAGES } from "~/realtime/events";
import type {
  ActivitySummaryEntry,
  LevelChange,
  RunSummary,
  SessionSummary,
} from "~/server/activitySummaries";
import { toSkillNameFromActionType } from "~/utils/vocations";

type UnseenSummaries = { summaries: ActivitySummaryEntry[]; asOf: string };
type SessionEntry = ActivitySummaryEntry & SessionSummary;
type RunEntry = ActivitySummaryEntry & RunSummary;

const isSession = (summary: ActivitySummaryEntry): summary is SessionEntry =>
  summary.kind === "VOCATION" || summary.kind === "GARDEN";

const RUNS: Record<
  RunSummary["kind"],
  { label: string; href: string; action: string; icon: LucideIcon }
> = {
  GATHERING: {
    label: "Gathering",
    href: "/skills/Gathering",
    action: "Claim expedition",
    icon: getSkillIcon("Gathering"),
  },
  HUNTING: {
    label: "Hunting",
    href: "/skills/Hunting",
    action: "Claim hunt",
    icon: getSkillIcon("Hunting"),
  },
  DUNGEON: {
    label: "Dungeon",
    href: "/dungeons",
    action: "See what happened",
    icon: Castle,
  },
};

const compactCount = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Looking at the game right now: its tab is showing and has focus. */
function isPresent() {
  return document.visibilityState === "visible" && document.hasFocus();
}

/** Everything that ended up to `upTo` (default: now, server time) was seen. */
function markSeen(upTo?: string) {
  void fetch("/api/activity/summaries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(upTo ? { upTo } : {}),
  }).catch(() => undefined);
}

/**
 * "While you were away": the activities that finished while the player wasn't
 * looking, shown when the game opens and whenever they come back to it.
 */
export function ActivitySummaryDialog() {
  const [unseen, setUnseen] = useState<UnseenSummaries | null>(null);
  const [open, setOpen] = useState(false);
  // Server time up to which this page has shown everything that ended. Unset
  // from the moment the player leaves until the next fetch on their return.
  const shownUpToRef = useRef<string | null>(null);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      const fetchId = ++fetchIdRef.current;
      shownUpToRef.current = null;
      try {
        const res = await fetch("/api/activity/summaries", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const next = (await res.json()) as UnseenSummaries;
        // A newer fetch (the player left and came back again) supersedes this one.
        if (fetchId !== fetchIdRef.current) return;
        shownUpToRef.current = next.asOf;
        if (next.summaries.length > 0) {
          setUnseen(next);
          setOpen(true);
        }
      } catch {
        // Tried again the next time the player comes back.
      }
    };

    const onPresenceChange = () => {
      if (isPresent()) void load();
      else shownUpToRef.current = null;
    };

    void load();
    document.addEventListener("visibilitychange", onPresenceChange);
    window.addEventListener("focus", onPresenceChange);
    window.addEventListener("blur", onPresenceChange);
    return () => {
      document.removeEventListener("visibilitychange", onPresenceChange);
      window.removeEventListener("focus", onPresenceChange);
      window.removeEventListener("blur", onPresenceChange);
    };
  }, []);

  // An activity ended in front of the player, who saw it happen: it needs no
  // summary later.
  useEffect(
    () =>
      addActiveActionEventListener((event) => {
        if (event.detail.kind !== "ended") return;
        if (shownUpToRef.current && isPresent()) markSeen();
      }),
    [],
  );

  if (!unseen) return null;

  const close = () => {
    setOpen(false);
    markSeen(unseen.asOf);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="grid-cols-1 border-0 outline-none sm:max-w-md"
        aria-describedby={undefined}
        // It opens on its own, so no button starts out showing a focus ring.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>While you were away</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3">
          {unseen.summaries.map((summary) =>
            isSession(summary) ? (
              <SessionCard key={summary.key} summary={summary} />
            ) : (
              <RunCard key={summary.key} summary={summary} onOpen={close} />
            ),
          )}
        </div>

        <DialogFooter>
          <Button type="button" className="h-9 border-0" onClick={close}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionCard({ summary }: { summary: SessionEntry }) {
  const skill = toSkillNameFromActionType(summary.skill);
  const seconds =
    (Date.parse(summary.endedAt) - Date.parse(summary.startedAt)) / 1000;
  const earnedXp = summary.xp.skill > 0 || summary.xp.character > 0;

  const length = seconds < 60 ? "under a minute" : formatLength(seconds);

  return (
    <section className="grid grid-cols-1 gap-3 rounded-xl bg-surface-inset/70 p-3">
      <EntryHeading
        icon={getSkillIcon(skill)}
        title={summary.title}
        detail={`${skill} · ${length} · ${timeAgo(summary.endedAt)}`}
      />

      {summary.stopReason !== "COMPLETED" ? (
        <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {ACTIVITY_STOP_MESSAGES[summary.stopReason]}
        </p>
      ) : null}

      {summary.items.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {summary.items.map((item) => (
            <li key={`${item.itemId}-${item.rarity}`}>
              <ItemArtwork
                src={item.sprite}
                name={item.name}
                rarity={item.rarity}
                itemId={item.itemId}
                size={52}
                quantity={
                  item.quantity >= 10_000
                    ? compactCount.format(item.quantity)
                    : item.quantity.toLocaleString()
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {earnedXp ? (
        <div className="grid gap-1">
          <TrackRow
            label={skill}
            xp={summary.xp.skill}
            level={summary.levels.skill}
          />
          <TrackRow
            label="Character"
            xp={summary.xp.character}
            level={summary.levels.character}
          />
        </div>
      ) : null}
    </section>
  );
}

/** A skill or the character: the XP gained and the level now (from where, if it rose). */
function TrackRow(props: { label: string; xp: number; level: LevelChange }) {
  const { from, to } = props.level;
  const levels = to - from;
  const leveledUp = levels > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2",
        leveledUp ? "bg-primary/15" : "bg-secondary/30",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {props.label}
        </p>
        <p className="text-xs tabular-nums text-text-secondary">
          +{props.xp.toLocaleString()} XP
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "flex items-center justify-end gap-1 text-sm font-semibold tabular-nums",
            leveledUp ? "text-primary" : "text-foreground",
          )}
        >
          {leveledUp ? (
            <>
              <span className="font-medium text-muted-foreground">
                Lv. {from}
              </span>
              <ArrowRight className="h-3.5 w-3.5" aria-label="to" />
              {to}
            </>
          ) : (
            `Lv. ${to}`
          )}
        </p>
        {leveledUp ? (
          <p className="text-xs font-medium text-primary">
            {levels === 1 ? "Level up" : `+${levels} levels`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RunCard(props: { summary: RunEntry; onOpen: () => void }) {
  const run = RUNS[props.summary.kind];

  return (
    <section className="grid grid-cols-1 gap-3 rounded-xl bg-surface-inset/70 p-3">
      <EntryHeading
        icon={run.icon}
        title={props.summary.title}
        detail={`${run.label} · ${timeAgo(props.summary.endedAt)}`}
      />
      <Button
        asChild
        size="sm"
        className="border-0 bg-primary/15 text-primary hover:bg-primary/25"
      >
        <Link href={run.href} onClick={props.onOpen}>
          {run.action}
        </Link>
      </Button>
    </section>
  );
}

function EntryHeading(props: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  const Icon = props.icon;

  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/30 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {props.title}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{props.detail}</p>
      </div>
    </div>
  );
}
