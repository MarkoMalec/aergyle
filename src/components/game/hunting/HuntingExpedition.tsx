"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Footprints, MapPin, PackageOpen, PawPrint, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { dispatchSkillProgressEvent } from "~/components/game/skills/skillProgressEvents";
import { Button } from "~/components/ui/button";
import { huntingQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import { formatLength } from "~/components/game/actions/format";
import {
  ActiveExpeditionCard,
  JournalButton,
  LocationChip,
} from "~/components/game/expeditions/parts";
import { HuntingJournal } from "./HuntingJournal";
import { HuntingPlanner } from "./HuntingPlanner";
import type { HuntingData, Report, Reward } from "./types";

export default function HuntingExpedition({
  initialGroundId = null,
}: {
  initialGroundId?: number | null;
}) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [selectedGroundId, setSelectedGroundId] = useState(initialGroundId);
  const [selectedDurationId, setSelectedDurationId] = useState<number | null>(
    null,
  );
  const [journalOpen, setJournalOpen] = useState(false);

  const huntingQuery = useQuery({
    queryKey: huntingQueryKeys.all(),
    queryFn: async (): Promise<HuntingData> => {
      const response = await fetch("/api/hunting", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as
        | HuntingData
        | { error?: string }
        | null;
      if (!response.ok || !body || "error" in body) {
        throw new Error(
          body && "error" in body ? body.error : "Failed to load Hunting",
        );
      }
      return body as HuntingData;
    },
    refetchInterval: (query) =>
      query.state.data?.expedition?.status === "ACTIVE" ? 30_000 : false,
  });
  const data = huntingQuery.data;
  const fetchedAt = huntingQuery.dataUpdatedAt;

  const healthRecovering = Boolean(
    data && data.vitals.currentHealth < data.vitals.maxHealth,
  );
  useEffect(() => {
    if (data?.expedition?.status !== "ACTIVE" && !healthRecovering) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [data?.expedition?.status, healthRecovering]);

  useEffect(() => {
    if (!data) return;
    const ground = data.location?.grounds.find(
      (row) => row.id === selectedGroundId,
    );
    if (!ground?.unlocked) {
      setSelectedGroundId(
        data.location?.grounds.find((row) => row.unlocked)?.id ?? null,
      );
    }
    const duration = data.durations.find(
      (row) => row.id === selectedDurationId,
    );
    if (!duration?.unlocked) {
      setSelectedDurationId(
        data.durations.find((row) => row.unlocked)?.id ?? null,
      );
    }
  }, [data, selectedDurationId, selectedGroundId]);

  const selectedGround = useMemo(
    () =>
      data?.location?.grounds.find(
        (ground) => ground.id === selectedGroundId,
      ) ?? null,
    [data?.location?.grounds, selectedGroundId],
  );
  const selectedDuration = useMemo(
    () =>
      data?.durations.find((duration) => duration.id === selectedDurationId) ??
      null,
    [data?.durations, selectedDurationId],
  );

  const post = async (url: string, body?: unknown) => {
    const response = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await response.json().catch(() => null)) as {
      error?: string;
      rewards?: Reward[];
      report?: Report;
    } | null;
    if (!response.ok) throw new Error(json?.error ?? "Request failed");
    return json;
  };

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGround?.unlocked || !selectedDuration?.unlocked) {
        throw new Error("Choose an available hunting ground and duration");
      }
      return post("/api/hunting/start", {
        groundId: selectedGround.id,
        durationId: selectedDuration.id,
      });
    },
    onSuccess: async () => {
      toast.success(
        `Hunting expedition sent to ${selectedGround?.name ?? "the wilds"}`,
      );
      dispatchActiveActionEvent({ kind: "changed" });
      await queryClient.invalidateQueries({ queryKey: huntingQueryKeys.all() });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to depart"),
  });

  const claimMutation = useMutation({
    mutationFn: () => post("/api/hunting/claim"),
    onSuccess: async (result) => {
      const items =
        result?.rewards?.reduce((sum, reward) => sum + reward.quantity, 0) ?? 0;
      const damage = Math.round(result?.report?.totalDamage ?? 0);
      toast.success(
        `Hunt claimed · ${items} material${items === 1 ? "" : "s"}${damage > 0 ? ` · ${damage} damage taken` : ""}`,
      );
      dispatchActiveActionEvent({ kind: "changed" });
      dispatchSkillProgressEvent("Hunting");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: huntingQueryKeys.all() }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      ]);
      // The journal opens on the hunt that was just claimed.
      setNow(Date.now());
      setJournalOpen(true);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to claim"),
  });

  const returnMutation = useMutation({
    mutationFn: () => post("/api/hunting/cancel"),
    onSuccess: async () => {
      toast.success("You came back early, unhurt and empty-handed");
      dispatchActiveActionEvent({ kind: "changed" });
      await queryClient.invalidateQueries({ queryKey: huntingQueryKeys.all() });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to return"),
  });

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {data?.location ? (
        <LocationChip name={data.location.name} className="bg-card" />
      ) : (
        <span />
      )}
      <JournalButton
        count={data?.journal.length ?? 0}
        last={
          data?.journal[0]
            ? {
                good: true,
                label: `Back from ${data.journal[0].ground.name}`,
              }
            : null
        }
        onClick={
          data
            ? () => {
                setNow(Date.now());
                setJournalOpen(true);
              }
            : null
        }
        className="bg-card hover:bg-secondary/70"
      />
    </div>
  );

  if (huntingQuery.isLoading) {
    return (
      <div className="space-y-6">
        {toolbar}
        <div className="game-panel-flat game-empty-state">
          Reading tracks and checking equipment…
        </div>
      </div>
    );
  }
  if (huntingQuery.isError || !data) {
    return (
      <div className="space-y-6">
        {toolbar}
        <div className="game-panel-flat game-empty-state">
          <p>
            {huntingQuery.error instanceof Error
              ? huntingQuery.error.message
              : "Hunting is unavailable."}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => huntingQuery.refetch()}
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
  const expedition =
    data.expedition && data.expedition.status !== "CLAIMED"
      ? data.expedition
      : null;

  return (
    <div className="space-y-6">
      {toolbar}

      {expedition ? (
        <ActiveExpeditionCard
          status={expedition.status}
          startedAt={expedition.startedAt}
          endsAt={expedition.endsAt}
          now={now}
          eyebrow={{ active: "Currently tracking", ready: "Hunter returned" }}
          title={expedition.ground.name}
          meta={
            <>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {expedition.ground.location.name}
              </span>
              <span>· {formatLength(expedition.durationSeconds)} hunt</span>
            </>
          }
          route={{ from: Footprints, to: PawPrint, startedLabel: "Set out at" }}
          faces={
            data.location?.grounds.find(
              (ground) => ground.id === expedition.ground.id,
            )?.creatures ?? []
          }
          facesLabel={{ active: "On the trail of", ready: "Tracked" }}
          footer={(ready) =>
            ready
              ? {
                  title: "Your hunter is back.",
                  text: "Materials, damage and experience are revealed together.",
                  action: (
                    <Button
                      className="shrink-0 sm:min-w-[184px]"
                      onClick={() => claimMutation.mutate()}
                      disabled={claimMutation.isPending}
                    >
                      <PackageOpen className="h-4 w-4" aria-hidden="true" />
                      {claimMutation.isPending ? "Processing…" : "Claim hunt"}
                    </Button>
                  ),
                }
              : {
                  title: "Coming back early is safe, but empty-handed.",
                  text: "You lose no health, and you keep nothing.",
                  action: (
                    <Button
                      variant="secondary"
                      className="shrink-0"
                      disabled={returnMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Come back now? You keep nothing, but lose no health.",
                          )
                        ) {
                          returnMutation.mutate();
                        }
                      }}
                    >
                      <Undo2 className="h-4 w-4" aria-hidden="true" />
                      {returnMutation.isPending ? "Returning…" : "Return early"}
                    </Button>
                  ),
                }
          }
        />
      ) : !data.location ? (
        <div className="game-panel-flat game-empty-state">
          <MapPin className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
          <strong>Travel to a location before choosing hunting grounds.</strong>
          <div className="mt-4">
            <Button asChild>
              <Link href="/map">Open atlas</Link>
            </Button>
          </div>
        </div>
      ) : data.location.grounds.length === 0 ? (
        <div className="game-panel-flat game-empty-state">
          <PawPrint className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
          <strong>No hunting grounds are open in {data.location.name}.</strong>
          <div className="mt-4">
            <Button asChild variant="secondary">
              <Link href="/map">Find another location</Link>
            </Button>
          </div>
        </div>
      ) : (
        <HuntingPlanner
          grounds={data.location.grounds}
          selected={selectedGround}
          onSelect={setSelectedGroundId}
          durations={data.durations}
          duration={selectedDuration}
          onSelectDuration={setSelectedDurationId}
          modifiers={data.modifiers}
          safety={data.safety}
          health={{
            current: currentHealth,
            max: data.vitals.maxHealth,
            regen: data.vitals.healthRegen,
            // The same rule the server checks on departure.
            ready: healthPercent >= data.safety.minimumHealthToStartPercent,
          }}
          starting={startMutation.isPending}
          onStart={() => startMutation.mutate()}
        />
      )}

      <HuntingJournal
        open={journalOpen}
        onOpenChange={setJournalOpen}
        entries={data.journal}
        now={now}
      />
    </div>
  );
}
