"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { communicationQueryKeys } from "~/lib/query-keys";
import type { CommunicationSummary } from "~/server/communication";

/** Reads JSON from the communication API, turning its `error` into a throw. */
export async function communicationFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const json = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok || !json) {
    throw new Error(json?.error ?? "Something went wrong");
  }
  return json;
}

const EMPTY: CommunicationSummary = {
  notifications: 0,
  messages: 0,
  waiting: 0,
};

/**
 * The unread counts behind the sidebar's bell and envelope. Checked once a
 * minute; anything the player does refreshes it at once.
 */
export function useCommunicationSummary() {
  const query = useQuery({
    queryKey: communicationQueryKeys.summary(),
    queryFn: () =>
      communicationFetch<CommunicationSummary>("/api/communication/summary"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  return query.data ?? EMPTY;
}

/** Refreshes every communication query after sending, reading or deleting. */
export function useRefreshCommunication() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: communicationQueryKeys.all() });
}
