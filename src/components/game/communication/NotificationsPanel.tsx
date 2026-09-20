"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff } from "lucide-react";
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
            <Skeleton className="h-16 w-full rounded-[8px]" />
            <Skeleton className="h-16 w-full rounded-[8px]" />
            <Skeleton className="h-16 w-full rounded-[8px]" />
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
              <li
                key={notification.id}
                className={cn(
                  "grid gap-1 rounded-[8px] px-3 py-2.5",
                  notification.read
                    ? "bg-secondary/20"
                    : "bg-secondary/45 shadow-[inset_2px_0_0_0_hsl(var(--primary))]",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <strong className="text-[13px] font-semibold leading-snug">
                    {notification.title}
                  </strong>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {NOTIFICATION_CATEGORY_LABELS[notification.category]}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {notification.body}
                </p>
                {notification.href ? (
                  <Link
                    href={notification.href}
                    onClick={onNavigate}
                    className="justify-self-start text-[13px] font-semibold text-primary hover:underline"
                  >
                    Read more
                  </Link>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {timeAgo(notification.createdAt)}
                </span>
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
