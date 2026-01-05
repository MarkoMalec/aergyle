"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ItemRarity, VocationalActionType } from "~/generated/prisma/enums";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addActiveActionEventListener,
  dispatchActiveActionEvent,
} from "~/components/game/actions/activeActionEvents";
import toast from "react-hot-toast";
import { inventoryQueryKeys } from "~/lib/query-keys";

type StatusResponse = {
  activity: null | {
    id: number;
    actionType: VocationalActionType;
    startedAt: string;
    endsAt: string;
    unitHours: number;
    unitMinutes: number;
    unitSeconds: number;
    unitsClaimed: number;
    resource: {
      id: number;
      name: string;
      itemId: number;
      yieldPerUnit: number;
      xpPerUnit: number;
      rarity: ItemRarity;
      item: {
        sprite: string;
      };
    };
    location: null | { id: number; name: string };
  };
  progress: null | {
    unitProgress: number;
    unitsTotal: number;
    unitsClaimable: number;
    remainingSeconds: number;
    isComplete: boolean;
  };
  skillProgress: null | {
    trackKey: string;
    level: number;
    currentXp: number;
    xpForNextLevel: number;
    xpProgress: number;
    xpRemaining: number;
  };
};

type TravelStatusResponse =
  | {
      travel: {
        id: number;
        startedAt: string;
        endsAt: string;
        fromLocation: { id: number; name: string } | null;
        toLocation: { id: number; name: string };
      };
      progress: {
        progress: number;
        remainingSeconds: number;
        isComplete: boolean;
      };
    }
  | { travel: null; progress: null };

function formatAction(action: string) {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type ActiveActionViewModel = {
  skillLabel: string;
  label: string;
  href: string;
  sprite?: string;
  remainingSeconds: number;
  nextItemInTime: string | null;
  sessionRemainingSeconds: number;
  progress: number;
  previewProgress: number;
  sessionAmount: number;
  sessionLabel: string;
  xpPerUnit: number;
  xpPerSecond: string;
  skillProgress: StatusResponse["skillProgress"];
};

const ACTION_BAR_LAG_MS = 500;

export type UseVocationalActiveActionResult = ReturnType<
  typeof useVocationalActiveAction
>;

export function useVocationalActiveAction() {
  const queryClient = useQueryClient();
  const [travelStatus, setTravelStatus] = useState<TravelStatusResponse | null>(
    null,
  );
  const [travelSync, setTravelSync] = useState<{
    fetchedAtMs: number;
    remainingSecondsAtFetch: number;
    durationSeconds: number;
  } | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [displayUnitsTotal, setDisplayUnitsTotal] = useState(0);

  const prevActivityIdRef = useRef<number | null>(null);
  const prevUnitsTotalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      // Travel has priority: while traveling, you can't do other actions.
      const travelRes = await fetch("/api/travel/status", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (travelRes.ok) {
        const travelJson = (await travelRes.json()) as TravelStatusResponse;
        setTravelStatus(travelJson);

        if (travelJson.travel && travelJson.progress) {
          const startedAtMs = new Date(travelJson.travel.startedAt).getTime();
          const endsAtMs = new Date(travelJson.travel.endsAt).getTime();
          const durationSeconds = Math.max(
            1,
            Math.round((endsAtMs - startedAtMs) / 1000),
          );

          setTravelSync({
            fetchedAtMs: Date.now(),
            remainingSecondsAtFetch: Math.max(
              0,
              Math.floor(travelJson.progress.remainingSeconds),
            ),
            durationSeconds,
          });
        } else {
          setTravelSync(null);
        }

        if (travelJson.travel) {
          // Clear vocational status while traveling.
          setStatus({ activity: null, progress: null, skillProgress: null });
          return;
        }
      }

      const res = await fetch("/api/vocations/status", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) return;
      const json = (await res.json()) as StatusResponse;
      setStatus(json);
    } catch {
      // ignore
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const travel = travelStatus?.travel;
    if (travel) {
      const endsAtMs = new Date(travel.endsAt).getTime();

      // Schedule a refresh near completion. This is best-effort; the bar itself is
      // driven from remainingSeconds baseline.
      const msToEnd = Math.max(0, endsAtMs - Date.now()) + 75;

      const t = window.setTimeout(() => {
        void refresh();
      }, msToEnd);

      return () => window.clearTimeout(t);
    }

    const activity = status?.activity;
    if (!activity) return;

    const startedAtMs = new Date(activity.startedAt).getTime();
    const endsAtMs = new Date(activity.endsAt).getTime();
    const unitMs = Math.max(1, Math.floor(activity.unitSeconds)) * 1000;

    const nowMs = Date.now();
    const durationMs = Math.max(0, endsAtMs - startedAtMs);
    const elapsedMs = Math.min(Math.max(0, nowMs - startedAtMs), durationMs);
    const remainder = unitMs <= 0 ? 0 : elapsedMs % unitMs;

    // If we're exactly on a unit boundary (and not at start), refresh shortly
    // so the server can auto-grant that unit immediately.
    let msToNext =
      remainder === 0 && elapsedMs > 0 ? 75 : Math.max(75, unitMs - remainder);

    // Also ensure we refresh right after endsAt so the activity clears promptly.
    const msToEnd = Math.max(0, endsAtMs - nowMs) + 75;
    msToNext = Math.min(msToNext, msToEnd);

    const t = window.setTimeout(() => {
      void refresh();
    }, msToNext);

    return () => window.clearTimeout(t);
  }, [
    travelStatus?.travel?.startedAt,
    travelStatus?.travel?.endsAt,
    status?.activity?.startedAt,
    status?.activity?.endsAt,
    status?.activity?.unitSeconds,
    status?.activity?.unitsClaimed,
    refresh,
  ]);

  useEffect(() => {
    // Update time in 1-second steps so the fill bar only advances once per second.
    let timeoutId: number | null = null;
    let intervalId: number | null = null;

    const msToNextSecond = 1000 - (Date.now() % 1000);
    timeoutId = window.setTimeout(() => {
      setNow(Date.now());
      intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    }, msToNextSecond);

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return addActiveActionEventListener((ev) => {
      const kind = ev?.detail?.kind;
      if (kind === "stop-optimistic") {
        setStatus((prev) =>
          prev ? { activity: null, progress: null, skillProgress: null } : prev,
        );
        return;
      }
      if (kind === "changed") void refresh();
    });
  }, [refresh]);

  const derived = useMemo(() => {
    const travel = travelStatus?.travel;
    if (travel) {
      const startedAt = new Date(travel.startedAt).getTime();
      const endsAt = new Date(travel.endsAt).getTime();

      const durationSeconds = Math.max(
        1,
        Math.round((endsAt - startedAt) / 1000),
      );

      let remainingSeconds = travelSync?.remainingSecondsAtFetch ?? null;
      if (remainingSeconds == null) {
        // No baseline yet; show 0% until the next refresh populates travelSync.
        remainingSeconds = durationSeconds;
      } else {
        const fetchedAtMs = travelSync?.fetchedAtMs;
        const elapsedSinceFetchSeconds =
          fetchedAtMs == null ? 0 : Math.floor((now - fetchedAtMs) / 1000);
        remainingSeconds = Math.max(
          0,
          remainingSeconds - Math.max(0, elapsedSinceFetchSeconds),
        );
      }

      const progress = Math.max(
        0,
        Math.min(1, 1 - remainingSeconds / Math.max(1, durationSeconds)),
      );

      return {
        kind: "travel" as const,
        skillLabel: "Travel",
        href: "/map",
        label: `Traveling to ${travel.toLocation.name}`,
        sprite: undefined,
        remainingSeconds,
        nextItemInTime: null,
        sessionRemainingSeconds: remainingSeconds,
        progress,
        previewProgress: progress,
        unitsTotal: 0,
        yieldPerUnit: 0,
        xpPerUnit: 0,
        xpPerSecond: "0.00",
        skillProgress: null,
      };
    }

    const activity = status?.activity;
    if (!activity) return null;

    const skillLabel = formatAction(activity.actionType);
    const href = `/skills/${encodeURIComponent(skillLabel)}`;

    const startedAt = new Date(activity.startedAt).getTime();
    const endsAt = new Date(activity.endsAt).getTime();
    const unitMs = Math.max(1, activity.unitSeconds) * 1000;

    const duration = Math.max(0, endsAt - startedAt);
    const elapsed = Math.min(Math.max(0, now - startedAt), duration);

    const unitsTotal = Math.floor(elapsed / unitMs);

    const unitSeconds = Math.max(1, Math.floor(activity.unitSeconds));
    const elapsedSeconds = Math.floor(elapsed / 1000);
    const unitElapsedSeconds = elapsedSeconds % unitSeconds;

    const completedSecondBoundary =
      unitSeconds > 1 &&
      elapsedSeconds > 0 &&
      elapsedSeconds % unitSeconds === 0;

    const remainingSeconds = Math.max(
      0,
      Math.ceil((duration - elapsed) / 1000),
    );

    const isComplete = duration === 0 ? true : elapsed >= duration;

    // Display remaining time until the next unit completes.
    // At the exact unit boundary (bar hits 100%), show 0:00 instead of resetting early.
    const remainingInUnitSeconds = isComplete
      ? null
      : completedSecondBoundary
        ? 0
        : Math.max(0, unitSeconds - unitElapsedSeconds);

    const nextItemInTime =
      remainingInUnitSeconds === null
        ? null
        : (() => {
            const hours = Math.floor(remainingInUnitSeconds / 3600);
            const minutes = Math.floor((remainingInUnitSeconds % 3600) / 60);
            const seconds = remainingInUnitSeconds % 60;
            return `${hours ? hours + ":" : ""}${minutes}:${seconds.toString().padStart(2, "0")}`;
          })();

    const progress =
      duration === 0 || remainingSeconds === 0
        ? 1
        : unitSeconds <= 1
          ? 1
          : completedSecondBoundary
            ? 1
            : unitElapsedSeconds / unitSeconds;

    // Visual helper bar: always 1 UI-tick (1 second) ahead.
    // Example (unitSeconds=5): real 0%,20%,40%,60%,80%,100%,20%...
    // preview 20%,40%,60%,80%,100%,20%,40%...
    const previewProgress =
      unitSeconds <= 1
        ? 1
        // When the real bar hits 100% (resource gathered), keep the preview at 100%
        // for that moment. This prevents the preview bar from appearing "behind"
        // due to wrapping to the next unit immediately.
        : completedSecondBoundary
          ? 1
          : Math.min(1, progress + 1 / unitSeconds);

    const label = `${activity.resource.name}`;

    return {
      kind: "vocation" as const,
      skillLabel,
      label,
      href,
      sprite: activity.resource.item.sprite,
      remainingSeconds,
      nextItemInTime,
      sessionRemainingSeconds: remainingSeconds,
      progress,
      previewProgress,
      unitsTotal,
      yieldPerUnit: Math.max(1, activity.resource.yieldPerUnit),
      xpPerUnit: Math.max(0, Math.floor(activity.resource.xpPerUnit ?? 0)),
      xpPerSecond: Math.max(
        0,
        Math.floor(activity.resource.xpPerUnit ?? 0) /
          Math.max(1, activity.unitSeconds),
      ).toFixed(2),
      skillProgress: status?.skillProgress ?? null,
    };
  }, [status, travelStatus, travelSync, now]);

  // Instant per-unit callback (matches fill-bar timing).
  // This fires when the client-side computed "unitsTotal" advances (i.e. when the bar hits 100%).
  // Note: this is based on time, not on server confirmation.
  useEffect(() => {
    if (!derived || derived.kind !== "vocation") return;

    const activityId = status?.activity?.id ?? null;
    const unitsTotal = derived.unitsTotal ?? null;

    if (!activityId || unitsTotal == null) {
      prevActivityIdRef.current = null;
      prevUnitsTotalRef.current = null;
      return;
    }

    if (prevActivityIdRef.current !== activityId) {
      prevActivityIdRef.current = activityId;
      prevUnitsTotalRef.current = unitsTotal;
      return;
    }

    const prevUnitsTotal = prevUnitsTotalRef.current;
    if (prevUnitsTotal == null) {
      prevUnitsTotalRef.current = unitsTotal;
      return;
    }

    if (unitsTotal > prevUnitsTotal) {
      const delta = unitsTotal - prevUnitsTotal;
      for (let i = 0; i < delta; i++) {
        toast.custom(
          (t) =>
            React.createElement(
              "span",
              {
                className:
                  "flex items-center gap-2 bg-gray-700 px-3 py-2 text-sm text-foreground shadow-sm rounded-lg",
              },
              derived.sprite
                ? React.createElement("img", {
                    src: derived.sprite,
                    alt: derived.label,
                    className: "h-8 w-8 object-contain",
                  })
                : null,
              React.createElement(
                "span",
                { className: "font-medium" },
                `+${derived.yieldPerUnit} ${derived.label}`,
              ),
            ),
          { position: "bottom-right", duration: 5000 },
        );
      }
    }

    prevUnitsTotalRef.current = unitsTotal;
  }, [status?.activity?.id, derived]);

  useEffect(() => {
    if (!derived) {
      setDisplayUnitsTotal(0);
      return;
    }

    if (derived.kind !== "vocation") {
      setDisplayUnitsTotal(0);
      return;
    }

    const t = window.setTimeout(
      () => setDisplayUnitsTotal(derived.unitsTotal),
      ACTION_BAR_LAG_MS,
    );
    return () => window.clearTimeout(t);
  }, [derived]);

  const viewModel: ActiveActionViewModel | null = useMemo(() => {
    if (!derived) return null;

    return {
      skillLabel: derived.skillLabel,
      label: derived.label,
      href: derived.href,
      sprite: derived.sprite,
      remainingSeconds: derived.remainingSeconds,
      nextItemInTime: derived.nextItemInTime,
      sessionRemainingSeconds: derived.sessionRemainingSeconds,
      progress: derived.progress,
      previewProgress: derived.previewProgress,
      sessionAmount:
        derived.kind === "vocation"
          ? displayUnitsTotal * derived.yieldPerUnit
          : 0,
      sessionLabel: "this session",
      xpPerUnit: derived.xpPerUnit,
      xpPerSecond: derived.xpPerSecond,
      skillProgress: derived.skillProgress,
    };
  }, [derived, displayUnitsTotal]);

  const stopMutation = useMutation({
    mutationFn: async (kind: "vocation" | "travel") => {
      const url =
        kind === "travel" ? "/api/travel/cancel" : "/api/vocations/stop";
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to stop");
      }
      return res.json();
    },
    onMutate: async () => {
      // Optimistic update - immediately clear UI
      setTravelStatus({ travel: null, progress: null });
      setStatus((prev) =>
        prev ? { activity: null, progress: null, skillProgress: null } : prev,
      );
      dispatchActiveActionEvent({ kind: "stop-optimistic" });
    },
    onSuccess: async () => {
      // Refresh status to get updated state (inventory updated server-side)
      await refresh();

      // Notify listeners of change (for other components)
      dispatchActiveActionEvent({ kind: "changed" });
    },
    onError: async () => {
      // Revert optimistic update on error
      await refresh();
    },
  });

  const stop = useCallback(() => {
    const kind = travelStatus?.travel ? "travel" : "vocation";
    stopMutation.mutate(kind);
  }, [stopMutation, travelStatus?.travel]);

  return {
    active: !!viewModel,
    viewModel,
    activeResourceId: status?.activity?.resource?.id ?? null,
    activeActionType: travelStatus?.travel
      ? ("TRAVEL" as const)
      : status?.activity?.actionType ?? null,
    stop,
    error: stopMutation.error?.message ?? null,
    isStopping: stopMutation.isPending,
  };
}
