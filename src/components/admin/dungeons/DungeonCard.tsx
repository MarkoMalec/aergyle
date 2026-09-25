"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import type { DungeonDifficulty } from "~/generated/prisma/enums";
import {
  CreatureArt,
  type AdminCreature,
} from "~/components/admin/creatures/CreatureEditor";
import {
  BalancePreview,
  type MonsterPopulation,
  type TestCharacter,
} from "~/components/admin/dungeons/BalancePreview";
import {
  adminRequest,
  EnabledField,
  Field,
  inputClass,
  NumberField,
} from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import { DUNGEON_DIFFICULTY_LABELS } from "~/game/creatures";
import { cn } from "~/lib/utils";
import {
  MAX_DUNGEON_PACK_SIZE,
  type DungeonDeathRules,
} from "~/server/dungeons/resolver";
import { formatLength } from "~/components/game/actions/format";

export type AdminDungeon = {
  id: number;
  locationId: number;
  locationName: string;
  name: string;
  description: string | null;
  difficulty: DungeonDifficulty;
  requiredLevel: number;
  durationSeconds: number;
  packSize: number;
  xpReward: number;
  enabled: boolean;
  sortOrder: number;
  activeRuns: number;
  monsters: MonsterPopulation[];
};

type LocationOption = { id: number; name: string };

const DIFFICULTIES = Object.keys(
  DUNGEON_DIFFICULTY_LABELS,
) as DungeonDifficulty[];

function toPayload({
  id: _id,
  locationName: _locationName,
  activeRuns: _activeRuns,
  ...dungeon
}: AdminDungeon) {
  return dungeon;
}

function Section(props: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl bg-white/[0.03] p-4">
      <div>
        <h4 className="text-sm font-semibold">
          <span className="mr-2 text-amber-300">{props.step}.</span>
          {props.title}
        </h4>
        <p className="mt-0.5 text-xs text-white/45">{props.description}</p>
      </div>
      {props.children}
    </section>
  );
}

function Chip(props: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] ${props.tone ?? "bg-white/[0.06] text-white/60"}`}
    >
      {props.children}
    </span>
  );
}

function PopulationEditor(props: {
  population: MonsterPopulation[];
  monsters: AdminCreature[];
  onChange: (population: MonsterPopulation[]) => void;
}) {
  const byId = new Map(props.monsters.map((monster) => [monster.id, monster]));
  const available = props.monsters.filter(
    (monster) => !props.population.some((row) => row.creatureId === monster.id),
  );
  const [adding, setAdding] = useState<number | "">("");
  const update = (creatureId: number, patch: Partial<MonsterPopulation>) =>
    props.onChange(
      props.population.map((row) =>
        row.creatureId === creatureId ? { ...row, ...patch } : row,
      ),
    );
  const add = () => {
    const creatureId = adding === "" ? available[0]?.id : adding;
    if (!creatureId) return;
    props.onChange([
      ...props.population,
      { creatureId, enabled: true, minCount: 1, maxCount: 3 },
    ]);
    setAdding("");
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium text-white/70">Monster population</p>
        <p className="text-[11px] leading-snug text-white/40">
          Every run rolls a count between Min and Max for each monster, then
          shuffles them all into one line. Players never see these counts.
        </p>
      </div>
      {props.population.length === 0 ? (
        <p className="rounded-lg bg-black/20 p-3 text-sm text-white/55">
          No monsters yet. A dungeon without monsters cannot be entered.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {props.population.map((row) => {
            const monster = byId.get(row.creatureId);
            const invalid = row.maxCount < row.minCount || row.maxCount < 1;
            return (
              <li
                className="flex flex-wrap items-center gap-3 rounded-lg bg-black/20 px-3 py-2"
                key={row.creatureId}
              >
                <CreatureArt src={monster?.asset ?? ""} size={36} />
                <span className="min-w-[8rem] flex-1">
                  <strong className="block text-sm">
                    {monster?.name ?? "Deleted monster"}
                  </strong>
                  {monster && !monster.enabled ? (
                    <span className="text-[11px] text-amber-300">
                      Disabled in the catalogue; it will not appear
                    </span>
                  ) : monster ? (
                    <span className="text-[11px] text-white/40">
                      {monster.health} HP · {monster.damageMin}–
                      {monster.damageMax} physical
                    </span>
                  ) : null}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-white/55">
                  Min
                  <input
                    className={cn(inputClass, "w-16 py-1")}
                    type="number"
                    min={0}
                    value={row.minCount}
                    onChange={(event) =>
                      update(row.creatureId, {
                        minCount: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-white/55">
                  Max
                  <input
                    className={cn(
                      inputClass,
                      "w-16 py-1",
                      invalid && "border-red-400/70",
                    )}
                    type="number"
                    min={1}
                    value={row.maxCount}
                    onChange={(event) =>
                      update(row.creatureId, {
                        maxCount: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-white/55">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) =>
                      update(row.creatureId, { enabled: event.target.checked })
                    }
                  />
                  Active
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${monster?.name ?? "monster"}`}
                  onClick={() =>
                    props.onChange(
                      props.population.filter(
                        (other) => other.creatureId !== row.creatureId,
                      ),
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {props.monsters.length === 0 ? (
        <p className="text-xs text-white/45">
          Create a monster in the catalogue at the bottom of this page first.
        </p>
      ) : available.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Monster to add"
            className={cn(inputClass, "w-auto min-w-[12rem]")}
            value={adding}
            onChange={(event) =>
              setAdding(event.target.value ? Number(event.target.value) : "")
            }
          >
            <option value="">Choose a monster…</option>
            {available.map((monster) => (
              <option key={monster.id} value={monster.id}>
                {monster.name}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add monster
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DungeonCard(props: {
  dungeon: AdminDungeon;
  monsters: AdminCreature[];
  monstersById: Map<number, AdminCreature>;
  locations: LocationOption[];
  character: TestCharacter;
  rules: DungeonDeathRules;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(props.dungeon);
  const [draft, setDraft] = useState(props.dungeon);
  const [open, setOpen] = useState(Boolean(props.defaultOpen));
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<AdminDungeon>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      await adminRequest(
        `/api/admin/dungeons/${draft.id}`,
        "PATCH",
        toPayload(draft),
      );
      setSaved(draft);
      toast.success(`${draft.name} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !window.confirm(
        `Delete ${saved.name}? Its monster population and past run journals are removed. The monsters stay in the catalogue.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await adminRequest(`/api/admin/dungeons/${draft.id}`, "DELETE");
      toast.success(`${saved.name} deleted`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
      setBusy(false);
    }
  };

  const activeTypes = draft.monsters.filter((row) => row.enabled).length;

  return (
    <details
      className="rounded-xl bg-black/20"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 p-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <strong className="block truncate">
            {draft.name}
            <span className="font-normal text-white/45">
              {" "}
              · {draft.locationName}
            </span>
          </strong>
          <span className="mt-1 flex flex-wrap gap-1.5">
            <Chip>{DUNGEON_DIFFICULTY_LABELS[draft.difficulty]}</Chip>
            <Chip>Level {draft.requiredLevel}</Chip>
            <Chip>{formatLength(draft.durationSeconds)}</Chip>
            <Chip>{draft.xpReward} XP</Chip>
            <Chip>
              {activeTypes} monster type{activeTypes === 1 ? "" : "s"}
            </Chip>
            <Chip>
              {draft.packSize === 1
                ? "One at a time"
                : `Packs of ${draft.packSize}`}
            </Chip>
            {draft.activeRuns > 0 ? (
              <Chip tone="bg-sky-400/10 text-sky-300">
                {draft.activeRuns} inside now
              </Chip>
            ) : null}
          </span>
        </span>
        {dirty ? (
          <Chip tone="bg-amber-400/15 text-amber-300">Unsaved changes</Chip>
        ) : null}
        <Chip
          tone={
            draft.enabled
              ? "bg-emerald-400/10 text-emerald-300"
              : "bg-white/[0.06] text-white/40"
          }
        >
          {draft.enabled ? "Enabled" : "Disabled"}
        </Chip>
      </summary>

      {open ? (
        <div className="space-y-4 px-4 pb-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
            <div className="space-y-4">
              <Section
                step={1}
                title="Basics"
                description="What players see when they pick a dungeon."
              >
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Name">
                    <input
                      className={inputClass}
                      value={draft.name}
                      onChange={(event) => set({ name: event.target.value })}
                    />
                  </Field>
                  <Field
                    label="World location"
                    hint="Players must be here to enter."
                  >
                    <select
                      className={inputClass}
                      value={draft.locationId}
                      onChange={(event) => {
                        const locationId = Number(event.target.value);
                        set({
                          locationId,
                          locationName:
                            props.locations.find(
                              (location) => location.id === locationId,
                            )?.name ?? draft.locationName,
                        });
                      }}
                    >
                      {props.locations.map((location) => (
                        <option value={location.id} key={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Difficulty label"
                    hint="Display only. Real danger comes from the monsters."
                  >
                    <select
                      className={inputClass}
                      value={draft.difficulty}
                      onChange={(event) =>
                        set({
                          difficulty: event.target.value as DungeonDifficulty,
                        })
                      }
                    >
                      {DIFFICULTIES.map((difficulty) => (
                        <option key={difficulty} value={difficulty}>
                          {DUNGEON_DIFFICULTY_LABELS[difficulty]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <EnabledField
                    value={draft.enabled}
                    onChange={(enabled) => set({ enabled })}
                    hint="Disabled dungeons are hidden from players."
                  />
                  <Field
                    label="Description"
                    className="md:col-span-2 lg:col-span-4"
                  >
                    <textarea
                      className={inputClass}
                      rows={2}
                      value={draft.description ?? ""}
                      onChange={(event) =>
                        set({ description: event.target.value || null })
                      }
                    />
                  </Field>
                </div>
              </Section>

              <Section
                step={2}
                title="Entry and reward"
                description="Who can enter, how long a run takes, and what clearing it is worth."
              >
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <NumberField
                    label="Required level"
                    hint="Minimum character level."
                    value={draft.requiredLevel}
                    min={1}
                    onChange={(requiredLevel) => set({ requiredLevel })}
                  />
                  <NumberField
                    label="Duration"
                    suffix="min"
                    hint={`${formatLength(draft.durationSeconds)}. The fight is resolved when it ends.`}
                    value={Math.round(draft.durationSeconds / 60)}
                    min={1}
                    onChange={(minutes) =>
                      set({ durationSeconds: Math.max(1, minutes) * 60 })
                    }
                  />
                  <NumberField
                    label="XP on clear"
                    suffix="XP"
                    hint="Only when cleared. Items come from monster drops."
                    value={draft.xpReward}
                    min={0}
                    onChange={(xpReward) => set({ xpReward })}
                  />
                  <NumberField
                    label="Sort order"
                    hint="Lower numbers are listed first."
                    value={draft.sortOrder}
                    onChange={(sortOrder) => set({ sortOrder })}
                  />
                </div>
              </Section>

              <Section
                step={3}
                title="Monsters"
                description="Who lives here and how they fight. This is where the danger comes from."
              >
                <NumberField
                  className="max-w-md"
                  label="Pack size"
                  suffix="at once"
                  value={draft.packSize}
                  min={1}
                  max={MAX_DUNGEON_PACK_SIZE}
                  onChange={(packSize) =>
                    set({
                      packSize: Math.min(
                        MAX_DUNGEON_PACK_SIZE,
                        Math.max(1, Math.floor(packSize) || 1),
                      ),
                    })
                  }
                  hint={
                    <>
                      How many monsters fight the player together (1–
                      {MAX_DUNGEON_PACK_SIZE}). Every monster always strikes at
                      least once. With bigger packs, monsters waiting their turn
                      keep attacking, so danger grows fast for players who kill
                      slowly.{" "}
                      <strong className="text-white/60">
                        {draft.packSize === 1
                          ? "Now: one monster at a time."
                          : `Now: up to ${draft.packSize} monsters attack each round.`}
                      </strong>
                    </>
                  }
                />
                <PopulationEditor
                  population={draft.monsters}
                  monsters={props.monsters}
                  onChange={(monsters) => set({ monsters })}
                />
              </Section>
            </div>

            <aside className="xl:sticky xl:top-4 xl:self-start">
              <BalancePreview
                population={draft.monsters}
                packSize={draft.packSize}
                monsters={props.monstersById}
                character={props.character}
                rules={props.rules}
              />
            </aside>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-white/40">
              {draft.activeRuns > 0
                ? "Characters inside keep the version they entered."
                : "Saved changes apply to the next run."}
            </span>
            <Button
              variant="destructive"
              onClick={() => void remove()}
              disabled={busy}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDraft(saved)}
              disabled={busy || !dirty}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Revert
            </Button>
            <Button onClick={() => void save()} disabled={busy || !dirty}>
              <Save className="mr-2 h-4 w-4" />
              {busy ? "Saving…" : "Save dungeon"}
            </Button>
          </div>
        </div>
      ) : null}
    </details>
  );
}
