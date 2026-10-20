"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Footprints, Leaf, MapPin, PackageOpen, Undo2 } from "lucide-react";
import toast from "react-hot-toast";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { dispatchSkillProgressEvent } from "~/components/game/skills/skillProgressEvents";
import { Button } from "~/components/ui/button";
import { gatheringQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import { formatLength } from "~/components/game/actions/format";
import {
  ActiveExpeditionCard,
  JournalButton,
  LocationChip,
} from "~/components/game/expeditions/parts";
import { GatheringJournal } from "./GatheringJournal";
import { GatheringPlanner } from "./GatheringPlanner";
import type { GatheringData, Reward } from "./types";

export default function GatheringExpedition() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [selectedDurationId, setSelectedDurationId] = useState<number | null>(
    null,
  );
  const [journalOpen, setJournalOpen] = useState(false);

  const gatheringQuery = useQuery({
    queryKey: gatheringQueryKeys.all(),
    queryFn: async (): Promise<GatheringData> => {
      const response = await fetch("/api/gathering", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as
        | GatheringData
        | { error?: string }
        | null;
      if (!response.ok || !body || "error" in body) {
        throw new Error(
          body && "error" in body ? body.error : "Failed to load Gathering",
        );
      }
      return body as GatheringData;
    },
    refetchInterval: (query) =>
      query.state.data?.expedition?.status === "ACTIVE" ? 30_000 : false,
  });
  const data = gatheringQuery.data;

  // A countdown ticks every second; the planner's return time every half minute.
  const active = data?.expedition?.status === "ACTIVE";
  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      active ? 1_000 : 30_000,
    );
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    if (!data) return;
    const duration = data.durations.find(
      (row) => row.id === selectedDurationId,
    );
    if (!duration?.unlocked) {
      setSelectedDurationId(
        data.durations.find((row) => row.unlocked)?.id ?? null,
      );
    }
  }, [data, selectedDurationId]);

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
    } | null;
    if (!response.ok) throw new Error(json?.error ?? "Request failed");
    return json;
  };

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDuration?.unlocked) {
        throw new Error("Choose an available expedition length");
      }
      return post("/api/gathering/start", { durationId: selectedDuration.id });
    },
    onSuccess: async () => {
      toast.success(
        `Expedition sent out in ${data?.location?.name ?? "the wilds"}`,
      );
      dispatchActiveActionEvent({ kind: "changed" });
      await queryClient.invalidateQueries({
        queryKey: gatheringQueryKeys.all(),
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to depart"),
  });

  const claimMutation = useMutation({
    mutationFn: () => post("/api/gathering/claim"),
    onSuccess: async (result) => {
      const items =
        result?.rewards?.reduce((sum, reward) => sum + reward.quantity, 0) ?? 0;
      toast.success(
        `Expedition claimed · ${items} item${items === 1 ? "" : "s"} found`,
      );
      dispatchActiveActionEvent({ kind: "changed" });
      dispatchSkillProgressEvent("Gathering");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: gatheringQueryKeys.all() }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      ]);
      // The journal opens on the expedition that was just claimed.
      setNow(Date.now());
      setJournalOpen(true);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to claim"),
  });

  const returnMutation = useMutation({
    mutationFn: () => post("/api/gathering/cancel"),
    onSuccess: async () => {
      toast.success("You came back early, empty-handed");
      dispatchActiveActionEvent({ kind: "changed" });
      await queryClient.invalidateQueries({
        queryKey: gatheringQueryKeys.all(),
      });
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
                label: `Back from ${data.journal[0].location.name}`,
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

  if (gatheringQuery.isLoading) {
    return (
      <div className="space-y-6">
        {toolbar}
        <div className="game-panel-flat game-empty-state">
          Packing the satchel…
        </div>
      </div>
    );
  }
  if (gatheringQuery.isError || !data) {
    return (
      <div className="space-y-6">
        {toolbar}
        <div className="game-panel-flat game-empty-state">
          <p>
            {gatheringQuery.error instanceof Error
              ? gatheringQuery.error.message
              : "Gathering is unavailable."}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => gatheringQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const expedition =
    data.expedition && data.expedition.status !== "CLAIMED"
      ? data.expedition
      : null;
  const searchingFor =
    expedition && data.location?.id === expedition.location.id
      ? data.location.resources.flatMap((resource) =>
          resource.unlocked
            ? [{ id: resource.id, name: resource.name, asset: resource.sprite }]
            : [],
        )
      : [];

  return (
    <div className="space-y-6">
      {toolbar}

      {expedition ? (
        <ActiveExpeditionCard
          status={expedition.status}
          startedAt={expedition.startedAt}
          endsAt={expedition.endsAt}
          now={now}
          eyebrow={{
            active: "Currently gathering",
            ready: "Gatherer returned",
          }}
          title={expedition.location.name}
          meta={
            <span>{formatLength(expedition.durationSeconds)} expedition</span>
          }
          route={{ from: Footprints, to: Leaf, startedLabel: "Set out at" }}
          faces={searchingFor}
          facesLabel={{ active: "Searching for", ready: "Searched for" }}
          footer={(ready) =>
            ready
              ? {
                  title: "Your gatherer is back.",
                  action: (
                    <Button
                      className="shrink-0 sm:min-w-[184px]"
                      onClick={() => claimMutation.mutate()}
                      disabled={claimMutation.isPending}
                    >
                      <PackageOpen className="h-4 w-4" aria-hidden="true" />
                      {claimMutation.isPending ? "Unpacking…" : "Claim haul"}
                    </Button>
                  ),
                }
              : {
                  title: "Coming back early leaves the haul behind.",
                  action: (
                    <Button
                      variant="secondary"
                      className="shrink-0"
                      disabled={returnMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm("Come back now? You keep nothing.")
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
          <strong>Travel to a location to gather.</strong>
          <div className="mt-4">
            <Button asChild>
              <Link href="/map">Open atlas</Link>
            </Button>
          </div>
        </div>
      ) : !data.location.gatheringEnabled ? (
        <div className="game-panel-flat game-empty-state">
          <Leaf className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
          <strong>Nothing to gather in {data.location.name}.</strong>
          <div className="mt-4">
            <Button asChild variant="secondary">
              <Link href="/map">Find another location</Link>
            </Button>
          </div>
        </div>
      ) : (
        <GatheringPlanner
          location={data.location}
          skillLevel={data.skillProgress.level}
          durations={data.durations}
          duration={selectedDuration}
          onSelectDuration={setSelectedDurationId}
          modifiers={data.modifiers}
          now={now}
          starting={startMutation.isPending}
          onStart={() => startMutation.mutate()}
        />
      )}

      <GatheringJournal
        open={journalOpen}
        onOpenChange={setJournalOpen}
        entries={data.journal}
        now={now}
      />
    </div>
  );
}
