"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "~/lib/utils";
import type { AdminPlayer, AdminPlayerOptions } from "~/server/admin/players";
import { ItemsTab } from "./ItemsTab";
import { MarketTab } from "./MarketTab";
import { MessagesTab } from "./MessagesTab";
import { OverviewTab } from "./OverviewTab";
import { PlayerAvatar } from "./PlayersDataTable";
import { ProgressTab } from "./ProgressTab";
import { formatGold, PlayerEditProvider, Tag } from "./shared";
import { SkillsTab } from "./SkillsTab";
import { StatsTab } from "./StatsTab";

const TABS = [
  { id: "overview", label: "Overview", Tab: OverviewTab },
  { id: "items", label: "Items", Tab: ItemsTab },
  { id: "stats", label: "Stats & effects", Tab: StatsTab },
  { id: "skills", label: "Skills", Tab: SkillsTab },
  { id: "progress", label: "Quests & storage", Tab: ProgressTab },
  { id: "market", label: "Market", Tab: MarketTab },
  { id: "messages", label: "Messages", Tab: MessagesTab },
] as const;

export function PlayerEditor(props: {
  player: AdminPlayer;
  options: AdminPlayerOptions;
}) {
  const { player } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current =
    TABS.find((tab) => tab.id === searchParams.get("tab")) ?? TABS[0];
  const busy = player.activities.find((activity) => !activity.claimedAt);

  return (
    <PlayerEditProvider player={player} options={props.options}>
      <div className="space-y-6">
        <header className="space-y-4">
          <Link
            href="/admin/players"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Players
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <PlayerAvatar
              name={player.account.name}
              image={player.account.image}
              className="h-14 w-14"
            />
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-bold">
                {player.account.name ?? "Unnamed player"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                <Tag tone="info">Level {player.character.level}</Tag>
                <Tag tone="warn">{formatGold(player.character.gold)} gold</Tag>
                <Tag>{player.character.locationName ?? "Nowhere"}</Tag>
                {busy ? <Tag tone="good">{busy.label}</Tag> : <Tag>Idle</Tag>}
                <span className="text-xs text-white/45">
                  {player.account.email ?? "No email"}
                </span>
              </div>
            </div>
          </div>
        </header>

        <nav
          className="flex gap-1 overflow-x-auto rounded-lg bg-black/25 p-1"
          aria-label="Player sections"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={tab.id === current.id ? "page" : undefined}
              onClick={() =>
                router.replace(
                  tab.id === "overview" ? pathname : `${pathname}?tab=${tab.id}`,
                  { scroll: false },
                )
              }
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab.id === current.id
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <current.Tab />
      </div>
    </PlayerEditProvider>
  );
}
