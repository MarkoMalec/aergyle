"use client";

import React, { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "~/context/userContext";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";

type ServerEvent =
  | { type: "vocational_tick"; userId: string }
  | { type: "inventory_changed"; userId: string };

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

    async function connect() {
      try {
        const token = await fetchRealtimeToken();
        if (cancelled) return;

        const url = new URL(wsBase!);
        url.searchParams.set("token", token);

        const ws = new WebSocket(url.toString());
        wsRef.current = ws;

        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(String(msg.data)) as ServerEvent;
            if (!data || data.userId !== userId) return;

            // Inventory changed; refresh inventory + active action status.
            queryClient.invalidateQueries({
              queryKey: inventoryQueryKeys.byUser(userId),
            });
            dispatchActiveActionEvent({ kind: "changed" });
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
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
