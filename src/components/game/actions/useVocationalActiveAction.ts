"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ItemRarity,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addActiveActionEventListener,
  dispatchActiveActionEvent,
} from "~/components/game/actions/activeActionEvents";
import { useRealtimeConnected } from "~/components/realtime/realtimeConnection";
import { useUserContext } from "~/context/userContext";
import { refreshProgress } from "~/lib/player-sync";
import { gardenQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import { toSkillNameFromActionType } from "~/utils/vocations";
import toast from "react-hot-toast";

export type StatusResponse = {
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

type GardenHarvestStatusResponse =
  | {
      harvest: {
        id: number;
        startedAt: string;
        endsAt: string;
        tileCount: number;
        tiles?: Array<{
          tileIndex: number;
          harvestSeconds: number;
          yieldItem: { id: number; name: string; sprite: string };
        }>;
      };
      progress: {
        progress: number;
        remainingSeconds: number;
        isComplete: boolean;
      };
    }
  | { harvest: null; progress: null };

type GatheringStatusResponse = {
  expedition: null | {
    id: number;
    status: "ACTIVE" | "READY" | "CLAIMED";
    startedAt: string;
    endsAt: string;
    durationSeconds: number;
    location: { id: number; name: string };
  };
};

type HuntingStatusResponse = {
  expedition: null | {
    id: number;
    status: "ACTIVE" | "READY" | "CLAIMED";
    startedAt: string;
    endsAt: string;
    durationSeconds: number;
    ground: {
      id: number;
      name: string;
      location: { id: number; name: string };
    };
  };
};

type DungeonStatusResponse = {
  run: null | {
    id: number;
    status: "ACTIVE" | "READY" | "CLAIMED";
    startedAt: string;
    endsAt: string;
    durationSeconds: number;
    dungeon: {
      id: number;
      name: string;
      location: { id: number; name: string };
    };
  };
};

function getGardenHarvestCurrentSprite(params: {
  startedAtMs: number;
  nowMs: number;
  tiles:
    | Array<{
        tileIndex: number;
        harvestSeconds: number;
        yieldItem: { id: number; name: string; sprite: string };
      }>
    | null
    | undefined;
}) {
  const tiles = params.tiles;
  if (!tiles || tiles.length === 0) return undefined;

  const elapsedSeconds = Math.max(
    0,
    Math.floor((params.nowMs - params.startedAtMs) / 1000),
  );

  let cursor = 0;
  for (const t of tiles) {
    const dur = Math.max(1, Math.floor(t.harvestSeconds));
    if (elapsedSeconds < cursor + dur) return t.yieldItem.sprite;
    cursor += dur;
  }

  return tiles[tiles.length - 1]?.yieldItem.sprite;
}

function getGardenHarvestCurrentYieldItem(params: {
  startedAtMs: number;
  nowMs: number;
  tiles:
    | Array<{
        tileIndex: number;
        harvestSeconds: number;
        yieldItem: { id: number; name: string; sprite: string };
      }>
    | null
    | undefined;
}) {
  const tiles = params.tiles;
  if (!tiles || tiles.length === 0) return undefined;

  const segment = getGardenHarvestSegment({
    startedAtMs: params.startedAtMs,
    nowMs: params.nowMs,
    tiles,
  });

  const idx = Math.max(0, Math.min(tiles.length - 1, segment.tileIndex));
  return tiles[idx]?.yieldItem;
}

function getGardenHarvestSegment(params: {
  startedAtMs: number;
  nowMs: number;
  tiles:
    | Array<{
        tileIndex: number;
        harvestSeconds: number;
        yieldItem: { id: number; name: string; sprite: string };
      }>
    | null
    | undefined;
}) {
  const tiles = params.tiles;
  if (!tiles || tiles.length === 0) {
    return {
      tileIndex: 0,
      tileCount: 0,
      tileProgress: 0,
      tilePreviewProgress: 0,
      remainingInTileSeconds: null as number | null,
    };
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((params.nowMs - params.startedAtMs) / 1000),
  );

  let cursor = 0;
  for (let i = 0; i < tiles.length; i++) {
    const dur = Math.max(1, Math.floor(tiles[i]!.harvestSeconds));
    const inThis = elapsedSeconds - cursor;
    if (inThis < dur) {
      const tileProgress =
        dur <= 1 ? 1 : Math.max(0, Math.min(1, inThis / dur));
      const tilePreviewProgress =
        dur <= 1 ? 1 : Math.min(1, tileProgress + 1 / dur);
      const remainingInTileSeconds = Math.max(0, dur - inThis);
      return {
        tileIndex: i,
        tileCount: tiles.length,
        tileProgress,
        tilePreviewProgress,
        remainingInTileSeconds,
      };
    }
    cursor += dur;
  }

  // If we ran past the end (should be rare), treat as last tile complete.
  return {
    tileIndex: tiles.length - 1,
    tileCount: tiles.length,
    tileProgress: 1,
    tilePreviewProgress: 1,
    remainingInTileSeconds: 0,
  };
}

async function fetchStatus<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  return res.ok ? ((await res.json()) as T) : null;
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
  canStop: boolean;
};

const ACTION_BAR_LAG_MS = 500;

export type UseVocationalActiveActionResult = ReturnType<
  typeof useVocationalActiveAction
>;

export function useVocationalActiveAction() {
  const [travelStatus, setTravelStatus] = useState<TravelStatusResponse | null>(
    null,
  );
  const [gardenHarvestStatus, setGardenHarvestStatus] =
    useState<GardenHarvestStatusResponse | null>(null);
  const [gatheringStatus, setGatheringStatus] =
    useState<GatheringStatusResponse | null>(null);
  const [huntingStatus, setHuntingStatus] =
    useState<HuntingStatusResponse | null>(null);
  const [dungeonStatus, setDungeonStatus] =
    useState<DungeonStatusResponse | null>(null);
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

  const queryClient = useQueryClient();
  const { user } = useUserContext();
  const userId = user?.id;
  const realtimeConnected = useRealtimeConnected();

  // Items and XP changed server-side but we have no details (a polled tick or a stop):
  // refetch everything that shows them.
  const syncPlayerData = useCallback(
    (skill: VocationalActionType | null) => {
      void queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.byUser(userId),
      });
      refreshProgress(queryClient, userId, skill);
    },
    [queryClient, userId],
  );

  const refresh = useCallback(async () => {
    try {
      // Every status at once (only one activity can run); priority is applied below.
      const [
        travelJson,
        gardenJson,
        gatheringJson,
        huntingJson,
        dungeonJson,
        vocationJson,
      ] = await Promise.all([
        fetchStatus<TravelStatusResponse>("/api/travel/status"),
        fetchStatus<GardenHarvestStatusResponse>("/api/garden/harvest/status"),
        fetchStatus<GatheringStatusResponse>("/api/gathering/status"),
        fetchStatus<HuntingStatusResponse>("/api/hunting/status"),
        fetchStatus<DungeonStatusResponse>("/api/dungeons/status"),
        fetchStatus<StatusResponse>("/api/vocations/status"),
      ]);

      // Travel has priority: while traveling, you can't do other actions.
      if (travelJson) {
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
          setGardenHarvestStatus({ harvest: null, progress: null });
          setGatheringStatus({ expedition: null });
          setHuntingStatus({ expedition: null });
          setDungeonStatus({ run: null });
          return;
        }
      }

      // Gardening harvest has next priority: while harvesting, you can't do other actions.
      if (gardenJson) {
        setGardenHarvestStatus(gardenJson);
        if (gardenJson.harvest) {
          // Clear vocational status while harvesting.
          setStatus({ activity: null, progress: null, skillProgress: null });
          setGatheringStatus({ expedition: null });
          setHuntingStatus({ expedition: null });
          setDungeonStatus({ run: null });
          return;
        }
      }

      if (gatheringJson) {
        setGatheringStatus(gatheringJson);
        if (
          gatheringJson.expedition &&
          gatheringJson.expedition.status !== "CLAIMED"
        ) {
          setStatus({ activity: null, progress: null, skillProgress: null });
          setHuntingStatus({ expedition: null });
          setDungeonStatus({ run: null });
          return;
        }
      }

      if (huntingJson) {
        setHuntingStatus(huntingJson);
        if (
          huntingJson.expedition &&
          huntingJson.expedition.status !== "CLAIMED"
        ) {
          setStatus({ activity: null, progress: null, skillProgress: null });
          setDungeonStatus({ run: null });
          return;
        }
      }

      if (dungeonJson) {
        setDungeonStatus(dungeonJson);
        if (dungeonJson.run && dungeonJson.run.status !== "CLAIMED") {
          setStatus({ activity: null, progress: null, skillProgress: null });
          return;
        }
      }

      if (vocationJson) setStatus(vocationJson);
    } catch {
      // ignore
    }
  }, []);

  // A successful start means no other activity is running; show it without a refetch.
  const applyVocationStatus = useCallback((next: StatusResponse) => {
    setTravelStatus({ travel: null, progress: null });
    setTravelSync(null);
    setGardenHarvestStatus({ harvest: null, progress: null });
    setGatheringStatus({ expedition: null });
    setHuntingStatus({ expedition: null });
    setDungeonStatus({ run: null });
    setStatus(next);
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

    const garden = gardenHarvestStatus?.harvest;
    if (garden) {
      const nowMs = Date.now();
      const startedAtMs = new Date(garden.startedAt).getTime();
      const endsAtMs = new Date(garden.endsAt).getTime();
      const msToEnd = Math.max(0, endsAtMs - nowMs) + 75;

      // The daemon pays out each tile and pushes it; without it, poll each tile's end.
      let msToNext = msToEnd;
      if (!realtimeConnected) {
        const segment = getGardenHarvestSegment({
          startedAtMs,
          nowMs,
          tiles: garden.tiles,
        });
        if (segment.remainingInTileSeconds !== null) {
          const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);
          const nextTileAtMs =
            startedAtMs +
            (elapsedSeconds + segment.remainingInTileSeconds) * 1000;
          msToNext = Math.min(msToEnd, Math.max(75, nextTileAtMs - nowMs + 75));
        }
      }

      const t = window.setTimeout(() => {
        void refresh().then(() => {
          syncPlayerData("GARDENING");
          void queryClient.invalidateQueries({
            queryKey: gardenQueryKeys.all(),
          });
        });
      }, msToNext);

      return () => window.clearTimeout(t);
    }

    const expedition = gatheringStatus?.expedition;
    if (expedition?.status === "ACTIVE") {
      const endsAtMs = new Date(expedition.endsAt).getTime();
      const msToEnd = Math.max(0, endsAtMs - Date.now()) + 75;
      const t = window.setTimeout(() => {
        void refresh();
      }, msToEnd);
      return () => window.clearTimeout(t);
    }

    const huntingExpedition = huntingStatus?.expedition;
    if (huntingExpedition?.status === "ACTIVE") {
      const endsAtMs = new Date(huntingExpedition.endsAt).getTime();
      const msToEnd = Math.max(0, endsAtMs - Date.now()) + 75;
      const t = window.setTimeout(() => {
        void refresh();
      }, msToEnd);
      return () => window.clearTimeout(t);
    }

    const dungeonRun = dungeonStatus?.run;
    if (dungeonRun?.status === "ACTIVE") {
      const endsAtMs = new Date(dungeonRun.endsAt).getTime();
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

    // Always refresh right after endsAt so the activity clears promptly.
    const msToEnd = Math.max(0, endsAtMs - nowMs) + 75;

    // The daemon claims every unit and pushes it. Without it, refresh at each unit
    // boundary so the server can auto-grant that unit immediately (and shortly after
    // a boundary we're sitting exactly on, unless it's the start).
    let msToNext = msToEnd;
    if (!realtimeConnected) {
      msToNext = Math.min(
        msToEnd,
        remainder === 0 && elapsedMs > 0
          ? 75
          : Math.max(75, unitMs - remainder),
      );
    }

    const actionType = activity.actionType;
    const t = window.setTimeout(() => {
      void refresh().then(() => syncPlayerData(actionType));
    }, msToNext);

    return () => window.clearTimeout(t);
  }, [
    travelStatus?.travel?.startedAt,
    travelStatus?.travel?.endsAt,
    gardenHarvestStatus?.harvest?.startedAt,
    gardenHarvestStatus?.harvest?.endsAt,
    gatheringStatus?.expedition?.status,
    gatheringStatus?.expedition?.startedAt,
    gatheringStatus?.expedition?.endsAt,
    gatheringStatus?.expedition,
    huntingStatus?.expedition?.status,
    huntingStatus?.expedition?.startedAt,
    huntingStatus?.expedition?.endsAt,
    huntingStatus?.expedition,
    dungeonStatus?.run?.status,
    dungeonStatus?.run?.endsAt,
    dungeonStatus?.run,
    status?.activity?.startedAt,
    status?.activity?.endsAt,
    status?.activity?.unitSeconds,
    status?.activity?.unitsClaimed,
    status?.activity,
    travelStatus?.travel,
    gardenHarvestStatus?.harvest,
    refresh,
    realtimeConnected,
    syncPlayerData,
    queryClient,
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
        setGatheringStatus({ expedition: null });
        setHuntingStatus({ expedition: null });
        setDungeonStatus({ run: null });
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
        canStop: true,
      };
    }

    const garden = gardenHarvestStatus?.harvest;
    if (garden) {
      const startedAt = new Date(garden.startedAt).getTime();
      const endsAt = new Date(garden.endsAt).getTime();

      const durationSeconds = Math.max(
        1,
        Math.round((endsAt - startedAt) / 1000),
      );
      const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000));

      const segment = getGardenHarvestSegment({
        startedAtMs: startedAt,
        nowMs: now,
        tiles: garden.tiles ?? null,
      });

      const currentYieldItem = getGardenHarvestCurrentYieldItem({
        startedAtMs: startedAt,
        nowMs: now,
        tiles: garden.tiles ?? null,
      });

      const progress =
        garden.tiles && garden.tiles.length > 0
          ? segment.tileProgress
          : Math.max(
              0,
              Math.min(1, 1 - remainingSeconds / Math.max(1, durationSeconds)),
            );

      const previewProgress =
        garden.tiles && garden.tiles.length > 0
          ? segment.tilePreviewProgress
          : progress;

      const nextItemInTime =
        segment.remainingInTileSeconds == null
          ? null
          : (() => {
              const total = Math.max(
                0,
                Math.floor(segment.remainingInTileSeconds),
              );
              const minutes = Math.floor(total / 60);
              const seconds = total % 60;
              return `${minutes}:${seconds.toString().padStart(2, "0")}`;
            })();

      const label = currentYieldItem?.name ?? "Harvesting";

      // Show a single running count (completed tiles) rather than x/x.
      const sessionAmount =
        segment.tileCount > 0 ? Math.max(0, segment.tileIndex) : 0;

      return {
        kind: "garden" as const,
        skillLabel: "Gardening",
        href: "/skills/Gardening",
        label,
        sprite:
          currentYieldItem?.sprite ??
          getGardenHarvestCurrentSprite({
            startedAtMs: startedAt,
            nowMs: now,
            tiles: garden.tiles ?? null,
          }),
        remainingSeconds,
        nextItemInTime,
        sessionRemainingSeconds: remainingSeconds,
        progress,
        previewProgress,
        sessionAmount,
        unitsTotal: 0,
        yieldPerUnit: 0,
        xpPerUnit: 0,
        xpPerSecond: "0.00",
        skillProgress: null,
        canStop: true,
      };
    }

    const expedition = gatheringStatus?.expedition;
    if (expedition && expedition.status !== "CLAIMED") {
      const startedAt = new Date(expedition.startedAt).getTime();
      const endsAt = new Date(expedition.endsAt).getTime();
      const duration = Math.max(1, endsAt - startedAt);
      const elapsed = Math.max(0, Math.min(duration, now - startedAt));
      const ready = expedition.status === "READY" || now >= endsAt;
      const progress = ready ? 1 : elapsed / duration;
      const remainingSeconds = ready
        ? 0
        : Math.max(0, Math.ceil((endsAt - now) / 1000));

      return {
        kind: "gathering" as const,
        skillLabel: "Gathering",
        href: "/skills/Gathering",
        label: ready
          ? `Claim haul from ${expedition.location.name}`
          : `Exploring ${expedition.location.name}`,
        sprite: undefined,
        remainingSeconds,
        nextItemInTime: null,
        sessionRemainingSeconds: remainingSeconds,
        progress,
        previewProgress: progress,
        sessionAmount: 0,
        unitsTotal: 0,
        yieldPerUnit: 0,
        xpPerUnit: 0,
        xpPerSecond: "0.00",
        skillProgress: null,
        canStop: !ready,
      };
    }

    const huntingExpedition = huntingStatus?.expedition;
    if (huntingExpedition && huntingExpedition.status !== "CLAIMED") {
      const startedAt = new Date(huntingExpedition.startedAt).getTime();
      const endsAt = new Date(huntingExpedition.endsAt).getTime();
      const duration = Math.max(1, endsAt - startedAt);
      const elapsed = Math.max(0, Math.min(duration, now - startedAt));
      const ready = huntingExpedition.status === "READY" || now >= endsAt;
      const progress = ready ? 1 : elapsed / duration;
      const remainingSeconds = ready
        ? 0
        : Math.max(0, Math.ceil((endsAt - now) / 1000));

      return {
        kind: "hunting" as const,
        skillLabel: "Hunting",
        href: "/skills/Hunting",
        label: ready
          ? `Claim hunt from ${huntingExpedition.ground.name}`
          : `Hunting in ${huntingExpedition.ground.name}`,
        sprite: undefined,
        remainingSeconds,
        nextItemInTime: null,
        sessionRemainingSeconds: remainingSeconds,
        progress,
        previewProgress: progress,
        sessionAmount: 0,
        unitsTotal: 0,
        yieldPerUnit: 0,
        xpPerUnit: 0,
        xpPerSecond: "0.00",
        skillProgress: null,
        canStop: !ready,
      };
    }

    const dungeonRun = dungeonStatus?.run;
    if (dungeonRun && dungeonRun.status !== "CLAIMED") {
      const startedAt = new Date(dungeonRun.startedAt).getTime();
      const endsAt = new Date(dungeonRun.endsAt).getTime();
      const duration = Math.max(1, endsAt - startedAt);
      const elapsed = Math.max(0, Math.min(duration, now - startedAt));
      const ready = dungeonRun.status === "READY" || now >= endsAt;
      const progress = ready ? 1 : elapsed / duration;
      const remainingSeconds = ready
        ? 0
        : Math.max(0, Math.ceil((endsAt - now) / 1000));

      return {
        kind: "dungeon" as const,
        skillLabel: "Dungeon",
        href: "/dungeons",
        label: ready
          ? `Claim run from ${dungeonRun.dungeon.name}`
          : `Fighting in ${dungeonRun.dungeon.name}`,
        sprite: undefined,
        remainingSeconds,
        nextItemInTime: null,
        sessionRemainingSeconds: remainingSeconds,
        progress,
        previewProgress: progress,
        sessionAmount: 0,
        unitsTotal: 0,
        yieldPerUnit: 0,
        xpPerUnit: 0,
        xpPerSecond: "0.00",
        skillProgress: null,
        canStop: !ready,
      };
    }

    const activity = status?.activity;
    if (!activity) return null;

    const skillLabel = toSkillNameFromActionType(activity.actionType);
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
        : // When the real bar hits 100% (resource gathered), keep the preview at 100%
          // for that moment. This prevents the preview bar from appearing "behind"
          // due to wrapping to the next unit immediately.
          completedSecondBoundary
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
      canStop: true,
    };
  }, [
    status,
    travelStatus,
    gardenHarvestStatus,
    gatheringStatus,
    huntingStatus,
    dungeonStatus,
    travelSync,
    now,
  ]);

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
          (_toast) =>
            React.createElement(
              "span",
              {
                className:
                  "flex items-center gap-2 bg-card px-3 py-1 text-sm text-foreground shadow-sm rounded-lg",
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
          : derived.kind === "garden"
            ? derived.sessionAmount ?? 0
            : 0,
      sessionLabel: "this session",
      xpPerUnit: derived.xpPerUnit,
      xpPerSecond: derived.xpPerSecond,
      skillProgress: derived.skillProgress,
      canStop: derived.canStop,
    };
  }, [derived, displayUnitsTotal]);

  const stopMutation = useMutation({
    mutationFn: async (
      kind:
        | "vocation"
        | "travel"
        | "garden"
        | "gathering"
        | "hunting"
        | "dungeon",
    ) => {
      const url =
        kind === "travel"
          ? "/api/travel/cancel"
          : kind === "garden"
            ? "/api/garden/harvest/cancel"
            : kind === "gathering"
              ? "/api/gathering/cancel"
              : kind === "hunting"
                ? "/api/hunting/cancel"
                : kind === "dungeon"
                  ? "/api/dungeons/cancel"
                  : "/api/vocations/stop";
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null);
        const message =
          json &&
          typeof json === "object" &&
          "error" in json &&
          typeof json.error === "string"
            ? json.error
            : "Failed to stop";
        throw new Error(message);
      }
      return res.json();
    },
    onMutate: async () => {
      const skill: VocationalActionType | null = gardenHarvestStatus?.harvest
        ? "GARDENING"
        : status?.activity?.actionType ?? null;

      // Optimistic update - immediately clear UI
      setTravelStatus({ travel: null, progress: null });
      setGardenHarvestStatus({ harvest: null, progress: null });
      setStatus((prev) =>
        prev ? { activity: null, progress: null, skillProgress: null } : prev,
      );
      setGatheringStatus({ expedition: null });
      setHuntingStatus({ expedition: null });
      setDungeonStatus({ run: null });
      dispatchActiveActionEvent({ kind: "stop-optimistic" });
      return { skill };
    },
    onSuccess: async (_data, kind, context) => {
      // Refresh status to get updated state (inventory updated server-side)
      await refresh();

      // Stopping a vocation or harvest pays out what it earned so far.
      if (kind === "vocation" || kind === "garden") {
        syncPlayerData(context?.skill ?? null);
      }

      // Notify listeners of change (for other components)
      dispatchActiveActionEvent({ kind: "changed" });
    },
    onError: async () => {
      // Revert optimistic update on error
      await refresh();
    },
  });

  const stop = useCallback(() => {
    const kind = travelStatus?.travel
      ? "travel"
      : gardenHarvestStatus?.harvest
        ? "garden"
        : gatheringStatus?.expedition &&
            gatheringStatus.expedition.status !== "CLAIMED"
          ? "gathering"
          : huntingStatus?.expedition &&
              huntingStatus.expedition.status !== "CLAIMED"
            ? "hunting"
            : dungeonStatus?.run && dungeonStatus.run.status !== "CLAIMED"
              ? "dungeon"
              : "vocation";
    stopMutation.mutate(kind);
  }, [
    stopMutation,
    travelStatus?.travel,
    gardenHarvestStatus?.harvest,
    gatheringStatus?.expedition,
    huntingStatus?.expedition,
    dungeonStatus?.run,
  ]);

  return {
    active: !!viewModel,
    viewModel,
    activeResourceId: status?.activity?.resource?.id ?? null,
    activeActionType: travelStatus?.travel
      ? ("TRAVEL" as const)
      : gardenHarvestStatus?.harvest
        ? ("GARDENING" as const)
        : gatheringStatus?.expedition &&
            gatheringStatus.expedition.status !== "CLAIMED"
          ? ("GATHERING" as const)
          : huntingStatus?.expedition &&
              huntingStatus.expedition.status !== "CLAIMED"
            ? ("HUNTING" as const)
            : dungeonStatus?.run && dungeonStatus.run.status !== "CLAIMED"
              ? ("DUNGEON" as const)
              : status?.activity?.actionType ?? null,
    stop,
    applyVocationStatus,
    error: stopMutation.error?.message ?? null,
    isStopping: stopMutation.isPending,
  };
}
