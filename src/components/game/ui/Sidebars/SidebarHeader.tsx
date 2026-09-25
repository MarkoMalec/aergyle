"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell,
  ChevronRight,
  LogOut,
  MessageSquare,
  Pin,
  PinOff,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  CommunicationHub,
  type HubTab,
} from "~/components/game/communication/CommunicationHub";
import { useCommunicationSummary } from "~/components/game/communication/useCommunication";
import { useLevelContext } from "~/context/levelContext";
import { useUserContext } from "~/context/userContext";
import {
  DEFAULT_PLAYER_AVATAR,
  getPlayerAvatarBySrc,
} from "~/lib/player-avatars";
import { describePage, type NavigationGroup } from "./navigation-links";
import { MAX_PINNED_PAGES, usePinnedPages } from "./usePinnedPages";

/** Who you are, the tools that follow you around, and the search box. */
export function SidebarHeader({
  groups,
  onSearch,
  onNavigate,
}: {
  groups: NavigationGroup[];
  onSearch: () => void;
  /** Closes the mobile sheet when a shortcut is followed. */
  onNavigate: () => void;
}) {
  const { user } = useUserContext();
  const { levelData } = useLevelContext();
  const avatar = getPlayerAvatarBySrc(user?.image) ?? DEFAULT_PLAYER_AVATAR;
  const [isMac, setIsMac] = useState(true);
  const [hubTab, setHubTab] = useState<HubTab | null>(null);
  const summary = useCommunicationSummary();

  // The shortcut hint is only right once we know the platform.
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent)), []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="game-sidebar-head">
        <Link
          href="/profile"
          className="game-brand game-brand--rail"
          onClick={onNavigate}
          aria-label="Aergyle"
        >
          <Image
            src="/assets/logo/aergyle-logo.png"
            alt=""
            width={30}
            height={25}
          />
          <span className="game-wordmark">Aergyle</span>
        </Link>

        <Link href="/profile" className="game-identity" onClick={onNavigate}>
          <Image
            src={avatar.src}
            alt=""
            width={88}
            height={88}
            className="h-[54px] w-[54px] shrink-0 object-contain"
          />
          <span className="grid min-w-0 gap-0.5 leading-none">
            <span className="truncate text-[13px] font-semibold">
              {user?.name ?? "Wayfarer"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Level {levelData?.level ?? user?.level ?? 1}
            </span>
          </span>
          <ChevronRight
            size={15}
            className="ml-auto shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Link>

        <div className="game-rail-actions">
          <HubAction
            icon={Bell}
            label="Notifications"
            count={summary.notifications}
            onClick={() => setHubTab("notifications")}
          />
          <HubAction
            icon={MessageSquare}
            label="Messages"
            count={summary.messages + summary.waiting}
            onClick={() => setHubTab("messages")}
          />
          <SoonAction icon={Users} label="Friends" />
          <PinnedPagesMenu groups={groups} onNavigate={onNavigate} />
          <SoonAction icon={Settings} label="Settings" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="game-rail-action"
                onClick={() => void signOut({ callbackUrl: "/play" })}
              >
                <LogOut size={15} aria-hidden="true" />
                <span className="sr-only">Log out</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Log out</TooltipContent>
          </Tooltip>
        </div>

        <button type="button" className="game-rail-search" onClick={onSearch}>
          <Search size={15} aria-hidden="true" />
          <span>Search</span>
          <kbd className="game-kbd">{isMac ? "⌘ K" : "Ctrl K"}</kbd>
        </button>

        <CommunicationHub
          tab={hubTab}
          onTabChange={setHubTab}
          onClose={() => setHubTab(null)}
          onNavigate={() => {
            setHubTab(null);
            onNavigate();
          }}
        />
      </div>
    </TooltipProvider>
  );
}

/**
 * The bell or the envelope, with a dot while something is unread. The count
 * itself lives inside the hub; the dot only says "there is something".
 */
function HubAction({
  icon: Icon,
  label,
  count,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="game-rail-action" onClick={onClick}>
          <Icon size={15} aria-hidden="true" />
          {count > 0 ? (
            <span
              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_2px_hsl(var(--sidebar-background)),0_0_6px_hsl(var(--primary)/0.8)]"
              aria-hidden="true"
            />
          ) : null}
          <span className="sr-only">
            {count > 0 ? `${label} (${count} new)` : label}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {count > 0 ? `${label} · ${count} new` : label}
      </TooltipContent>
    </Tooltip>
  );
}

/** A button for a feature that is coming, labelled as such. */
function SoonAction({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="game-rail-action opacity-60"
          aria-disabled="true"
          onClick={(event) => event.preventDefault()}
        >
          <Icon size={15} aria-hidden="true" />
          <span className="sr-only">{`${label} (work in progress)`}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label} — work in progress</TooltipContent>
    </Tooltip>
  );
}

/** Up to five shortcuts the player chooses, pinned from the page they are on. */
function PinnedPagesMenu({
  groups,
  onNavigate,
}: {
  groups: NavigationGroup[];
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const { pinned, pin, unpin } = usePinnedPages();
  const label = describePage(groups, pathname);
  const isPinned = pinned.some((page) => page.href === pathname);
  const isFull = pinned.length >= MAX_PINNED_PAGES;

  return (
    <Popover>
      <Tooltip>
        {/* Popover outermost, so the button carries its open state. */}
        <PopoverTrigger asChild>
          <TooltipTrigger className="game-rail-action">
            <Pin size={15} aria-hidden="true" />
            <span className="sr-only">Pinned pages</span>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="bottom">Pinned pages</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="game-eyebrow">Pinned pages</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {pinned.length}/{MAX_PINNED_PAGES}
          </span>
        </div>

        {pinned.length === 0 ? (
          <p className="px-1 pb-2 text-xs leading-relaxed text-muted-foreground">
            Pin a page to jump back to it from anywhere.
          </p>
        ) : (
          <ul className="grid gap-0.5 pb-2">
            {pinned.map((page) => (
              <li key={page.href} className="flex items-center gap-1">
                <Link
                  href={page.href}
                  onClick={onNavigate}
                  className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-[13px] hover:bg-secondary/60"
                >
                  {page.label}
                </Link>
                <button
                  type="button"
                  onClick={() => unpin(page.href)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                >
                  <PinOff size={14} aria-hidden="true" />
                  <span className="sr-only">{`Unpin ${page.label}`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          disabled={!isPinned && isFull}
          onClick={() =>
            isPinned ? unpin(pathname) : pin({ href: pathname, label })
          }
          className="flex w-full items-center gap-2 rounded-lg bg-secondary/40 px-2 py-2 text-[13px] hover:bg-secondary/70 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPinned ? (
            <PinOff size={14} aria-hidden="true" />
          ) : (
            <Pin size={14} aria-hidden="true" />
          )}
          <span className="truncate">
            {isPinned ? `Unpin ${label}` : `Pin ${label}`}
          </span>
        </button>
        {!isPinned && isFull ? (
          <p className="px-1 pt-2 text-[11px] text-muted-foreground">
            Unpin one to make room.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
