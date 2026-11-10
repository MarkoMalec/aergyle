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

const RETRY_BASE_MS = 1500;
const RETRY_MAX_MS = 30_000;

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
    let retryDelayMs = RETRY_BASE_MS;

    // Exponential backoff with jitter, so a daemon restart doesn't make every client
    // hit the token route in lockstep.
    const scheduleReconnect = () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      const delay = retryDelayMs + Math.random() * 1000;
      retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
      reconnectTimerRef.current = window.setTimeout(() => {
        void connect();
      }, delay);
    };

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
          // A hidden tab gets the "while you were away" summary instead.
          if (document.visibilityState === "visible") {
            const message = `${event.label}: ${ACTIVITY_STOP_MESSAGES[event.stopReason]}`;
            if (event.stopReason === "COMPLETED") toast.success(message);
            else toast.error(message);
          }
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
          // Reset on open: the token was valid and the daemon is up. (A connection the
          // daemon accepts then drops at once is rare; its 1.5 s retry is cheap.)
          retryDelayMs = RETRY_BASE_MS;
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

        ws.onclose = (e) => {
          wsRef.current = null;
          setRealtimeConnected(false);
          // 1008 = rejected by the daemon (e.g. too many sockets): retrying would loop forever.
          if (cancelled || e.code === 1008) return;
          scheduleReconnect();
        };

        ws.onerror = () => {
          // Let onclose handle reconnect.
        };
      } catch {
        if (cancelled) return;
        scheduleReconnect();
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
