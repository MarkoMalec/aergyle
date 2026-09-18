"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CircleCheck,
  Clock3,
  Compass,
  Crosshair,
  Footprints,
  HeartPulse,
  LockKeyhole,
  MapPin,
  PackageOpen,
  PawPrint,
  Route,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  CreatureAttackStyle,
  CreatureDamageType,
  ItemRarity,
} from "~/generated/prisma/enums";
import { bestiaryHref, describeCreatureDamage } from "~/game/creatures";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { dispatchSkillProgressEvent } from "~/components/game/skills/skillProgressEvents";
import { Button } from "~/components/ui/button";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { RarityBadge } from "~/utils/ui/rarity-badge";

type Reward = {
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

type Drop =
  | { unlocked: false; requiredHuntingLevel: number }
  | {
      unlocked: true;
      id: number;
      baseChance: number;
      minQuantity: number;
      maxQuantity: number;
      requiredHuntingLevel: number;
      item: {
        id: number;
        name: string;
        sprite: string;
        rarity: ItemRarity;
      };
    };

type Creature = {
  id: number;
  name: string;
  description: string | null;
  asset: string;
  encounterWeight: number;
  attackStyle: CreatureAttackStyle;
  attackChance: number;
  damageMin: number;
  damageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  damageType: CreatureDamageType | null;
  elementalDamageMin: number;
  elementalDamageMax: number;
  drops: Drop[];
};

type Ground = {
  id: number;
  name: string;
  description: string | null;
  requiredHuntingLevel: number;
  unlocked: boolean;
  accidentChance: number;
  accidentDamage: { min: number; max: number };
  creatures: Creature[];
};

type Report = {
  encounters: Array<{
    creatureId: number;
    name: string;
    asset: string;
    count: number;
    attacks: number;
    evaded: number;
    blocked: number;
    damageTaken: number;
  }>;
  accidents: { attempts: number; injuries: number; damageTaken: number };
  totalDamage: number;
  health?: { before: number; after: number; max: number };
};

type HuntingData = {
  skillProgress: { level: number };
  modifiers: {
    luck: number;
    huntingEfficiency: number;
    defenses: {
      armor: number;
      magicResist: number;
      evasionMelee: number;
      evasionRanged: number;
      evasionMagic: number;
      blockChance: number;
      movementSpeed: number;
      maxHealth: number;
    };
    sources: {
      activeEffect: null | {
        itemId: number;
        name: string;
        sprite: string;
        endsAt: string;
      };
    };
  };
  vitals: {
    currentHealth: number;
    maxHealth: number;
    healthRegen: number;
    percent: number;
  };
  safety: {
    damageEnabled: boolean;
    globalDangerMultiplier: number;
    maxHealthLossPercent: number;
    minimumRemainingHealthPercent: number;
    minimumHealthToStartPercent: number;
  };
  durations: Array<{
    id: number;
    label: string;
    durationSeconds: number;
    encounterRolls: number;
    dangerMultiplier: number;
    xpReward: number;
    requiredHuntingLevel: number;
    unlocked: boolean;
  }>;
  location: null | {
    id: number;
    name: string;
    unlocked: boolean;
    grounds: Ground[];
  };
  expedition: null | {
    id: number;
    status: "ACTIVE" | "READY" | "CLAIMED";
    startedAt: string;
    endsAt: string;
    claimedAt: string | null;
    durationSeconds: number;
    ground: {
      id: number;
      name: string;
      location: { id: number; name: string };
    };
    rewards: Reward[];
    report: Report | null;
  };
};

function formatRemaining(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`
    : `${minutes}m ${String(secs).padStart(2, "0")}s`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function riskLabel(chance: number) {
  if (chance <= 0) return null;
  if (chance <= 3) return "Minimal";
  if (chance <= 5) return "Low";
  if (chance <= 9) return "Guarded";
  if (chance <= 15) return "Risky";
  return "Dangerous";
}

function HealthCard({ data }: { data: HuntingData }) {
  const ready = data.vitals.percent >= data.safety.minimumHealthToStartPercent;
  return (
    <div className="rounded-xl bg-secondary/25 p-4">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <HeartPulse className="h-4 w-4 text-danger" /> Current health
        </span>
        <strong className="tabular-nums">
          {Math.floor(data.vitals.currentHealth)} /{" "}
          {Math.floor(data.vitals.maxHealth)}
        </strong>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
        <div
          className="h-full rounded-full bg-danger transition-[width]"
          style={{
            width: `${Math.max(0, Math.min(100, data.vitals.percent))}%`,
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          Regenerates {data.vitals.healthRegen.toFixed(1)} health/second
        </span>
        <span className={ready ? "text-success" : "text-warning"}>
          {ready
            ? "Fit to hunt"
            : `Recover to ${data.safety.minimumHealthToStartPercent}%`}
        </span>
      </div>
    </div>
  );
}

function CreatureGuide({
  ground,
  dangerScale,
}: {
  ground: Ground;
  dangerScale: number;
}) {
  return (
    <div className="space-y-3">
      <div className="gathering-find-heading">
        <h3>Animals in this ground</h3>
        <span>{ground.creatures.length} tracked species</span>
      </div>
      {ground.creatures.length === 0 ? (
        <div className="game-empty-state">No animals are configured here.</div>
      ) : (
        ground.creatures.map((creature) => {
          const effectiveAttackChance = Math.max(
            0,
            Math.min(0.95, creature.attackChance * dangerScale),
          );
          return (
            <article
              className="rounded-xl bg-secondary/20 p-3"
              key={creature.id}
            >
              <div className="flex items-start gap-3">
                <Image
                  src={creature.asset}
                  alt={creature.name}
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] shrink-0 rounded-xl bg-black/10 object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <strong className="block text-sm">{creature.name}</strong>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {creature.description}
                      </p>
                    </div>
                    {riskLabel(effectiveAttackChance) && (
                      <span className="rounded-full border border-warning/25 bg-warning/10 px-2 py-1 text-[10px] font-semibold text-warning">
                        {riskLabel(effectiveAttackChance)}
                      </span>
                    )}
                  </div>
                  {creature.attackChance > 0 ? (
                    <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Shield className="h-3 w-3" />{" "}
                      {[
                        `${creature.attackStyle.toLowerCase()} retaliation`,
                        ...describeCreatureDamage(creature),
                      ].join(" · ")}
                    </p>
                  ) : null}
                  <Link
                    href={bestiaryHref("ANIMAL", creature.id)}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Materials and details in the bestiary
                  </Link>
                </div>
              </div>
              {/* Dont delete below this, it might be introduced later */}
              {/* <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {creature.drops.map((drop, index) =>
                  drop.unlocked ? (
                    <div
                      className="flex items-center gap-2 rounded-lg border border-border bg-black/10 p-2"
                      key={drop.id}
                    >
                      <ItemArtwork
                        src={drop.item.sprite}
                        name={drop.item.name}
                        rarity={drop.item.rarity}
                        size={42}
                        itemId={drop.item.id}
                      />
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-xs">
                          {drop.item.name}
                        </strong>
                        <small className="text-[10px] text-muted-foreground">
                          {Math.round(drop.baseChance * 100)}% ·{" "}
                          {drop.minQuantity}–{drop.maxQuantity}
                        </small>
                      </div>
                      <RarityBadge rarity={drop.item.rarity} />
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-2 rounded-lg border border-dashed border-border p-2 opacity-60"
                      key={`locked-${creature.id}-${index}`}
                    >
                      <span className="grid h-[42px] w-[42px] place-items-center rounded-lg border border-dashed border-border">
                        <LockKeyhole className="h-4 w-4" />
                      </span>
                      <div>
                        <strong className="block text-xs">
                          Undiscovered material
                        </strong>
                        <small className="text-[10px] text-muted-foreground">
                          Hunting {drop.requiredHuntingLevel}
                        </small>
                      </div>
                    </div>
                  ),
                )}
              </div> */}
            </article>
          );
        })
      )}
    </div>
  );
}

function ExpeditionCard(props: {
  expedition: NonNullable<HuntingData["expedition"]>;
  now: number;
  claiming: boolean;
  onClaim: () => void;
}) {
  const { expedition, now } = props;
  const started = new Date(expedition.startedAt).getTime();
  const ends = new Date(expedition.endsAt).getTime();
  const total = Math.max(1, ends - started);
  const progress = Math.max(0, Math.min(1, (now - started) / total));
  const remaining = Math.max(0, Math.ceil((ends - now) / 1_000));

  if (expedition.status === "CLAIMED") {
    return (
      <section className="game-panel gathering-return space-y-5">
        <div className="gathering-return-heading">
          <span className="gathering-state-icon" data-state="claimed">
            <PackageOpen />
          </span>
          <div>
            <p className="game-eyebrow">Hunt journal</p>
            <h2 className="game-section-title">
              Returned from {expedition.ground.name}
            </h2>
            <p>{expedition.ground.location.name}</p>
          </div>
        </div>

        {expedition.report ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Encounters
              </span>
              <strong className="mt-1 block text-lg">
                {expedition.report.encounters.reduce(
                  (sum, row) => sum + row.count,
                  0,
                )}
              </strong>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Field mishaps
              </span>
              <strong className="mt-1 block text-lg">
                {expedition.report.accidents.injuries}
              </strong>
            </div>
            <div className="rounded-xl border border-border bg-secondary/20 p-3">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Health lost
              </span>
              <strong
                className={
                  expedition.report.totalDamage > 0
                    ? "mt-1 block text-lg text-danger"
                    : "mt-1 block text-lg text-success"
                }
              >
                {Math.round(expedition.report.totalDamage)}
              </strong>
            </div>
          </div>
        ) : null}

        {expedition.report?.encounters.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {expedition.report.encounters.map((encounter) => (
              <div
                className="flex items-center gap-3 rounded-xl border border-border p-2"
                key={encounter.creatureId}
              >
                <Image
                  src={encounter.asset}
                  alt=""
                  width={50}
                  height={50}
                  className="h-[50px] w-[50px] rounded-lg bg-black/15 object-contain"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <strong className="block truncate">
                    {encounter.name} ×{encounter.count}
                  </strong>
                  <span className="text-muted-foreground">
                    {encounter.attacks} attack
                    {encounter.attacks === 1 ? "" : "s"} · {encounter.evaded}{" "}
                    evaded · {encounter.blocked} blocked ·{" "}
                    {Math.round(encounter.damageTaken)} damage
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="gathering-haul-grid">
          {expedition.rewards.map((reward) => (
            <div className="gathering-haul-item" key={reward.itemId}>
              <ItemArtwork
                src={reward.sprite}
                name={reward.name}
                rarity={reward.rarity}
                size={60}
                itemId={reward.itemId}
              />
              <div className="min-w-0">
                <strong>{reward.name}</strong>
                <span>×{reward.quantity}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const ready = expedition.status === "READY" || remaining === 0;
  return (
    <section className="game-panel gathering-active-card" data-ready={ready}>
      <div className="gathering-active-top">
        <span
          className="gathering-state-icon"
          data-state={ready ? "ready" : "active"}
        >
          {ready ? <CircleCheck /> : <Footprints />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="game-eyebrow">
            {ready ? "Hunter returned" : "Currently tracking"}
          </p>
          <h2 className="game-section-title">{expedition.ground.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {expedition.ground.location.name}
          </p>
        </div>
        <span className="gathering-timer" aria-live="polite">
          {ready ? "Ready to claim" : formatRemaining(remaining)}
        </span>
      </div>
      <div className="gathering-route" aria-hidden="true">
        <span>
          <Crosshair />
        </span>
        <i>
          <b style={{ width: `${Math.max(2, Math.floor(progress * 100))}%` }} />
        </i>
        <span>
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
          <div>
            <strong>Your game and field journal are ready.</strong>
            <p>
              Damage, encounters, drops, and XP resolve together when claimed.
            </p>
          </div>
          <Button onClick={props.onClaim} disabled={props.claiming}>
            <PackageOpen className="mr-2 h-4 w-4" />
            {props.claiming ? "Processing…" : "Claim hunt"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export default function HuntingExpedition() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [selectedGroundId, setSelectedGroundId] = useState<number | null>(null);
  const [selectedDurationId, setSelectedDurationId] = useState<number | null>(
    null,
  );

  const huntingQuery = useQuery({
    queryKey: ["hunting"],
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

  useEffect(() => {
    if (data?.expedition?.status !== "ACTIVE") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [data?.expedition?.status]);

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

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGround?.unlocked || !selectedDuration?.unlocked) {
        throw new Error("Choose an available hunting ground and duration");
      }
      const response = await fetch("/api/hunting/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groundId: selectedGround.id,
          durationId: selectedDuration.id,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Failed to depart");
    },
    onSuccess: async () => {
      toast.success(
        `Hunting expedition sent to ${selectedGround?.name ?? "the wilds"}`,
      );
      dispatchActiveActionEvent({ kind: "changed" });
      await queryClient.invalidateQueries({ queryKey: ["hunting"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to depart"),
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/hunting/claim", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        rewards?: Reward[];
        report?: Report;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "Failed to claim hunt");
      return body;
    },
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
        queryClient.invalidateQueries({ queryKey: ["hunting"] }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
      ]);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to claim"),
  });

  if (huntingQuery.isLoading) {
    return (
      <div className="game-panel game-empty-state">
        Reading tracks and checking equipment…
      </div>
    );
  }
  if (huntingQuery.isError || !data) {
    return (
      <div className="game-panel game-empty-state">
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
    );
  }

  const blocksPlanning = Boolean(
    data.expedition && data.expedition.status !== "CLAIMED",
  );
  const healthReady =
    data.vitals.percent >= data.safety.minimumHealthToStartPercent;
  const hasUsableDrop = Boolean(
    selectedGround?.creatures.some((creature) =>
      creature.drops.some((drop) => drop.unlocked),
    ),
  );
  const dangerScale =
    (selectedDuration?.dangerMultiplier ?? 1) *
    data.safety.globalDangerMultiplier;
  const movementFactor = Math.max(
    0.5,
    Math.min(1.5, 1 - (data.modifiers.defenses.movementSpeed - 100) * 0.005),
  );
  const effectiveAccidentChance = selectedGround
    ? Math.max(
        0,
        Math.min(
          0.95,
          selectedGround.accidentChance * dangerScale * movementFactor,
        ),
      )
    : 0;

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
        <section className="game-panel gathering-planner">
          <div className="game-panel-header">
            <div>
              <p className="game-eyebrow">Current location</p>
              <h2 className="game-section-title">
                {data.location?.name ?? "No location"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/map">
                  <MapPin className="h-4 w-4" /> Atlas
                </Link>
              </Button>
              <span className="gathering-level-chip">
                <Crosshair /> Hunting {data.skillProgress.level}
              </span>
            </div>
          </div>
          <div className="game-panel-body space-y-6">
            {!data.location ? (
              <div className="game-empty-state">
                <MapPin className="mx-auto mb-3 h-6 w-6" />
                <strong>
                  Travel to a location before choosing hunting grounds.
                </strong>
                <div className="mt-4">
                  <Button asChild>
                    <Link href="/map">Open atlas</Link>
                  </Button>
                </div>
              </div>
            ) : data.location.grounds.length === 0 ? (
              <div className="game-empty-state">
                <PawPrint className="mx-auto mb-3 h-6 w-6" />
                <strong>No hunting grounds are open here.</strong>
              </div>
            ) : (
              <>
                <HealthCard data={data} />
                <div
                  className="gathering-modifiers"
                  aria-label="Hunting modifiers"
                >
                  <div>
                    <span>Luck</span>
                    <strong>
                      {data.modifiers.luck >= 0 ? "+" : ""}
                      {data.modifiers.luck}
                    </strong>
                  </div>
                  <div>
                    <span>Hunting efficiency</span>
                    <strong>+{data.modifiers.huntingEfficiency}%</strong>
                  </div>
                  <div>
                    <span>Armor / block</span>
                    <strong>
                      {Math.floor(data.modifiers.defenses.armor)} /{" "}
                      {data.modifiers.defenses.blockChance.toFixed(0)}%
                    </strong>
                  </div>
                  <div>
                    <span>Safety cap</span>
                    <strong>
                      {data.safety.damageEnabled
                        ? `${data.safety.maxHealthLossPercent}% max health`
                        : "Damage disabled"}
                    </strong>
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <h3 className="mt-1 font-display text-base font-semibold">
                      Choose your ground
                    </h3>
                  </div>
                  <div
                    className="gathering-location-grid"
                    role="radiogroup"
                    aria-label="Hunting ground"
                  >
                    {data.location.grounds.map((ground) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={ground.id === selectedGroundId}
                        className="gathering-location-choice"
                        data-selected={ground.id === selectedGroundId}
                        data-locked={!ground.unlocked}
                        disabled={!ground.unlocked}
                        key={ground.id}
                        onClick={() => setSelectedGroundId(ground.id)}
                      >
                        <span className="gathering-location-icon">
                          {ground.unlocked ? <PawPrint /> : <LockKeyhole />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong>{ground.name}</strong>
                          <small>
                            {ground.unlocked
                              ? `${ground.creatures.length} animal species`
                              : `Hunting ${ground.requiredHuntingLevel}`}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedGround ? (
                  <div className="gathering-location-detail">
                    <div className="gathering-location-copy">
                      <p className="game-eyebrow">Field notes</p>
                      <h3>{selectedGround.name}</h3>
                      <p>{selectedGround.description}</p>
                      <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />{" "}
                          {Math.round(effectiveAccidentChance * 100)}% estimated
                          mishap chance per encounter
                        </p>
                        <p className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" /> Armor,
                          matching evasion, and block resolve from departure
                          gear
                        </p>
                        <p className="flex items-center gap-2">
                          <PawPrint className="h-4 w-4 text-primary" /> One
                          weighted animal encounter per roll
                        </p>
                      </div>
                    </div>
                    <CreatureGuide
                      ground={selectedGround}
                      dangerScale={dangerScale}
                    />
                  </div>
                ) : null}

                <div className="gathering-duration-section">
                  <div>
                    <p className="game-eyebrow">Time away</p>
                    <h3>Expedition duration</h3>
                    <p>
                      Long hunts find more animals, but increase exposure to
                      attacks and field accidents.
                    </p>
                  </div>
                  <div
                    className="gathering-duration-grid"
                    role="radiogroup"
                    aria-label="Hunting duration"
                  >
                    {data.durations.map((duration) => {
                      return (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={duration.id === selectedDurationId}
                          className="gathering-duration-choice"
                          data-selected={duration.id === selectedDurationId}
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
                              : `Hunting ${duration.requiredHuntingLevel}`}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="gathering-departure-bar">
                  <div>
                    <Route />
                    <span>
                      <strong>
                        {selectedGround?.name ?? "Choose a ground"}
                      </strong>
                      <small>
                        {selectedDuration?.label ?? "No duration available"}
                      </small>
                    </span>
                  </div>
                  <Button
                    size="lg"
                    disabled={
                      !selectedGround?.unlocked ||
                      !selectedDuration?.unlocked ||
                      !hasUsableDrop ||
                      !healthReady ||
                      startMutation.isPending
                    }
                    onClick={() => startMutation.mutate()}
                  >
                    <Compass className="mr-2 h-4 w-4" />
                    {startMutation.isPending ? "Preparing…" : "Begin hunting"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
