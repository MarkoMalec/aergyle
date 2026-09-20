"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { CirclePlus, Plus, Save, Trash2 } from "lucide-react";
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
import { SearchSelect, type SearchOption } from "~/components/admin/SearchSelect";
import { Button } from "~/components/ui/button";
import type { QuestObjectiveType, QuestRepeat } from "~/generated/prisma/enums";
import { formatGold } from "~/lib/marketplace";
import { QUEST_OBJECTIVE_LABELS, QUEST_REPEAT_LABELS } from "~/game/settlements";

type Objective = {
  type: QuestObjectiveType;
  itemId: number | null;
  creatureId: number | null;
  dungeonId: number | null;
  quantity: number;
};

type AdminQuest = {
  id: number;
  name: string;
  description: string | null;
  repeat: QuestRepeat;
  requiredLevel: number;
  rewardGold: number;
  rewardXp: number;
  requiredProjectId: number | null;
  enabled: boolean;
  sortOrder: number;
  objectives: Objective[];
  rewardItems: Array<{ itemId: number; quantity: number }>;
  completions: number;
  updatedAt: string;
};

type Options = {
  items: SearchOption[];
  creatures: SearchOption[];
  dungeons: SearchOption[];
  projects: SearchOption[];
};

const OBJECTIVE_TYPES: Array<{ value: QuestObjectiveType; label: string }> = [
  { value: "DELIVER", label: "Deliver item" },
  { value: "HUNT", label: "Defeat creature" },
  { value: "CLEAR", label: "Clear dungeon" },
];

const TARGET_KEY = {
  DELIVER: "itemId",
  HUNT: "creatureId",
  CLEAR: "dungeonId",
} as const satisfies Record<QuestObjectiveType, keyof Objective>;

function targetOptions(type: QuestObjectiveType, options: Options) {
  return type === "DELIVER"
    ? options.items
    : type === "HUNT"
      ? options.creatures
      : options.dungeons;
}

function QuestCard(props: {
  quest: AdminQuest;
  npcId: number;
  options: Options;
  defaultOpen: boolean;
}) {
  const router = useRouter();
  const { quest, options } = props;
  const [draft, setDraft] = useState(quest);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(quest);
  const names = useMemo(
    () =>
      Object.fromEntries(
        (["DELIVER", "HUNT", "CLEAR"] as const).map((type) => [
          type,
          new Map(targetOptions(type, options).map((option) => [option.id, option.name])),
        ]),
      ) as Record<QuestObjectiveType, Map<number, string>>,
    [options],
  );
  const update = (patch: Partial<AdminQuest>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const updateObjective = (index: number, patch: Partial<Objective>) =>
    update({
      objectives: draft.objectives.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    });
  const updateReward = (
    index: number,
    patch: Partial<AdminQuest["rewardItems"][number]>,
  ) =>
    update({
      rewardItems: draft.rewardItems.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    });

  const summary = [
    QUEST_REPEAT_LABELS[quest.repeat],
    quest.objectives.length === 0
      ? "no objectives"
      : quest.objectives
          .map((objective) => {
            const target = objective[TARGET_KEY[objective.type]];
            return `${QUEST_OBJECTIVE_LABELS[objective.type]} ${names[objective.type].get(target ?? 0) ?? "?"} ×${objective.quantity}`;
          })
          .join(", "),
    `completed ${quest.completions} ${quest.completions === 1 ? "time" : "times"}`,
  ].join(" · ");

  const save = async () => {
    if (draft.objectives.some((row) => row[TARGET_KEY[row.type]] === null)) {
      return toast.error("Choose a target for every objective");
    }
    setBusy(true);
    try {
      const {
        id,
        completions: _completions,
        updatedAt: _updatedAt,
        ...body
      } = draft;
      await adminRequest(`/api/admin/quests/${id}`, "PATCH", {
        ...body,
        npcId: props.npcId,
      });
      toast.success(`${draft.name} saved`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !window.confirm(
        `Delete ${quest.name}? Every player's progress on it is deleted too.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await adminRequest(`/api/admin/quests/${quest.id}`, "DELETE");
      toast.success(`${quest.name} deleted`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
      setBusy(false);
    }
  };

  return (
    <details
      className="rounded-xl border border-white/10 bg-black/15"
      open={props.defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{quest.name}</strong>
          <small className="text-white/45">{summary}</small>
        </span>
        <span
          className={
            quest.enabled ? "text-xs text-emerald-300" : "text-xs text-white/35"
          }
        >
          {quest.enabled ? "Enabled" : "Disabled"}
        </span>
      </summary>
      <div className="space-y-5 border-t border-white/10 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Name">
            <input
              className={inputClass}
              value={draft.name}
              maxLength={120}
              onChange={(event) => update({ name: event.target.value })}
            />
          </Field>
          <Field
            label="Repeats"
            hint="Daily quests reset at 00:00 UTC, weekly ones on Monday 00:00 UTC."
          >
            <select
              className={inputClass}
              value={draft.repeat}
              onChange={(event) =>
                update({ repeat: event.target.value as QuestRepeat })
              }
            >
              {Object.entries(QUEST_REPEAT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <NumberField
            label="Character level needed"
            hint="Players below this level don't see the quest."
            value={draft.requiredLevel}
            min={1}
            onChange={(requiredLevel) =>
              update({ requiredLevel: Math.max(1, Math.floor(requiredLevel)) })
            }
          />
          <EnabledField
            value={draft.enabled}
            onChange={(enabled) => update({ enabled })}
            hint="Disabled quests are hidden, even from players on them."
          />
          <Field
            label="Hidden until project"
            hint="The quest appears once this community project is completed."
          >
            <SearchSelect
              options={options.projects}
              value={draft.requiredProjectId}
              noneLabel="Always visible"
              onChange={(requiredProjectId) => update({ requiredProjectId })}
            />
          </Field>
          <NumberField
            label="Sort order"
            hint="Lower numbers are listed first."
            value={draft.sortOrder}
            onChange={(sortOrder) => update({ sortOrder })}
          />
          <Field
            label="Description"
            hint="What the NPC asks for, in their words."
            className="md:col-span-2 xl:col-span-4"
          >
            <textarea
              className={inputClass}
              rows={3}
              maxLength={4_000}
              value={draft.description ?? ""}
              onChange={(event) =>
                update({ description: event.target.value || null })
              }
            />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Objectives
          </p>
          <p className="text-xs text-white/40">
            <strong className="text-white/60">Deliver:</strong> taken from the
            inventory on completion (any rarity, lowest first), so crafted and
            gathered goods count.{" "}
            <strong className="text-white/60">Defeat:</strong> kills in hunting
            grounds and dungeons after accepting.{" "}
            <strong className="text-white/60">Clear:</strong> cleared runs of
            that dungeon after accepting.
          </p>
          {draft.objectives.map((objective, index) => {
            const key = TARGET_KEY[objective.type];
            return (
              <div
                key={index}
                className="grid items-center gap-3 rounded-lg bg-black/20 p-2 md:grid-cols-[170px_minmax(0,1fr)_120px_auto]"
              >
                <select
                  className={inputClass}
                  aria-label="Objective type"
                  value={objective.type}
                  onChange={(event) =>
                    updateObjective(index, {
                      type: event.target.value as QuestObjectiveType,
                      itemId: null,
                      creatureId: null,
                      dungeonId: null,
                    })
                  }
                >
                  {OBJECTIVE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <SearchSelect
                  options={targetOptions(objective.type, options)}
                  value={objective[key]}
                  placeholder="Choose a target…"
                  onChange={(id) => updateObjective(index, { [key]: id })}
                />
                <NumberInput
                  className={inputClass}
                  aria-label="Quantity"
                  min={1}
                  value={objective.quantity}
                  onValueChange={(quantity) => {
                    if (quantity !== null) {
                      updateObjective(index, {
                        quantity: Math.max(1, Math.floor(quantity)),
                      });
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove objective"
                  onClick={() =>
                    update({
                      objectives: draft.objectives.filter(
                        (_, rowIndex) => rowIndex !== index,
                      ),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button
            variant="secondary"
            onClick={() =>
              update({
                objectives: [
                  ...draft.objectives,
                  {
                    type: "DELIVER",
                    itemId: null,
                    creatureId: null,
                    dungeonId: null,
                    quantity: 10,
                  },
                ],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add objective
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Rewards
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField
              label="Gold"
              value={draft.rewardGold}
              min={0}
              step={0.01}
              onChange={(rewardGold) => update({ rewardGold: Math.max(0, rewardGold) })}
            />
            <NumberField
              label="Character XP"
              value={draft.rewardXp}
              min={0}
              onChange={(rewardXp) =>
                update({ rewardXp: Math.max(0, Math.floor(rewardXp)) })
              }
            />
          </div>
          {draft.rewardItems.map((reward, index) => (
            <div
              key={index}
              className="grid items-center gap-3 rounded-lg bg-black/20 p-2 md:grid-cols-[minmax(0,1fr)_120px_auto]"
            >
              <SearchSelect
                options={options.items}
                value={reward.itemId}
                onChange={(itemId) => {
                  if (itemId) updateReward(index, { itemId });
                }}
              />
              <NumberInput
                className={inputClass}
                aria-label="Quantity"
                min={1}
                value={reward.quantity}
                onValueChange={(quantity) => {
                  if (quantity !== null) {
                    updateReward(index, {
                      quantity: Math.max(1, Math.floor(quantity)),
                    });
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove reward"
                onClick={() =>
                  update({
                    rewardItems: draft.rewardItems.filter(
                      (_, rowIndex) => rowIndex !== index,
                    ),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              const used = new Set(draft.rewardItems.map((row) => row.itemId));
              const item = options.items.find((option) => !used.has(option.id));
              if (!item) return toast.error("Every item is already a reward");
              update({
                rewardItems: [...draft.rewardItems, { itemId: item.id, quantity: 1 }],
              });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add reward item
          </Button>
          <p className="text-xs text-white/40">
            Reward items are granted at their own rarity. Currently{" "}
            {formatGold(draft.rewardGold)} gold, {draft.rewardXp} XP and{" "}
            {draft.rewardItems.length} items.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete quest
          </Button>
          <Button onClick={() => void save()} disabled={busy || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : dirty ? "Save quest" : "Saved"}
          </Button>
        </div>
      </div>
    </details>
  );
}

export function QuestsEditor(
  props: Options & { npcId: number; quests: AdminQuest[] },
) {
  const router = useRouter();
  const [createdId, setCreatedId] = useState<number | null>(null);
  const { items, creatures, dungeons, projects } = props;
  const options = useMemo(
    () => ({ items, creatures, dungeons, projects }),
    [items, creatures, dungeons, projects],
  );

  const create = async () => {
    try {
      const result = await adminRequest("/api/admin/quests", "POST", {
        npcId: props.npcId,
        name: `New quest ${props.quests.length + 1}`,
        description: null,
        repeat: "ONCE",
        requiredLevel: 1,
        rewardGold: 0,
        rewardXp: 0,
        requiredProjectId: null,
        enabled: false,
        sortOrder: 0,
        objectives: [],
        rewardItems: [],
      });
      setCreatedId((result?.quest as { id?: number } | undefined)?.id ?? null);
      toast.success("Quest created (disabled). Add objectives and rewards.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create");
    }
  };

  return (
    <Panel
      title="Quests"
      description="One-time quests can be done once per player; daily and weekly quests can be done again each period. Players accept a quest, work on it anywhere, and hand it in here. A one-time quest a player hasn't seen yet puts a dot on their Settlements menu while they are at this location, until they open this NPC."
      action={
        <Button variant="secondary" onClick={() => void create()}>
          <CirclePlus className="mr-2 h-4 w-4" />
          New quest
        </Button>
      }
    >
      <div className="space-y-3">
        {props.quests.length === 0 ? (
          <p className="text-sm text-white/45">This NPC gives no quests yet.</p>
        ) : null}
        {props.quests.map((quest) => (
          <QuestCard
            // Remount when the saved row changes so drafts reset after saving.
            key={`${quest.id}:${quest.updatedAt}`}
            quest={quest}
            npcId={props.npcId}
            options={options}
            defaultOpen={quest.id === createdId}
          />
        ))}
      </div>
    </Panel>
  );
}
