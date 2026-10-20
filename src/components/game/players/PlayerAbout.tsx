"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  Hourglass,
  Pencil,
  Timer,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import { communicationFetch } from "~/components/game/communication/useCommunication";
import { MAX_BIO_LENGTH, accountAge } from "~/game/players";
import { cn } from "~/lib/utils";
import type { DailyActivityPoint } from "~/server/players";
import { formatActiveTime } from "./ActivityCharts";

const joinedFormat = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

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

function BioEditor({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (bio: string | null | undefined) => void;
}) {
  const [text, setText] = useState(initial);
  const save = useMutation({
    mutationFn: () =>
      communicationFetch<{ bio: string | null }>("/api/profile/bio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: text }),
      }),
    onSuccess: (result) => onDone(result.bio),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX_BIO_LENGTH}
        rows={3}
        autoFocus
        aria-label="Bio"
        className="w-full resize-none rounded-[8px] bg-surface-inset/70 px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {text.length} / {MAX_BIO_LENGTH}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onDone(undefined)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Who the player is: their own words, and how long they've been around. */
export function PlayerAbout({
  bio: initialBio,
  createdAt,
  history,
  isOwner,
  className,
}: {
  bio: string | null;
  createdAt: string;
  history: DailyActivityPoint[];
  isOwner: boolean;
  className?: string;
}) {
  const [bio, setBio] = useState(initialBio);
  const [editing, setEditing] = useState(false);
  const activeSeconds = history.reduce((sum, point) => sum + point.seconds, 0);

  return (
    <section
      aria-labelledby="about-heading"
      className={cn(
        "game-panel-flat min-w-0 p-4 [container-type:inline-size] sm:p-6",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="about-heading" className="game-section-title">
          About
        </h2>
        {isOwner && !editing ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit bio
          </Button>
        ) : null}
      </div>

      <div className="mb-5">
        {editing ? (
          <BioEditor
            initial={bio ?? ""}
            onDone={(saved) => {
              if (saved !== undefined) setBio(saved);
              setEditing(false);
            }}
          />
        ) : bio ? (
          <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-text-secondary">
            {bio}
          </p>
        ) : (
          <p className="text-[13px] italic text-muted-foreground">
            No bio yet.
          </p>
        )}
      </div>

      <div className="grid gap-2 [@container(min-width:420px)]:grid-cols-3">
        <Fact
          icon={CalendarDays}
          label="Joined"
          value={joinedFormat.format(new Date(createdAt))}
        />
        <Fact
          icon={Hourglass}
          label="Account age"
          value={accountAge(createdAt)}
        />
        <Fact
          icon={Timer}
          label="Active · 30 days"
          value={activeSeconds > 0 ? formatActiveTime(activeSeconds) : "—"}
        />
      </div>
    </section>
  );
}
