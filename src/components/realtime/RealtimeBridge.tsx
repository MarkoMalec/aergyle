"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useUserContext } from "~/context/userContext";
import { gardenQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import { applyItemChanges, refreshProgress } from "~/lib/player-sync";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { setRealtimeConnected } from "~/components/realtime/realtimeConnection";
import {
  ACTIVITY_STOP_MESSAGES,
  type RealtimeServerEvent,
} from "~/realtime/events";

async function fetchRealtimeToken() {
  const res = await fetch("/api/realtime/token", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to get realtime token");
  const json = (await res.json()) as { token: string };
  return json.token;
}

export function RealtimeBridge() {
  const { user } = useUserContext();
  const queryClient = useQueryClient();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const wsBase = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
    if (!wsBase) return;

    let cancelled = false;
    let hasConnected = false;

    const handleEvent = (event: RealtimeServerEvent) => {
      if (event.type === "activity_tick") {
        applyItemChanges(
          queryClient,
          userId,
          event.itemChanges,
          event.newStacks,
        );
        refreshProgress(queryClient, userId, event.skill);
        if (event.activity === "GARDEN") {
          void queryClient.invalidateQueries({
            queryKey: gardenQueryKeys.all(),
          });
        }
        if (event.stopReason) {
          const message = `${event.label}: ${ACTIVITY_STOP_MESSAGES[event.stopReason]}`;
          if (event.stopReason === "COMPLETED") toast.success(message);
          else toast.error(message);
          // The activity ended server-side; let the header drop it.
          dispatchActiveActionEvent({ kind: "changed" });
        }
        return;
      }

      // The hello on connect (or an older daemon's per-tick messages): items may have
      // changed without details, so refetch them.
      void queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.byUser(userId),
      });
      refreshProgress(queryClient, userId);
    };

    async function connect() {
      try {
        const token = await fetchRealtimeToken();
        if (cancelled) return;

        const url = new URL(wsBase!);
        url.searchParams.set("token", token);

        const ws = new WebSocket(url.toString());
        wsRef.current = ws;

        ws.onopen = () => {
          setRealtimeConnected(true);
          // After a reconnect, activities may have moved on while we weren't listening.
          if (hasConnected) dispatchActiveActionEvent({ kind: "changed" });
          hasConnected = true;
        };

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(String(msg.data)) as RealtimeServerEvent;
            if (!data || data.userId !== userId) return;
            handleEvent(data);
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          setRealtimeConnected(false);
          if (cancelled) return;

          // Simple reconnect with backoff.
          if (reconnectTimerRef.current) {
            window.clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = window.setTimeout(() => {
            void connect();
          }, 1500);
        };

        ws.onerror = () => {
          // Let onclose handle reconnect.
        };
      } catch {
        if (cancelled) return;
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(() => {
          void connect();
        }, 2000);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      setRealtimeConnected(false);
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
    };
  }, [user?.id, queryClient]);

  return null;
}
