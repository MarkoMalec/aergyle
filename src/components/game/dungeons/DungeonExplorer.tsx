"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Castle,
  CircleCheck,
  Clock3,
  DoorOpen,
  HeartPulse,
  LockKeyhole,
  MapPin,
  PackageOpen,
  Skull,
  Swords,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
  CreatureAttackStyle,
  CreatureDamageType,
  DungeonDifficulty,
  ItemRarity,
} from "~/generated/prisma/enums";
import {
  ATTACK_STYLE_LABELS,
  bestiaryHref,
  DAMAGE_TYPE_LABELS,
  DUNGEON_DIFFICULTY_LABELS,
} from "~/game/creatures";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { Button } from "~/components/ui/button";
import { dungeonQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import {
  formatLength,
  formatRemaining,
  formatTime,
} from "~/components/game/actions/format";
import { HealthCard } from "~/components/game/character/HealthCard";
import { RewardHaul } from "~/components/game/items/RewardHaul";

type Reward = {
  itemId: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
  quantity: number;
};

type CreatureRef = { creatureId: number; name: string; asset: string };

type Report = {
  outcome: "CLEARED" | "DEFEATED";
  encounters: Array<CreatureRef & { damageTaken: number }>;
  defeatedBy: CreatureRef | null;
  damageTaken: number;
  evaded: number;
  blocked: number;
  criticalHits: number;
  xp?: number;
  health?: { before: number; after: number; max: number };
};

type Dungeon = {
  id: number;
  name: string;
  description: string | null;
  difficulty: DungeonDifficulty;
  requiredLevel: number;
  unlocked: boolean;
  durationSeconds: number;
  packSize: number;
  xpReward: number;
  recommendedHealth: number | null;
  monsters: Array<{
    id: number;
    name: string;
    asset: string;
    attackStyle: CreatureAttackStyle;
    damageType: CreatureDamageType | null;
  }>;
};

type Run = {
  id: number;
  status: "ACTIVE" | "READY" | "CLAIMED";
  startedAt: string;
  endsAt: string;
  claimedAt: string | null;
  durationSeconds: number;
  dungeon: {
    id: number;
    name: string;
    difficulty: DungeonDifficulty;
    location: { id: number; name: string };
  };
  rewards: Reward[];
  report: Report | null;
};

type DungeonData = {
  level: number;
  vitals: {
    currentHealth: number;
    maxHealth: number;
    healthRegen: number;
    percent: number;
  };
  combat: {
    physicalDamageMin: number;
    physicalDamageMax: number;
    magicDamageMin: number;
    magicDamageMax: number;
    criticalChance: number;
    attackSpeed: number;
    armor: number;
    magicResist: number;
    evasionMelee: number;
    blockChance: number;
  };
  minimumHealthToStartPercent: number;
  location: null | {
    id: number;
    name: string;
    unlocked: boolean;
    dungeons: Dungeon[];
  };
  run: Run | null;
};

const DIFFICULTY_TONE: Record<DungeonDifficulty, string> = {
  EASY: "border-success/30 bg-success/10 text-success",
  NORMAL: "border-info/30 bg-info/10 text-info",
  HARD: "border-warning/30 bg-warning/10 text-warning",
  DEADLY: "border-danger/30 bg-danger/10 text-danger",
};

function formatRange(minimum: number, maximum: number) {
  const round = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${round(minimum)}–${round(maximum)}`;
}

function listRewards(rewards: Reward[]) {
  return rewards
    .map((reward) => `${reward.name} ×${reward.quantity}`)
    .join(", ");
}

function DifficultyBadge({ difficulty }: { difficulty: DungeonDifficulty }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${DIFFICULTY_TONE[difficulty]}`}
    >
      {DUNGEON_DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

function RecommendedHealth(props: {
  recommended: number | null;
  currentHealth: number;
  maxHealth: number;
}) {
  if (props.recommended === null) {
    return (
      <span className="text-danger">
        Beyond your current gear. You are unlikely to survive.
      </span>
    );
  }
  const note =
    props.recommended > props.maxHealth
      ? { text: "above your maximum health", tone: "text-danger" }
      : props.recommended > props.currentHealth
        ? { text: "more than you have right now", tone: "text-warning" }
        : { text: "you meet it", tone: "text-success" };
  return (
    <span>
      <strong className={`tabular-nums ${note.tone}`}>{props.recommended}</strong>{" "}
    </span>
  );
}

function MonsterList({ dungeon }: { dungeon: Dungeon }) {
  return (
    <div className="space-y-3">
      <div className="gathering-find-heading">
        <h3>Known inhabitants</h3>
        <span>{dungeon.monsters.length} kinds sighted</span>
      </div>
      {dungeon.monsters.length === 0 ? (
        <div className="game-empty-state">Nothing stirs here right now.</div>
      ) : (
        dungeon.monsters.map((monster) => (
          <article
            className="flex items-center gap-3 rounded-xl bg-secondary/20 p-3"
            key={monster.id}
          >
            <Image
              src={monster.asset}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-xl bg-black/10 object-contain p-1"
            />
            <div className="min-w-0 flex-1">
              <Link href={bestiaryHref("MONSTER", monster.id)} className="block text-sm hover:underline">{monster.name}</Link>
              <p className="mt-1 text-xs text-muted-foreground">
                {ATTACK_STYLE_LABELS[monster.attackStyle]} attacks
                {monster.damageType
                  ? ` · ${DAMAGE_TYPE_LABELS[monster.damageType]} damage`
                  : ""}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={bestiaryHref("MONSTER", monster.id)}>Bestiary</Link>
            </Button>
          </article>
        ))
      )}
    </div>
  );
}

function RunJournal({ run }: { run: Run }) {
  const report = run.report;
  const defeated = report?.outcome === "DEFEATED";
  return (
    <section className="game-panel gathering-return space-y-5">
      <div className="gathering-return-heading">
        <span
          className="gathering-state-icon"
          data-state={defeated ? undefined : "claimed"}
        >
          {defeated ? <Skull /> : <PackageOpen />}
        </span>
        <div>
          <p className="game-eyebrow">Dungeon journal</p>
          <h2 className="game-section-title">
            {defeated ? "Defeated in" : "Cleared"} {run.dungeon.name}
          </h2>
          <p>{run.dungeon.location.name}</p>
        </div>
      </div>

      {defeated ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm">
          <p className="font-semibold text-danger">
            {report?.defeatedBy
              ? `${report.defeatedBy.name} overwhelmed you.`
              : "The dungeon overwhelmed you."}
          </p>
          <p className="mt-1 text-text-secondary">
            {run.rewards.length > 0
              ? `You managed to crawl out with ${listRewards(run.rewards)}.`
              : "You crawled out empty-handed."}{" "}
            Recover your health before your next fight.
          </p>
        </div>
      ) : null}

      {report ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Health lost",
              value: Math.round(report.damageTaken),
              tone: report.damageTaken > 0 ? "text-danger" : "text-success",
            },
            {
              label: "Health now",
              value: report.health
                ? `${Math.floor(report.health.after)} / ${Math.floor(report.health.max)}`
                : "—",
              tone: defeated ? "text-danger" : "",
            },
            {
              label: "Blows avoided",
              value: `${report.evaded} evaded · ${report.blocked} blocked`,
              tone: "",
            },
            {
              label: "Experience",
              value: defeated ? "None" : `+${report.xp ?? 0} XP`,
              tone: defeated ? "" : "text-xp",
            },
          ].map((stat) => (
            <div
              className="rounded-xl border border-border bg-secondary/20 p-3"
              key={stat.label}
            >
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </span>
              <strong className={`mt-1 block text-lg ${stat.tone}`}>
                {stat.value}
              </strong>
            </div>
          ))}
        </div>
      ) : null}

      {report?.encounters.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {report.encounters.map((encounter) => (
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
                <strong className="block truncate">{encounter.name}</strong>
                <span className="text-muted-foreground">
                  {Math.round(encounter.damageTaken)} damage taken
                  {report.defeatedBy?.creatureId === encounter.creatureId
                    ? " · struck the final blow"
                    : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!defeated && run.rewards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The monsters carried nothing worth keeping this time.
        </p>
      ) : null}
      {!defeated && run.rewards.length > 0 ? (
        <RewardHaul rewards={run.rewards} />
      ) : null}
    </section>
  );
}

function ActiveRunCard(props: {
  run: Run;
  now: number;
  claiming: boolean;
  leaving: boolean;
  onClaim: () => void;
  onLeave: () => void;
}) {
  const { run, now } = props;
  const started = new Date(run.startedAt).getTime();
  const ends = new Date(run.endsAt).getTime();
  const progress = Math.max(
    0,
    Math.min(1, (now - started) / Math.max(1, ends - started)),
  );
  const remaining = Math.max(0, Math.ceil((ends - now) / 1_000));
  const ready = run.status === "READY" || remaining === 0;

  return (
    <section className="game-panel gathering-active-card" data-ready={ready}>
      <div className="gathering-active-top">
        <span
          className="gathering-state-icon"
          data-state={ready ? "ready" : "active"}
        >
          {ready ? <CircleCheck /> : <Swords />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="game-eyebrow">
            {ready ? "The fighting is over" : "Inside the dungeon"}
          </p>
          <h2 className="game-section-title">{run.dungeon.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {run.dungeon.location.name}
          </p>
        </div>
        <span className="gathering-timer" aria-live="polite">
          {ready ? "Ready" : formatRemaining(remaining)}
        </span>
      </div>
      <div className="gathering-route" aria-hidden="true">
        <span>
          <DoorOpen />
        </span>
        <i>
          <b style={{ width: `${Math.max(2, Math.floor(progress * 100))}%` }} />
        </i>
        <span>
          <Castle />
        </span>
      </div>
      <div className="gathering-route-labels">
        <span>Entered {formatTime(run.startedAt)}</span>
        <span>{ready ? "Finished" : `Ends ${formatTime(run.endsAt)}`}</span>
      </div>
      {ready ? (
        <div className="gathering-claim-callout">
          <div>
            <strong>Your fate has been decided.</strong>
            <p>Loot, damage, and experience are revealed together.</p>
          </div>
          <Button onClick={props.onClaim} disabled={props.claiming}>
            <PackageOpen className="mr-2 h-4 w-4" />
            {props.claiming ? "Opening…" : "See what happened"}
          </Button>
        </div>
      ) : (
        <div className="gathering-claim-callout">
          <div>
            <strong>Leaving early is safe but empty-handed.</strong>
            <p>You lose no health, and you keep nothing.</p>
          </div>
          <Button
            variant="outline"
            onClick={props.onLeave}
            disabled={props.leaving}
          >
            <DoorOpen className="mr-2 h-4 w-4" />
            {props.leaving ? "Leaving…" : "Leave dungeon"}
          </Button>
        </div>
      )}
    </section>
  );
}

export default function DungeonExplorer({
  initialDungeonId = null,
}: {
  initialDungeonId?: number | null;
}) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState(initialDungeonId);

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

  if (dungeonQuery.isLoading) {
    return (
      <div className="game-panel game-empty-state">
        Lighting torches and checking your gear…
      </div>
    );
  }
  if (dungeonQuery.isError || !data) {
    return (
      <div className="game-panel game-empty-state">
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
  const healthReady =
    currentHealth > 0 && healthPercent >= data.minimumHealthToStartPercent;
  const run = data.run;
  const blocksPlanning = Boolean(run && run.status !== "CLAIMED");
  const { combat } = data;

  return (
    <div className="game-gathering space-y-5">
      {run?.status === "CLAIMED" ? <RunJournal run={run} /> : null}
      {run && run.status !== "CLAIMED" ? (
        <ActiveRunCard
          run={run}
          now={now}
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
                <Swords /> Level {data.level}
              </span>
            </div>
          </div>
          <div className="game-panel-body space-y-6">
            {!data.location ? (
              <div className="game-empty-state">
                <MapPin className="mx-auto mb-3 h-6 w-6" />
                <strong>Travel to a location to find its dungeons.</strong>
                <div className="mt-4">
                  <Button asChild>
                    <Link href="/map">Open atlas</Link>
                  </Button>
                </div>
              </div>
            ) : data.location.dungeons.length === 0 ? (
              <div className="game-empty-state">
                <Castle className="mx-auto mb-3 h-6 w-6" />
                <strong>No dungeons are open here.</strong>
              </div>
            ) : (
              <>
                <HealthCard
                  currentHealth={currentHealth}
                  maxHealth={data.vitals.maxHealth}
                  healthRegen={data.vitals.healthRegen}
                  ready={
                    currentHealth > 0 &&
                    (data.vitals.maxHealth > 0
                      ? (currentHealth / data.vitals.maxHealth) * 100
                      : 0) >= data.minimumHealthToStartPercent
                  }
                  readyLabel="Fit to enter"
                  recoverLabel={`Recover to ${data.minimumHealthToStartPercent}% before entering`}
                />
                <div
                  className="gathering-modifiers"
                  aria-label="Your combat stats"
                >
                  <div>
                    <span>Damage</span>
                    <strong>
                      {formatRange(
                        combat.physicalDamageMin + combat.magicDamageMin,
                        combat.physicalDamageMax + combat.magicDamageMax,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Armor / magic resist</span>
                    <strong>
                      {Math.floor(combat.armor)} /{" "}
                      {Math.floor(combat.magicResist)}
                    </strong>
                  </div>
                  <div>
                    <span>Evasion / block</span>
                    <strong>
                      {combat.evasionMelee.toFixed(0)}% /{" "}
                      {combat.blockChance.toFixed(0)}%
                    </strong>
                  </div>
                  <div>
                    <span>Critical chance</span>
                    <strong>{combat.criticalChance.toFixed(0)}%</strong>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 font-display text-base font-semibold">
                    Choose a dungeon
                  </h3>
                  <div
                    className="gathering-location-grid"
                    role="radiogroup"
                    aria-label="Dungeon"
                  >
                    {data.location.dungeons.map((dungeon) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={dungeon.id === selectedId}
                        className="gathering-location-choice"
                        data-selected={dungeon.id === selectedId}
                        data-locked={!dungeon.unlocked}
                        disabled={!dungeon.unlocked}
                        key={dungeon.id}
                        onClick={() => setSelectedId(dungeon.id)}
                      >
                        <span className="gathering-location-icon">
                          {dungeon.unlocked ? <Castle /> : <LockKeyhole />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong>{dungeon.name}</strong>
                          <small>
                            {dungeon.unlocked
                              ? `${DUNGEON_DIFFICULTY_LABELS[dungeon.difficulty]} · ${formatLength(dungeon.durationSeconds)}`
                              : `Level ${dungeon.requiredLevel}`}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {selected ? (
                  <div className="gathering-location-detail">
                    <div className="gathering-location-copy">
                      <p className="game-eyebrow">Dungeon notes</p>
                      <h3 className="flex flex-wrap items-center gap-2">
                        {selected.name}
                        <DifficultyBadge difficulty={selected.difficulty} />
                      </h3>
                      {selected.description ? (
                        <p>{selected.description}</p>
                      ) : null}
                      <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <dt className="flex items-center gap-2 text-muted-foreground">
                            <Clock3 className="h-4 w-4" aria-hidden="true" />
                            Duration
                          </dt>
                          <dd className="font-semibold">
                            {formatLength(selected.durationSeconds)}
                          </dd>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <dt className="flex items-center gap-2 text-muted-foreground">
                            <HeartPulse
                              className="h-4 w-4 text-danger"
                              aria-hidden="true"
                            />
                            Recommended health
                          </dt>
                          <dd className="text-right">
                            <RecommendedHealth
                              recommended={selected.recommendedHealth}
                              currentHealth={currentHealth}
                              maxHealth={data.vitals.maxHealth}
                            />
                          </dd>
                        </div>
                        <div className="flex flex-wrap justify-between gap-2">
                          <dt className="flex items-center gap-2 text-muted-foreground">
                            <CircleCheck
                              className="h-4 w-4 text-success"
                              aria-hidden="true"
                            />
                            Experience on clear
                          </dt>
                          <dd className="font-semibold text-xp">
                            +{selected.xpReward} XP
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                          aria-hidden="true"
                        />
                        You fight with your current health and gear.
                      </p>
                    </div>
                    <MonsterList dungeon={selected} />
                  </div>
                ) : null}

                <div className="gathering-departure-bar">
                  <div>
                    <Castle />
                    <span>
                      <strong>{selected?.name ?? "Choose a dungeon"}</strong>
                      <small>
                        {selected
                          ? formatLength(selected.durationSeconds)
                          : "No dungeon available"}
                      </small>
                    </span>
                  </div>
                  <Button
                    size="lg"
                    disabled={
                      !selected?.unlocked ||
                      selected.monsters.length === 0 ||
                      !healthReady ||
                      enterMutation.isPending
                    }
                    onClick={() => enterMutation.mutate()}
                  >
                    <Swords className="mr-2 h-4 w-4" />
                    {enterMutation.isPending ? "Descending…" : "Enter dungeon"}
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
