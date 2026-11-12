"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  adminRequest,
  EnabledField,
  Field,
  inputClass,
  NumberField,
  NumberInput,
  Panel,
} from "~/components/admin/fields";
import { useLeaveGuard } from "~/components/admin/leaveGuard";
import { SearchSelect, type SearchOption } from "~/components/admin/SearchSelect";
import { AssetPreview } from "~/components/admin/settlements/SettlementForm";
import { Button } from "~/components/ui/button";
import {
  describeProject,
  fromLocalInput,
  PROJECT_EFFECTS,
  REPEAT_LABELS,
  splitHours,
  toHours,
  toLocalInput,
  type DurationUnit,
  type ProjectEffectType,
  type ProjectRepeat,
} from "~/game/projects";
import { cn } from "~/lib/utils";
import type { ProjectEditorData } from "~/server/admin/projects";

type Draft = ProjectEditorData["project"];
type Stage = Draft["stages"][number];
type ItemRow = { itemId: number; quantity: number };

const PHASE_LABELS = {
  upcoming: ["Not started yet", "text-sky-300 bg-sky-400/10"],
  open: ["Open", "text-amber-300 bg-amber-400/10"],
  waiting: ["Round finished, waiting", "text-emerald-300 bg-emerald-400/10"],
  done: ["Finished", "text-emerald-300 bg-emerald-400/10"],
  ended: ["Ended unfinished", "text-white/50 bg-white/5"],
} as const;

/** Radio cards: a few big, explained choices instead of a dropdown. */
function Choice<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; hint: string }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {props.options.map((option) => {
        const active = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => props.onChange(option.value)}
            className={cn(
              "rounded-lg p-3 text-left transition-colors",
              active
                ? "bg-amber-400/15 ring-1 ring-amber-400/60"
                : "bg-white/[0.03] hover:bg-white/[0.07]",
            )}
          >
            <span className={cn("block text-sm font-semibold", active && "text-amber-200")}>
              {option.label}
            </span>
            <span className="mt-0.5 block text-xs text-white/50">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function DurationField(props: {
  label: string;
  hint?: string;
  hours: number;
  onChange: (hours: number) => void;
}) {
  const [unit, setUnit] = useState<DurationUnit>(() => splitHours(props.hours).unit);
  const value = props.hours / { weeks: 168, days: 24, hours: 1 }[unit];
  return (
    <Field label={props.label} hint={props.hint}>
      <span className="flex gap-2">
        <NumberInput
          className={inputClass}
          min={1}
          value={Number(value.toFixed(2))}
          onValueChange={(next) => {
            if (next !== null && next > 0) props.onChange(toHours(next, unit));
          }}
        />
        <select
          className={cn(inputClass, "w-28")}
          value={unit}
          onChange={(event) => setUnit(event.target.value as DurationUnit)}
        >
          <option value="hours">hours</option>
          <option value="days">days</option>
          <option value="weeks">weeks</option>
        </select>
      </span>
    </Field>
  );
}

/** A number that may be left empty for "no limit". */
function OptionalNumber(props: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  suffix?: string;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      <span className="relative block">
        <NumberInput
          className={cn(inputClass, props.suffix && "pr-10")}
          placeholder="No limit"
          min={props.min}
          max={props.max}
          value={props.value}
          onValueChange={(value) =>
            props.onChange(
              value === null || value < props.min
                ? null
                : Math.min(props.max, Math.floor(value)),
            )
          }
        />
        {props.suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-white/40">
            {props.suffix}
          </span>
        ) : null}
      </span>
    </Field>
  );
}

/** Item + quantity rows, used for what a stage needs and what it pays. */
function ItemRows(props: {
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  items: SearchOption[];
  addLabel: string;
  empty: string;
  /** Supplied so far per item, to show progress. */
  progress?: Record<number, number>;
  defaultQuantity: number;
}) {
  const update = (index: number, patch: Partial<ItemRow>) =>
    props.onChange(props.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="space-y-1.5">
      {props.rows.length === 0 ? <p className="text-xs text-white/40">{props.empty}</p> : null}
      {props.rows.map((row, index) => {
        const given = props.progress?.[row.itemId];
        return (
          <div
            key={`${row.itemId}-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_88px_auto] items-center gap-2 rounded-lg bg-black/20 p-1.5"
          >
            <SearchSelect
              options={props.items}
              value={row.itemId}
              onChange={(itemId) => {
                if (!itemId) return;
                if (props.rows.some((other, i) => i !== index && other.itemId === itemId)) {
                  return toast.error("That item is already in this list");
                }
                update(index, { itemId });
              }}
            />
            <NumberInput
              className={inputClass}
              aria-label="Quantity"
              min={1}
              value={row.quantity}
              onValueChange={(quantity) => {
                if (quantity !== null) update(index, { quantity: Math.max(1, Math.floor(quantity)) });
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Remove"
              onClick={() => props.onChange(props.rows.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {given !== undefined ? (
              <div className="col-span-3">
                <div className="h-1 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-emerald-400/70"
                    style={{ width: `${Math.min(100, (given / row.quantity) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-white/40">
                  {Math.min(given, row.quantity).toLocaleString()} / {row.quantity.toLocaleString()} handed in this round
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          const used = new Set(props.rows.map((row) => row.itemId));
          const item = props.items.find((option) => !used.has(option.id));
          if (!item) return toast.error("Every item is already in this list");
          props.onChange([...props.rows, { itemId: item.id, quantity: props.defaultQuantity }]);
        }}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        {props.addLabel}
      </Button>
    </div>
  );
}

function SubHeading(props: { title: string; hint: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-white/60">{props.title}</h4>
      <p className="text-xs text-white/40">{props.hint}</p>
    </div>
  );
}

function StageCard(props: {
  stage: Stage;
  index: number;
  count: number;
  facts: ProjectEditorData["stageFacts"][number] | undefined;
  items: SearchOption[];
  npcs: SearchOption[];
  onRevealNpc: (npcId: number, stageId: number | null) => void;
  onChange: (patch: Partial<Stage>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { stage, facts } = props;
  const multi = props.count > 1;
  const unusedEffects = (Object.keys(PROJECT_EFFECTS) as ProjectEffectType[]).filter(
    (type) => !stage.effects.some((effect) => effect.type === type),
  );

  return (
    <section className="space-y-4 rounded-xl bg-black/20 p-4">
      {multi ? (
        <div className="flex flex-wrap items-end gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400/15 text-sm font-bold text-amber-200">
            {props.index + 1}
          </span>
          <Field label="Stage name" className="min-w-[200px] flex-1">
            <input
              className={inputClass}
              value={stage.name}
              maxLength={120}
              placeholder="e.g. Lay the foundations"
              onChange={(event) => props.onChange({ name: event.target.value })}
            />
          </Field>
          {facts?.reached ? (
            <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300">Reached</span>
          ) : null}
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Move up" disabled={props.index === 0} onClick={() => props.onMove(-1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Move down" disabled={props.index === props.count - 1} onClick={() => props.onMove(1)}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Remove stage" onClick={props.onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {multi ? (
        <details className="group">
          <summary className="cursor-pointer text-xs text-white/50 hover:text-white">
            Stage text and picture (optional)
          </summary>
          <div className="mt-2 grid gap-3 md:grid-cols-[1fr_260px]">
            <Field label="What players read about this stage">
              <textarea
                className={inputClass}
                rows={2}
                maxLength={4_000}
                value={stage.description ?? ""}
                onChange={(event) => props.onChange({ description: event.target.value || null })}
              />
            </Field>
            <Field label="Picture path" hint="Shown while this stage is being built.">
              <input
                className={inputClass}
                value={stage.image ?? ""}
                maxLength={191}
                onChange={(event) => props.onChange({ image: event.target.value.trim() || null })}
              />
            </Field>
          </div>
        </details>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <SubHeading
            title="1 · Players hand in"
            hint="Any rarity counts. Reached when every item is fully supplied."
          />
          <ItemRows
            rows={stage.requirements}
            onChange={(requirements) => props.onChange({ requirements })}
            items={props.items}
            addLabel="Add item"
            empty="Nothing yet. A stage without items is never reached."
            progress={facts?.contributed}
            defaultQuantity={100}
          />
        </div>

        <div className="space-y-2">
          <SubHeading title="2 · Helpers get" hint="Paid to everyone who helped with this stage." />
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Gold"
              min={0}
              step={0.01}
              value={stage.rewardGold}
              onChange={(rewardGold) => props.onChange({ rewardGold: Math.max(0, rewardGold) })}
            />
            <NumberField
              label="Character XP"
              min={0}
              value={stage.rewardXp}
              onChange={(rewardXp) => props.onChange({ rewardXp: Math.max(0, Math.floor(rewardXp)) })}
            />
          </div>
          <ItemRows
            rows={stage.rewardItems}
            onChange={(rewardItems) => props.onChange({ rewardItems })}
            items={props.items}
            addLabel="Add reward item"
            empty="No reward items."
            defaultQuantity={1}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <SubHeading title="3 · Reaching it changes" hint="Bonuses in this settlement while the stage counts." />
          {stage.effects.map((effect, i) => {
            const info = PROJECT_EFFECTS[effect.type];
            return (
              <div key={effect.type} className="flex max-w-md items-end gap-2 rounded-lg bg-black/20 p-1.5">
                <Field label={info.label} className="flex-1">
                  <span className="relative block">
                    <NumberInput
                      className={cn(inputClass, "pr-16")}
                      min={0}
                      max={info.max}
                      value={effect.value}
                      onValueChange={(value) =>
                        props.onChange({
                          effects: stage.effects.map((row, j) =>
                            j === i ? { ...row, value: Math.min(info.max, Math.max(0, value ?? 0)) } : row,
                          ),
                        })
                      }
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-white/40">
                      {info.suffix}
                    </span>
                  </span>
                </Field>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${info.label}`}
                  onClick={() => props.onChange({ effects: stage.effects.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {unusedEffects.length > 0 ? (
            <select
              className={cn(inputClass, "max-w-md")}
              value=""
              aria-label="Add a bonus"
              onChange={(event) => {
                const type = event.target.value as ProjectEffectType;
                if (type) props.onChange({ effects: [...stage.effects, { type, value: 10 }] });
              }}
            >
              <option value="">+ Add a bonus…</option>
              {unusedEffects.map((type) => (
                <option key={type} value={type}>
                  {PROJECT_EFFECTS[type].label}
                </option>
              ))}
            </select>
          ) : null}
          <div className="rounded-lg bg-white/[0.03] p-2 text-xs">
            <p className="font-semibold text-white/60">Reveals</p>
            {facts?.unlocks.length ? (
              <ul className="mt-1 list-inside list-disc text-white/70">
                {facts.unlocks.map(({ label, npcId }) => (
                  <li key={label}>
                    {label}
                    {npcId ? (
                      <button
                        type="button"
                        className="ml-2 text-white/40 hover:text-red-300"
                        aria-label={`Stop hiding ${label}`}
                        onClick={() => props.onRevealNpc(npcId, null)}
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-white/40">
                Nothing yet. Pick an NPC below, or on a shop item, quest, dungeon or hunting
                ground set “Hidden until” to {multi ? "this stage" : "this project"}.
              </p>
            )}
            {stage.id ? (
              <SearchSelect
                className="mt-2 max-w-md"
                options={props.npcs.filter(
                  (npc) => !facts?.unlocks.some((row) => row.npcId === npc.id),
                )}
                value={null}
                placeholder="+ Hide an NPC until this is reached…"
                onChange={(npcId) => npcId && props.onRevealNpc(npcId, stage.id)}
              />
            ) : (
              <p className="mt-1 text-white/40">Save first so NPCs can be hidden behind it.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProjectEditor({ data }: { data: ProjectEditorData }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(data.project);
  // Stage facts follow their stage when it is moved; new stages have none.
  const [facts, setFacts] = useState<Array<ProjectEditorData["stageFacts"][number] | undefined>>(
    data.stageFacts,
  );
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.project);
  useLeaveGuard(dirty);
  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateStage = (index: number, patch: Partial<Stage>) =>
    update({ stages: draft.stages.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)) });
  const multi = draft.stages.length > 1;

  // This settlement's NPCs first; moving one off another stage is flagged.
  const npcOptions = useMemo<SearchOption[]>(
    () =>
      [...data.npcs]
        .sort(
          (a, b) =>
            Number(b.settlement === data.meta.settlement.name) -
            Number(a.settlement === data.meta.settlement.name),
        )
        .map((npc) => ({
          id: npc.id,
          name: npc.name,
          image: npc.image,
          detail: `${npc.settlement}${npc.requiredStageId ? " · hidden by another stage" : ""}`,
        })),
    [data.npcs, data.meta.settlement.name],
  );

  // Saved straight away, apart from the draft: it changes the NPC, not the project.
  const revealNpc = async (npcId: number, stageId: number | null) => {
    try {
      await adminRequest(`/api/admin/npcs/${npcId}/reveal`, "PATCH", { stageId });
      const label = `NPC ${data.npcs.find((npc) => npc.id === npcId)?.name ?? npcId}`;
      setFacts((rows) =>
        rows.map((row, i) =>
          row && {
            ...row,
            unlocks: [
              ...row.unlocks.filter((unlock) => unlock.npcId !== npcId),
              ...(stageId !== null && draft.stages[i]?.id === stageId ? [{ label, npcId }] : []),
            ],
          },
        ),
      );
      toast.success(stageId ? `${label} is hidden until this is reached` : `${label} is always visible again`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    }
  };

  const summary = useMemo(
    () =>
      describeProject({
        ...draft,
        skill: data.skills.find((skill) => skill.id === draft.requiredSkillId)?.name ?? null,
        stages: draft.stages.map((stage, i) => ({ ...stage, unlocks: facts[i]?.unlocks.length ?? 0 })),
      }),
    [draft, facts, data.skills],
  );

  const payload = (overrides: Partial<Draft> = {}) => {
    const { id: _id, ...rest } = { ...draft, ...overrides };
    return {
      ...rest,
      // One stage is the project itself, so it carries the project's name.
      stages: rest.stages.map((stage) => (multi ? stage : { ...stage, name: rest.name })),
    };
  };

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to ${label}`);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run("save", async () => {
      if (multi && draft.stages.some((stage) => !stage.name.trim())) {
        throw new Error("Give every stage a name");
      }
      await adminRequest(`/api/admin/community-projects/${draft.id}`, "PATCH", payload());
      toast.success(`${draft.name} saved`);
      router.refresh();
    });

  const duplicate = () =>
    run("duplicate", async () => {
      const copy = payload({ name: `${draft.name} (copy)`, enabled: false });
      const result = await adminRequest("/api/admin/community-projects", "POST", {
        ...copy,
        stages: copy.stages.map(({ id: _id, ...stage }) => stage),
      });
      toast.success("Copy created (disabled)");
      router.push(`/admin/projects/${(result as { project: { id: number } }).project.id}`);
    });

  const restart = () => {
    if (!window.confirm("Start a new round now? Everything handed in this round is cleared. Rewards already earned stay claimable.")) return;
    void run("restart", async () => {
      await adminRequest(`/api/admin/community-projects/${draft.id}/restart`, "POST");
      toast.success("New round started");
      router.refresh();
    });
  };

  const remove = () => {
    const unlocks = facts.reduce((sum, row) => sum + (row?.unlocks.length ?? 0), 0);
    if (
      !window.confirm(
        `Delete ${data.project.name}, its progress and unclaimed rewards?${unlocks ? ` The ${unlocks} things it hides become visible to everyone.` : ""}`,
      )
    )
      return;
    void run("delete", async () => {
      await adminRequest(`/api/admin/community-projects/${draft.id}`, "DELETE");
      toast.success("Project deleted");
      router.push(`/admin/settlements/${data.meta.settlement.id}`);
    });
  };

  const moveStage = (index: number, delta: -1 | 1) => {
    const swap = <T,>(list: T[]) => {
      const next = [...list];
      [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
      return next;
    };
    update({ stages: swap(draft.stages) });
    setFacts(swap(facts));
  };

  const removeStage = (index: number) => {
    const stage = draft.stages[index]!;
    const unlocks = facts[index]?.unlocks.length ?? 0;
    if (
      stage.id &&
      !window.confirm(
        `Remove stage “${stage.name}”? Its progress goes when you save${unlocks ? `, and the ${unlocks} things it hides become visible to everyone` : ""}.`,
      )
    )
      return;
    update({ stages: draft.stages.filter((_, i) => i !== index) });
    setFacts(facts.filter((_, i) => i !== index));
  };

  const addStage = () => {
    const stages = draft.stages.map((stage, i) =>
      // The first stage of a newly split project needs a name of its own.
      !multi && i === 0 && stage.name === draft.name ? { ...stage, name: "Stage 1" } : stage,
    );
    update({
      stages: [
        ...stages,
        {
          name: `Stage ${stages.length + 1}`,
          description: null,
          image: null,
          rewardGold: 0,
          rewardXp: 0,
          requirements: [],
          rewardItems: [],
          effects: [],
        } as unknown as Stage,
      ],
    });
    setFacts([...facts, undefined]);
  };

  const [phaseLabel, phaseClass] = PHASE_LABELS[data.meta.phase.phase];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <Panel title="The basics" description="What players see at the top of the project.">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <Field label="Name">
              <input className={inputClass} value={draft.name} maxLength={120} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <EnabledField value={draft.enabled} onChange={(enabled) => update({ enabled })} hint="Disabled: hidden, and its bonuses pause." />
            <Field label="Description" hint="Tell players what finishing it will change." className="md:col-span-2">
              <textarea className={inputClass} rows={2} maxLength={4_000} value={draft.description ?? ""} onChange={(e) => update({ description: e.target.value || null })} />
            </Field>
            <Field label="Picture path" hint="Optional, e.g. /assets/projects/bridge.png">
              <span className="flex items-center gap-2">
                <AssetPreview src={draft.image} width={56} height={36} />
                <input className={inputClass} value={draft.image ?? ""} maxLength={191} onChange={(e) => update({ image: e.target.value.trim() || null })} />
              </span>
            </Field>
            <NumberField label="Order in the list" value={draft.sortOrder} onChange={(sortOrder) => update({ sortOrder })} hint="Lower comes first." />
          </div>
        </Panel>

        <Panel
          title={multi ? `Stages (${draft.stages.length})` : "The goal"}
          description={
            multi
              ? "Players work through the stages in order. Each stage can pay helpers and change the world when it is reached."
              : "What players hand in, what helpers get, and what finishing it changes. Need steps? Split it into stages."
          }
        >
          <div className="space-y-4">
            {draft.stages.map((stage, index) => (
              <StageCard
                key={stage.id ?? `new-${index}`}
                stage={stage}
                index={index}
                count={draft.stages.length}
                facts={facts[index]}
                items={data.items}
                npcs={npcOptions}
                onRevealNpc={revealNpc}
                onChange={(patch) => updateStage(index, patch)}
                onMove={(delta) => moveStage(index, delta)}
                onRemove={() => removeStage(index)}
              />
            ))}
          </div>
          <Button variant="secondary" onClick={addStage} disabled={draft.stages.length >= 20}>
            <Plus className="mr-2 h-4 w-4" />
            {multi ? "Add a stage" : "Split into stages"}
          </Button>
        </Panel>

        <Panel title="When it runs" description="Once, or over and over. Times are in your own time zone.">
          <Choice<ProjectRepeat>
            value={draft.repeat}
            onChange={(repeat) => update({ repeat })}
            options={[
              { value: "ONCE", label: REPEAT_LABELS.ONCE, hint: "Finished is finished." },
              { value: "SCHEDULE", label: REPEAT_LABELS.SCHEDULE, hint: "A fresh round on a fixed beat, e.g. every Monday." },
              { value: "AFTER_COMPLETION", label: REPEAT_LABELS.AFTER_COMPLETION, hint: "Starts over a while after players finish it." },
            ]}
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {draft.repeat !== "ONCE" ? (
              <>
                <DurationField
                  label={draft.repeat === "SCHEDULE" ? "New round every" : "Rest before starting over"}
                  hours={draft.repeatHours}
                  onChange={(repeatHours) => update({ repeatHours })}
                />
                <OptionalNumber
                  label="How many rounds"
                  hint="Empty: forever."
                  min={1}
                  max={100_000}
                  value={draft.maxRounds}
                  onChange={(maxRounds) => update({ maxRounds })}
                />
              </>
            ) : null}
            <Field
              label="Opens at"
              hint={draft.repeat === "SCHEDULE" ? "Rounds count from here. Empty: from saving." : "Empty: right away."}
            >
              <input type="datetime-local" className={inputClass} value={toLocalInput(draft.startsAt)} onChange={(e) => update({ startsAt: fromLocalInput(e.target.value) })} />
            </Field>
            <Field label="Closes for good at" hint="Empty: never.">
              <input type="datetime-local" className={inputClass} value={toLocalInput(draft.endsAt)} onChange={(e) => update({ endsAt: fromLocalInput(e.target.value) })} />
            </Field>
          </div>
          {draft.repeat !== "ONCE" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/60">When a new round starts, what it revealed and its bonuses…</p>
              <Choice
                value={draft.unlockMode}
                onChange={(unlockMode) => update({ unlockMode })}
                options={[
                  { value: "PERMANENT", label: "…stay for good", hint: "Reached once is enough." },
                  { value: "WHILE_REACHED", label: "…pause until reached again", hint: "Players must rebuild them each round." },
                ]}
              />
            </div>
          ) : null}
          {multi ? (
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                className="h-4 w-4 accent-amber-400"
                checked={draft.showFutureStages}
                onChange={(e) => update({ showFutureStages: e.target.checked })}
              />
              Show players the stages still to come
            </label>
          ) : null}
        </Panel>

        <Panel title="Who can help" description="Players who don't qualify still see the project, with the reason they can't help.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <NumberField label="Character level" min={1} value={draft.minLevel} onChange={(minLevel) => update({ minLevel: Math.max(1, Math.floor(minLevel)) })} hint="1: everyone." />
            <Field label="Skill needed" hint="Optional.">
              <SearchSelect
                options={data.skills}
                value={draft.requiredSkillId}
                noneLabel="No skill needed"
                onChange={(requiredSkillId) => update({ requiredSkillId })}
              />
            </Field>
            {draft.requiredSkillId ? (
              <NumberField label="Skill level" min={1} value={draft.requiredSkillLevel} onChange={(requiredSkillLevel) => update({ requiredSkillLevel: Math.max(1, Math.floor(requiredSkillLevel)) })} />
            ) : null}
            <OptionalNumber
              label="Most one player may supply"
              hint="Of each item. Empty: no limit. Lower it to make it a team effort."
              min={1}
              max={100}
              suffix="%"
              value={draft.maxSharePercent}
              onChange={(maxSharePercent) => update({ maxSharePercent })}
            />
          </div>
        </Panel>

        <Panel title="How rewards are paid" description="Each stage's reward is set on the stage above; this decides who gets how much.">
          <Choice
            value={draft.rewardSplit}
            onChange={(rewardSplit) => update({ rewardSplit })}
            options={[
              { value: "FLAT", label: "Everyone gets the full reward", hint: "Helping at all is what counts." },
              { value: "BY_SHARE", label: "Split by how much each gave", hint: "Giving 10% of a stage earns 10% of its reward." },
            ]}
          />
          <div className="max-w-xs">
            <NumberField
              label="Minimum share to earn a reward"
              suffix="%"
              min={0}
              max={100}
              step={0.1}
              value={draft.rewardMinSharePercent}
              onChange={(value) => update({ rewardMinSharePercent: Math.min(100, Math.max(0, value)) })}
              hint="Of the stage. 0: any contribution counts."
            />
          </div>
        </Panel>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <div className="space-y-3 rounded-xl bg-gray-950/45 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={cn("rounded px-2 py-0.5 font-semibold", phaseClass)}>{phaseLabel}</span>
            {draft.repeat !== "ONCE" ? <span className="text-white/50">Round {data.meta.round}</span> : null}
            {data.meta.phase.until ? (
              <span className="text-white/50">
                until {new Date(data.meta.phase.until).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            ) : null}
          </div>
          {data.meta.unclaimedRewards > 0 ? (
            <p className="text-xs text-white/50">{data.meta.unclaimedRewards} rewards waiting to be claimed.</p>
          ) : null}
          <div>
            <h3 className="text-sm font-semibold">In short</h3>
            <ul className="mt-1 space-y-1 text-sm text-white/70">
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <Button className="w-full" onClick={() => void save()} disabled={busy || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void duplicate()} disabled={busy}>
              <Copy className="mr-1.5 h-4 w-4" />
              Duplicate
            </Button>
            {draft.repeat !== "ONCE" ? (
              <Button size="sm" variant="secondary" onClick={restart} disabled={busy || dirty} title={dirty ? "Save first" : undefined}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                New round now
              </Button>
            ) : null}
            <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </aside>

      {/* Narrow screens put the summary last, so keep saving in reach. */}
      {dirty ? (
        <div className="sticky bottom-3 z-10 xl:hidden">
          <Button className="w-full shadow-lg" onClick={() => void save()} disabled={busy}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
