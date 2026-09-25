"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Castle,
  Megaphone,
  ScrollText,
  Store,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  timeAgo,
} from "~/game/communication";
import type { NotificationCategory } from "~/generated/prisma/enums";
import { communicationQueryKeys } from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import type { NotificationView } from "~/server/communication";
import { communicationFetch } from "./useCommunication";

type Page = { notifications: NotificationView[]; nextCursor: number | null };

const ALL = "ALL";

/** Stands in for the item artwork on notes that aren't about an item. */
const CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
  GENERAL: Bell,
  SETTLEMENT: Castle,
  QUEST: ScrollText,
  MARKET: Store,
  COMBAT: Swords,
  SYSTEM: Megaphone,
};

export function NotificationsPanel({ onNavigate }: { onNavigate: () => void }) {
  const [filter, setFilter] = useState<NotificationCategory | typeof ALL>(ALL);
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: communicationQueryKeys.notifications(filter),
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) =>
      communicationFetch<Page>(
        `/api/notifications?${new URLSearchParams({
          ...(filter === ALL ? {} : { category: filter }),
          ...(pageParam ? { cursor: String(pageParam) } : {}),
        }).toString()}`,
      ),
    getNextPageParam: (page) => page.nextCursor,
  });

  const notifications = query.data?.pages.flatMap((page) => page.notifications);

  // Looking at the list is reading it: the bell clears once the first page
  // has arrived. The rows stay highlighted until the panel is opened again,
  // so the player can still see what was new.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !notifications?.some((row) => !row.read)) return;
    marked.current = true;
    void communicationFetch("/api/notifications/read", { method: "POST" })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: communicationQueryKeys.summary(),
        }),
      )
      .catch(() => undefined);
  }, [notifications, queryClient]);

  const clearAll = async () => {
    await communicationFetch("/api/notifications", { method: "DELETE" });
    await queryClient.invalidateQueries({
      queryKey: communicationQueryKeys.all(),
    });
  };

  return (
    <div className="grid min-h-0 gap-3">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={filter}
          onValueChange={(value) =>
            setFilter(value as NotificationCategory | typeof ALL)
          }
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {NOTIFICATION_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {NOTIFICATION_CATEGORY_LABELS[category]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {notifications && notifications.length > 0 ? (
          <button
            type="button"
            onClick={() => void clearAll()}
            className="rounded-[8px] px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="max-h-[52vh] min-h-0 overflow-y-auto pr-1">
        {query.isError ? (
          <p className="p-4 text-sm text-muted-foreground">
            Couldn&apos;t load your notifications.
          </p>
        ) : !notifications ? (
          <div className="grid gap-2" aria-busy="true">
            <Skeleton className="h-14 w-full rounded-[8px]" />
            <Skeleton className="h-14 w-full rounded-[8px]" />
            <Skeleton className="h-14 w-full rounded-[8px]" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="grid justify-items-center gap-2 py-10 text-center">
            <BellOff
              size={22}
              className="text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Nothing here yet. The game will let you know.
            </p>
          </div>
        ) : (
          <ul className="grid gap-1">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationRow
                  notification={notification}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        )}

        {query.hasNextPage ? (
          <button
            type="button"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
            className="mt-2 w-full rounded-[8px] bg-secondary/40 py-2 text-[13px] hover:bg-secondary/70 disabled:opacity-50"
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** One note: its item (or category), what happened, and a dot while unread. */
function NotificationRow({
  notification,
  onNavigate,
}: {
  notification: NotificationView;
  onNavigate: () => void;
}) {
  const Icon = CATEGORY_ICONS[notification.category];
  const content = (
    <>
      {notification.item ? (
        <ItemArtwork
          src={notification.item.sprite}
          name={notification.item.name}
          rarity={notification.item.rarity}
          size={40}
        />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-secondary/60 text-muted-foreground">
          <Icon size={16} aria-hidden="true" />
        </span>
      )}
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <strong className="min-w-0 text-[13px] font-semibold leading-snug">
            {notification.title}
          </strong>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          {notification.body}
        </p>
      </div>
      {/* Read rows keep the dot's slot so the timestamps line up. */}
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          notification.read ? "invisible" : "bg-primary",
        )}
      >
        {notification.read ? null : <span className="sr-only">Unread</span>}
      </span>
    </>
  );

  const className = cn(
    "flex items-center gap-3 rounded-[8px] px-2.5 py-2",
    notification.read ? "bg-secondary/20" : "bg-secondary/45",
  );

  if (!notification.href) return <div className={className}>{content}</div>;

  return (
    <Link
      href={notification.href}
      onClick={onNavigate}
      className={cn(
        className,
        "transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/80",
      )}
    >
      {content}
    </Link>
  );
}
