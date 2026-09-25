"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleCheck,
  Clock3,
  Compass,
  Footprints,
  Leaf,
  LockKeyhole,
  MapPin,
  PackageOpen,
  Route,
} from "lucide-react";
import toast from "react-hot-toast";
import type { ItemRarity } from "~/generated/prisma/enums";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { dispatchSkillProgressEvent } from "~/components/game/skills/skillProgressEvents";
import { Button } from "~/components/ui/button";
import { gatheringQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import { RarityBadge } from "~/utils/ui/rarity-badge";
import { formatRemaining, formatTime } from "~/components/game/actions/format";
import { RewardHaul } from "~/components/game/items/RewardHaul";

type GatheringReward = {
  resourceId: number;
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

type GatheringResource =
  | {
      unlocked: false;
      requiredGatheringLevel: number;
    }
  | {
      unlocked: true;
      id: number;
      itemId: number;
      name: string;
      sprite: string;
      rarity: ItemRarity;
      requiredGatheringLevel: number;
    };

type GatheringData = {
  skillProgress: {
    level: number;
    currentXp: number;
    xpForNextLevel: number;
    xpProgress: number;
    xpRemaining: number;
  };
  modifiers: {
    luck: number;
    gatheringEfficiency: number;
    sources: {
      equipmentLuck: number;
      equipmentGatheringEfficiency: number;
      activeEffect: null | {
        itemId: number;
        name: string;
        sprite: string;
        endsAt: string;
        luck: number;
        gatheringEfficiency: number;
      };
    };
  };
  durations: Array<{
    id: number;
    label: string;
    durationSeconds: number;
    xpReward: number;
    requiredGatheringLevel: number;
    unlocked: boolean;
  }>;
  location: null | {
    id: number;
    name: string;
    gatheringEnabled: boolean;
    requiredGatheringLevel: number;
    unlocked: boolean;
    resources: GatheringResource[];
  };
  expedition: null | {
    id: number;
    status: "ACTIVE" | "READY" | "CLAIMED";
    startedAt: string;
    endsAt: string;
    claimedAt: string | null;
    durationSeconds: number;
    location: { id: number; name: string };
    rewards: GatheringReward[];
  };
};

function ModifierSummary({ data }: { data: GatheringData }) {
  const effect = data.modifiers.sources.activeEffect;
  return (
    <div
      className="gathering-modifiers"
      aria-label="Relevant Gathering bonuses"
    >
      <div>
        <span>Luck</span>
        <strong>
          {data.modifiers.luck >= 0 ? "+" : ""}
          {data.modifiers.luck}
        </strong>
      </div>
      <div>
        <span>Gathering efficiency</span>
        <strong>+{data.modifiers.gatheringEfficiency}%</strong>
      </div>
      {effect ? (
        <div className="gathering-effect-summary">
          <span>Active provision</span>
          <strong>
            <Image src={effect.sprite} alt="" width={28} height={28} />
            {effect.name}
          </strong>
        </div>
      ) : null}
    </div>
  );
}

function ResourceGuide({
  location,
}: {
  location: NonNullable<GatheringData["location"]>;
}) {
  const discovered = location.resources.filter(
    (resource) => resource.unlocked,
  ).length;

  return (
    <div className="gathering-find-list">
      <div className="gathering-find-heading">
        <h3>Possible finds</h3>
        {location.resources.length > 0 ? (
          <span>
            {discovered} / {location.resources.length} discovered
          </span>
        ) : null}
      </div>
      {location.resources.length === 0 ? (
        <div className="game-empty-state">No gatherable resources here.</div>
      ) : (
        <div className="gathering-resource-list">
          {location.resources.map((resource, index) =>
            resource.unlocked ? (
              <div className="gathering-resource-row" key={resource.id}>
                <ItemArtwork
                  src={resource.sprite}
                  name={resource.name}
                  rarity={resource.rarity}
                  size={52}
                  itemId={resource.itemId}
                />
                <div className="min-w-0 flex-1">
                  <strong>{resource.name}</strong>
                </div>
                <RarityBadge rarity={resource.rarity} />
              </div>
            ) : (
              <div
                className="gathering-resource-row is-locked"
                key={`unknown-${resource.requiredGatheringLevel}-${index}`}
              >
                <span className="gathering-unknown-resource" aria-hidden="true">
                  <LockKeyhole />
                </span>
                <div className="min-w-0 flex-1">
                  <strong>Undiscovered</strong>
                  <small>Gathering {resource.requiredGatheringLevel}</small>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ExpeditionCard({
  expedition,
  now,
  claiming,
  onClaim,
}: {
  expedition: NonNullable<GatheringData["expedition"]>;
  now: number;
  claiming: boolean;
  onClaim: () => void;
}) {
  const started = new Date(expedition.startedAt).getTime();
  const ends = new Date(expedition.endsAt).getTime();
  const elapsed = Math.max(0, Math.min(ends - started, now - started));
  const total = Math.max(1, ends - started);
  const progress = expedition.status === "CLAIMED" ? 1 : elapsed / total;
  const remaining = Math.max(
    0,
    Math.min(expedition.durationSeconds, Math.ceil((ends - now) / 1000)),
  );

  if (expedition.status === "CLAIMED") {
    return (
      <section
        className="game-panel gathering-return"
        aria-labelledby="gathering-return-title"
      >
        <div className="gathering-return-heading">
          <span className="gathering-state-icon" data-state="claimed">
            <PackageOpen aria-hidden="true" />
          </span>
          <div>
            <p className="game-eyebrow">Expedition journal</p>
            <h2 id="gathering-return-title" className="game-section-title">
              Returned from {expedition.location.name}
            </h2>
          </div>
        </div>
        <RewardHaul rewards={expedition.rewards} />
      </section>
    );
  }

  const ready = expedition.status === "READY" || remaining === 0;
  return (
    <section
      className="game-panel gathering-active-card"
      data-ready={ready}
      aria-labelledby="gathering-active-title"
    >
      <div className="gathering-active-top">
        <span
          className="gathering-state-icon"
          data-state={ready ? "ready" : "active"}
        >
          {ready ? (
            <CircleCheck aria-hidden="true" />
          ) : (
            <Footprints aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="game-eyebrow">
            {ready ? "Returned" : "Currently exploring"}
          </p>
          <h2 id="gathering-active-title" className="game-section-title">
            {expedition.location.name}
          </h2>
        </div>
        <span className="gathering-timer" aria-live="polite">
          {ready ? "Ready to claim" : formatRemaining(remaining)}
        </span>
      </div>

      <div className="gathering-route" aria-hidden="true">
        <span className="gathering-route-start">
          <Compass />
        </span>
        <i>
          <b style={{ width: `${Math.max(2, Math.floor(progress * 100))}%` }} />
        </i>
        <span className="gathering-route-end">
          <MapPin />
        </span>
      </div>
      <div className="gathering-route-labels">
        <span>Departed {formatTime(expedition.startedAt)}</span>
        <span>
          {ready ? "Returned" : `Due ${formatTime(expedition.endsAt)}`}
        </span>
      </div>

      {ready ? (
        <div className="gathering-claim-callout">
          <strong>Your haul is ready to unpack.</strong>
          <Button onClick={onClaim} disabled={claiming}>
            <PackageOpen className="mr-2 h-4 w-4" aria-hidden="true" />
            {claiming ? "Unpacking…" : "Claim expedition"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export default function GatheringExpedition() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [selectedDurationId, setSelectedDurationId] = useState<number | null>(
    null,
  );

  const gatheringQuery = useQuery({
    queryKey: gatheringQueryKeys.all(),
    queryFn: async (): Promise<GatheringData> => {
      const response = await fetch("/api/gathering", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | GatheringData
        | { error?: string }
        | null;
      if (!response.ok || !data || "error" in data) {
        throw new Error(
          data && "error" in data ? data.error : "Failed to load Gathering",
        );
      }
      return data as GatheringData;
    },
    refetchInterval: (query) =>
      query.state.data?.expedition?.status === "ACTIVE" ? 30_000 : false,
  });

  const data = gatheringQuery.data;
  useEffect(() => {
    if (data?.expedition?.status !== "ACTIVE") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [data?.expedition?.status]);

  useEffect(() => {
    if (!data) return;
    const selected = data.durations.find(
      (duration) => duration.id === selectedDurationId,
    );
    if (selected?.unlocked) return;
    const shortestUnlocked = [...data.durations]
      .filter((duration) => duration.unlocked)
      .sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
    setSelectedDurationId(shortestUnlocked?.id ?? null);
  }, [data, selectedDurationId]);

  const selectedDuration = useMemo(
    () =>
      data?.durations.find((duration) => duration.id === selectedDurationId) ??
      null,
    [data?.durations, selectedDurationId],
  );

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!data?.location || !selectedDuration?.unlocked) {
        throw new Error("Choose an available expedition duration");
      }
      const response = await fetch("/api/gathering/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationId: selectedDuration.id }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Failed to depart");
    },
    onSuccess: async () => {
      toast.success(`Expedition sent from ${data?.location?.name ?? "camp"}`);
      dispatchActiveActionEvent({ kind: "changed" });
      await queryClient.invalidateQueries({
        queryKey: gatheringQueryKeys.all(),
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to depart"),
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/gathering/claim", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        rewards?: GatheringReward[];
      } | null;
      if (!response.ok)
        throw new Error(body?.error ?? "Failed to claim expedition");
      return body;
    },
    onSuccess: async (result) => {
      const total =
        result?.rewards?.reduce((sum, reward) => sum + reward.quantity, 0) ?? 0;
      toast.success(
        `Expedition claimed · ${total} item${total === 1 ? "" : "s"} found`,
      );
      dispatchActiveActionEvent({ kind: "changed" });
      dispatchSkillProgressEvent("Gathering");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: gatheringQueryKeys.all() }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to claim"),
  });

  if (gatheringQuery.isLoading) {
    return (
      <div className="game-panel game-empty-state">
        Preparing the expedition journal…
      </div>
    );
  }
  if (gatheringQuery.isError || !data) {
    return (
      <div className="game-panel game-empty-state">
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
    );
  }

  const blocksPlanning = Boolean(
    data.expedition && data.expedition.status !== "CLAIMED",
  );
  const location = data.location;
  const hasDiscoveredResource = Boolean(
    location?.resources.some((resource) => resource.unlocked),
  );

  return (
    <div className="game-gathering space-y-5">
      {data.expedition ? (
        <ExpeditionCard
          expedition={data.expedition}
          now={now}
          claiming={claimMutation.isPending}
          onClaim={() => claimMutation.mutate()}
        />
      ) : null}

      {!blocksPlanning ? (
        <section
          className="game-panel gathering-planner"
          aria-labelledby="gathering-plan-title"
        >
          <div className="game-panel-header">
            <div>
              <p className="game-eyebrow">Current location</p>
              <h2 id="gathering-plan-title" className="game-section-title">
                {location?.name ?? "No location"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/map">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  Atlas
                </Link>
              </Button>
              <span className="gathering-level-chip">
                <Leaf /> Gathering {data.skillProgress.level}
              </span>
            </div>
          </div>

          <div className="game-panel-body space-y-6">
            {!location ? (
              <div className="game-empty-state">
                <MapPin className="mx-auto mb-3 h-6 w-6" aria-hidden="true" />
                <strong>Travel to a location to gather.</strong>
                <div className="mt-4">
                  <Button asChild>
                    <Link href="/map">Open atlas</Link>
                  </Button>
                </div>
              </div>
            ) : !location.gatheringEnabled ? (
              <div className="game-empty-state">
                <LockKeyhole
                  className="mx-auto mb-3 h-6 w-6"
                  aria-hidden="true"
                />
                <strong>Gathering is unavailable here.</strong>
                <div className="mt-4">
                  <Button asChild variant="secondary">
                    <Link href="/map">Travel elsewhere</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ModifierSummary data={data} />

                <ResourceGuide location={location} />

                {!location.unlocked ? (
                  <div className="gathering-lock-note">
                    <LockKeyhole /> Gathering {location.requiredGatheringLevel}
                    required at this location.
                  </div>
                ) : null}

                <div className="gathering-duration-section">
                  <div>
                    <p className="game-eyebrow">Time away</p>
                    <h3>Expedition duration</h3>
                  </div>
                  {data.durations.length === 0 ? (
                    <div className="game-empty-state">
                      No expedition durations are enabled.
                    </div>
                  ) : (
                    <div
                      className="gathering-duration-grid"
                      role="radiogroup"
                      aria-label="Expedition duration"
                    >
                      {data.durations.map((duration) => (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selectedDurationId === duration.id}
                          aria-label={
                            duration.unlocked
                              ? duration.label
                              : `${duration.label}, unlocks at Gathering level ${duration.requiredGatheringLevel}`
                          }
                          className="gathering-duration-choice"
                          data-selected={selectedDurationId === duration.id}
                          data-locked={!duration.unlocked}
                          disabled={!duration.unlocked}
                          key={duration.id}
                          onClick={() => setSelectedDurationId(duration.id)}
                        >
                          {duration.unlocked ? <Clock3 /> : <LockKeyhole />}
                          <strong>{duration.label}</strong>
                          <small>
                            {duration.unlocked
                              ? `${duration.xpReward} XP`
                              : `Gathering ${duration.requiredGatheringLevel}`}
                          </small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="gathering-departure-bar">
                  <div>
                    <Route aria-hidden="true" />
                    <span>
                      <strong>{location.name}</strong>
                      <small>
                        {selectedDuration?.label ?? "No duration available"}
                      </small>
                    </span>
                  </div>
                  <Button
                    size="lg"
                    disabled={
                      !location.unlocked ||
                      !hasDiscoveredResource ||
                      !selectedDuration?.unlocked ||
                      startMutation.isPending
                    }
                    onClick={() => startMutation.mutate()}
                  >
                    <Compass className="mr-2 h-4 w-4" aria-hidden="true" />
                    {startMutation.isPending ? "Preparing…" : "Send gathering"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : location?.gatheringEnabled ? (
        <section className="game-panel gathering-field-guide-while-away">
          <ResourceGuide location={location} />
        </section>
      ) : null}
    </div>
  );
}
