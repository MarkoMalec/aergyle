"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ItemRarity, VocationalActionType } from "@prisma/client";
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
  skillProgress:
    | null
    | {
        trackKey: string;
        level: number;
        currentXp: number;
        xpForNextLevel: number;
        xpProgress: number;
        xpRemaining: number;
      };
};

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
  sprite: string;
  remainingSeconds: number;
  nextItemInTime: string | null;
  sessionRemainingSeconds: number;
  progress: number;
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
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [displayUnitsTotal, setDisplayUnitsTotal] = useState(0);

  const prevActivityIdRef = useRef<number | null>(null);
  const prevUnitsTotalRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
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
    let msToNext = remainder === 0 && elapsedMs > 0 ? 75 : Math.max(75, unitMs - remainder);

    // Also ensure we refresh right after endsAt so the activity clears promptly.
    const msToEnd = Math.max(0, endsAtMs - nowMs) + 75;
    msToNext = Math.min(msToNext, msToEnd);

    const t = window.setTimeout(() => {
      void refresh();
    }, msToNext);

    return () => window.clearTimeout(t);
  }, [
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
        setStatus((prev) => (prev ? { activity: null, progress: null, skillProgress: null } : prev));
        return;
      }
      if (kind === "changed") void refresh();
    });
  }, [refresh]);

  const derived = useMemo(() => {
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

    const unitHours = Math.floor(activity.unitSeconds / 3600);
    const unitMinutes = Math.floor(activity.unitSeconds / 60);
    const unitSeconds = Math.max(1, Math.floor(activity.unitSeconds));
    const elapsedSeconds = Math.floor(elapsed / 1000);
    const unitElapsedSeconds = elapsedSeconds % unitSeconds;

    const remainingSeconds = Math.max(0, Math.ceil((duration - elapsed) / 1000));

    const isComplete = duration === 0 ? true : elapsed >= duration;
    // always must be 0:00 but the numbers must change accordingly, if not null
    const nextItemInTime = isComplete
      ? null
      : `${unitHours ? unitHours + ":" : ""}${unitMinutes}:${(unitSeconds - unitElapsedSeconds).toString().padStart(2, "0")}`;

    // Fill only once per second: each second adds 1/unitSeconds.
    // IMPORTANT: we also show 100% at the exact second a tick completes.
    // Example (unitSeconds=5): 0%,20%,40%,60%,80%,100%,20%,...
    const completedSecondBoundary =
      unitSeconds > 1 && elapsedSeconds > 0 && elapsedSeconds % unitSeconds === 0;

    const progress =
      duration === 0 || remainingSeconds === 0
        ? 1
        : unitSeconds <= 1
          ? 1
          : completedSecondBoundary
            ? 1
            : unitElapsedSeconds / unitSeconds;

    const label = `${activity.resource.name}`;

    return {
      skillLabel,
      label,
      href,
      sprite: activity.resource.item.sprite,
      remainingSeconds,
      nextItemInTime,
      sessionRemainingSeconds: remainingSeconds,
      progress,
      unitsTotal,
      yieldPerUnit: Math.max(1, activity.resource.yieldPerUnit),
      xpPerUnit: Math.max(0, Math.floor(activity.resource.xpPerUnit ?? 0)),
      xpPerSecond: Math.max(
        0,
        Math.floor(activity.resource.xpPerUnit ?? 0) / Math.max(1, activity.unitSeconds),
      ).toFixed(2),
      skillProgress: status?.skillProgress ?? null,
    };
  }, [status, now]);

  // Instant per-unit callback (matches fill-bar timing).
  // This fires when the client-side computed "unitsTotal" advances (i.e. when the bar hits 100%).
  // Note: this is based on time, not on server confirmation.
  useEffect(() => {
    const activityId = status?.activity?.id ?? null;
    const unitsTotal = derived?.unitsTotal ?? null;

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
      for (let i = 0; i < delta; i++) toast.success(`+${derived?.yieldPerUnit} ${derived?.label}`, { position: 'bottom-right' });
    }

    prevUnitsTotalRef.current = unitsTotal;
  }, [status?.activity?.id, derived?.unitsTotal]);

  useEffect(() => {
    if (!derived) {
      setDisplayUnitsTotal(0);
      return;
    }

    const t = window.setTimeout(
      () => setDisplayUnitsTotal(derived.unitsTotal),
      ACTION_BAR_LAG_MS,
    );
    return () => window.clearTimeout(t);
  }, [derived?.unitsTotal]);

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
      sessionAmount: displayUnitsTotal * derived.yieldPerUnit,
      sessionLabel: "this session",
      xpPerUnit: derived.xpPerUnit,
      xpPerSecond: derived.xpPerSecond,
      skillProgress: derived.skillProgress,
    };
  }, [derived, displayUnitsTotal]);

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/vocations/stop", {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to stop");
      }
      return res.json();
    },
    onMutate: async () => {
      // Optimistic update - immediately clear UI
      setStatus((prev) => (prev ? { activity: null, progress: null, skillProgress: null } : prev));
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
    stopMutation.mutate();
  }, [stopMutation]);

  return {
    active: !!viewModel,
    viewModel,
    activeResourceId: status?.activity?.resource?.id ?? null,
    activeActionType: status?.activity?.actionType ?? null,
    stop,
    error: stopMutation.error?.message ?? null,
    isStopping: stopMutation.isPending,
  };
}
