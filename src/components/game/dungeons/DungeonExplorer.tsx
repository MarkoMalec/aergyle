"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Castle, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { Button } from "~/components/ui/button";
import { dungeonQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import { DungeonActiveRun } from "./DungeonActiveRun";
import { DungeonBanner } from "./DungeonBanner";
import { DungeonJournal } from "./DungeonJournal";
import { DungeonPlanner } from "./DungeonPlanner";
import { listRewards } from "./shared";
import type { DungeonData, Report, Reward } from "./types";

export default function DungeonExplorer({
  initialDungeonId = null,
}: {
  initialDungeonId?: number | null;
}) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState(initialDungeonId);
  const [journalOpen, setJournalOpen] = useState(false);

  const dungeonQuery = useQuery({
    queryKey: dungeonQueryKeys.all(),
    queryFn: async (): Promise<DungeonData> => {
      const response = await fetch("/api/dungeons", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as
        | DungeonData
        | { error?: string }
        | null;
      if (!response.ok || !body || "error" in body) {
        throw new Error(
          body && "error" in body ? body.error : "Failed to load dungeons",
        );
      }
      return body as DungeonData;
    },
    refetchInterval: (query) =>
      query.state.data?.run?.status === "ACTIVE" ? 30_000 : false,
  });
  const data = dungeonQuery.data;
  const fetchedAt = dungeonQuery.dataUpdatedAt;

  const healthRecovering = Boolean(
    data && data.vitals.currentHealth < data.vitals.maxHealth,
  );
  useEffect(() => {
    if (data?.run?.status !== "ACTIVE" && !healthRecovering) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [data?.run?.status, healthRecovering]);

  useEffect(() => {
    if (!data?.location) return;
    const current = data.location.dungeons.find((row) => row.id === selectedId);
    if (!current?.unlocked) {
      setSelectedId(
        data.location.dungeons.find((row) => row.unlocked)?.id ?? null,
      );
    }
  }, [data, selectedId]);

  const selected = useMemo(
    () => data?.location?.dungeons.find((row) => row.id === selectedId) ?? null,
    [data?.location?.dungeons, selectedId],
  );

  const refresh = async (includeInventory = false) => {
    dispatchActiveActionEvent({ kind: "changed" });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dungeonQueryKeys.all() }),
      includeInventory
        ? queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() })
        : null,
    ]);
  };

  const post = async (url: string, body?: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await response.json().catch(() => null)) as {
      error?: string;
      outcome?: Report["outcome"];
      rewards?: Reward[];
      xp?: number;
    } | null;
    if (!response.ok) throw new Error(json?.error ?? "Request failed");
    return json;
  };

  const enterMutation = useMutation({
    mutationFn: async () => {
      if (!selected?.unlocked) throw new Error("Choose an available dungeon");
      return post("/api/dungeons/start", { dungeonId: selected.id });
    },
    onSuccess: async () => {
      toast.success(`You descend into ${selected?.name ?? "the dungeon"}`);
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to enter"),
  });

  const claimMutation = useMutation({
    mutationFn: () => post("/api/dungeons/claim"),
    onSuccess: async (result) => {
      if (result?.outcome === "DEFEATED") {
        toast.error(
          result.rewards?.length
            ? `Defeated · you crawled out with ${listRewards(result.rewards)}`
            : "Defeated · you crawled out empty-handed",
        );
      } else {
        const items =
          result?.rewards?.reduce((sum, reward) => sum + reward.quantity, 0) ??
          0;
        toast.success(
          `Dungeon cleared · ${items} item${items === 1 ? "" : "s"} · +${result?.xp ?? 0} XP`,
        );
      }
      await refresh(true);
      // The journal opens on the run that was just revealed.
      setNow(Date.now());
      setJournalOpen(true);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to claim"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => post("/api/dungeons/cancel"),
    onSuccess: async () => {
      toast.success("You left the dungeon unharmed, and empty-handed");
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to leave"),
  });

  const banner = (
    <DungeonBanner
      locationName={data?.location?.name ?? null}
      journalCount={data?.journal.length ?? 0}
      lastRun={data?.journal[0] ?? null}
      onOpenJournal={
        data
          ? () => {
              setNow(Date.now());
              setJournalOpen(true);
            }
          : null
      }
    />
  );

  if (dungeonQuery.isLoading) {
    return (
      <div className="space-y-6">
        {banner}
        <div className="game-panel-flat game-empty-state">
          Lighting torches and checking your gear…
        </div>
      </div>
    );
  }
  if (dungeonQuery.isError || !data) {
    return (
      <div className="space-y-6">
        {banner}
        <div className="game-panel-flat game-empty-state">
          <p>
            {dungeonQuery.error instanceof Error
              ? dungeonQuery.error.message
              : "Dungeons are unavailable."}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => dungeonQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  // Health regenerates lazily on the server; mirror it between refreshes.
  const elapsedSeconds = Math.max(0, (now - fetchedAt) / 1_000);
  const currentHealth = Math.min(
    data.vitals.maxHealth,
    data.vitals.currentHealth + data.vitals.healthRegen * elapsedSeconds,
  );
  const healthPercent =
    data.vitals.maxHealth > 0
      ? (currentHealth / data.vitals.maxHealth) * 100
      : 0;
  const run = data.run;
  const activeRun = run && run.status !== "CLAIMED" ? run : null;

  return (
    <div className="space-y-6">
      {banner}

      {activeRun ? (
        <DungeonActiveRun
          run={activeRun}
          now={now}
          monsters={
            data.location?.dungeons.find(
              (dungeon) => dungeon.id === activeRun.dungeon.id,
            )?.monsters ?? []
          }
          claiming={claimMutation.isPending}
          leaving={leaveMutation.isPending}
          onClaim={() => claimMutation.mutate()}
          onLeave={() => {
            if (
              window.confirm(
                "Leave the dungeon now? You keep no loot, but lose no health.",
              )
            ) {
              leaveMutation.mutate();
            }
          }}
        />
      ) : !data.location ? (
        <div className="game-panel-flat game-empty-state">
          <MapPin className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
          <strong>Travel to a location to find its dungeons.</strong>
          <div className="mt-4">
            <Button asChild>
              <Link href="/map">Open atlas</Link>
            </Button>
          </div>
        </div>
      ) : data.location.dungeons.length === 0 ? (
        <div className="game-panel-flat game-empty-state">
          <Castle className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
          <strong>No dungeons are open in {data.location.name}.</strong>
          <div className="mt-4">
            <Button asChild variant="secondary">
              <Link href="/map">Find another location</Link>
            </Button>
          </div>
        </div>
      ) : (
        <DungeonPlanner
          dungeons={data.location.dungeons}
          selected={selected}
          onSelect={setSelectedId}
          combat={data.combat}
          health={{
            current: currentHealth,
            max: data.vitals.maxHealth,
            regen: data.vitals.healthRegen,
            ready:
              currentHealth > 0 &&
              healthPercent >= data.minimumHealthToStartPercent,
            minimumPercent: data.minimumHealthToStartPercent,
          }}
          entering={enterMutation.isPending}
          onEnter={() => enterMutation.mutate()}
        />
      )}

      <DungeonJournal
        open={journalOpen}
        onOpenChange={setJournalOpen}
        entries={data.journal}
        now={now}
      />
    </div>
  );
}
