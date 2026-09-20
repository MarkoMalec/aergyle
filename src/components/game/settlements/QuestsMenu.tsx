"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ScrollText } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import { npcHref } from "~/game/settlements";
import { questQueryKeys } from "~/lib/query-keys";
import type { QuestJournalEntry } from "~/server/settlements";
import {
  QuestObjectiveChips,
  QuestProgressBar,
  QuestStatusChip,
} from "./QuestParts";

// Mounted only while the menu is open, so it fetches fresh progress each time.
function ActiveQuests({ onNavigate }: { onNavigate: () => void }) {
  const query = useQuery({
    queryKey: questQueryKeys.journal(),
    queryFn: async () => {
      const response = await fetch("/api/settlements/quests", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load your quests");
      return ((await response.json()) as { quests: QuestJournalEntry[] })
        .quests;
    },
  });

  if (query.isError) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        Couldn&apos;t load your quests.
      </p>
    );
  }
  if (!query.data) {
    return (
      <div className="space-y-2 p-1" aria-busy="true">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }
  if (query.data.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        You are not on any quests.{" "}
        <Link
          href="/region"
          onClick={onNavigate}
          className="text-primary hover:underline"
        >
          Visit a settlement
        </Link>{" "}
        to find work.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {query.data.map((quest) => (
        <li
          key={quest.id}
          className="space-y-2.5 rounded-lg bg-surface-inset/70 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <Link
              href={npcHref(quest.settlement.id, quest.npc.id)}
              onClick={onNavigate}
              className="group min-w-0"
            >
              <strong className="block truncate text-sm group-hover:text-primary">
                {quest.name}
              </strong>
              <span className="block truncate text-xs text-muted-foreground">
                {quest.npc.name} · {quest.settlement.name},{" "}
                {quest.settlement.locationName}
              </span>
            </Link>
            <QuestStatusChip quest={quest} />
          </div>
          <QuestProgressBar quest={quest} />
          {quest.objectives.length > 0 ? (
            <QuestObjectiveChips quest={quest} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Header button listing every quest the player is on, wherever they are. */
export function QuestsMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex h-12 items-center gap-2 rounded-xl bg-card/70 px-3 shadow-[var(--shadow-panel)] transition-colors duration-150 hover:bg-secondary/80 focus-visible:outline-none data-[state=open]:bg-secondary"
          aria-label="Open your active quests"
        >
          <ScrollText size={18} className="text-primary" aria-hidden="true" />
          {/* <span className="text-sm font-semibold"></span> */}
          <ChevronDown
            size={14}
            className="text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(380px,calc(100vw-24px))] rounded-xl border-0 bg-popover p-2"
      >
        <p className="px-2 pb-2 pt-1 text-sm font-semibold">Active quests</p>
        <div className="max-h-[min(70vh,560px)] overflow-y-auto">
          <ActiveQuests onNavigate={() => setOpen(false)} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
