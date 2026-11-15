"use client";

import React from "react";
import { Trash2, X } from "lucide-react";
import type {
  CreatureAttackStyle,
  CreatureDamageType,
  CreatureKind,
  ItemRarity,
} from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import { adminRequest } from "~/components/admin/fields";
import { SearchSelect } from "~/components/admin/SearchSelect";
import {
  Art,
  Card,
  cardClass,
  DetailHeader,
  type Draft,
  editorInput,
  Labeled,
  ListAction,
  masterDetailClass,
  Num,
  patchRow,
  Percent,
  PickList,
  RangeInputs,
  rowClass,
  theadClass,
  Toggle,
  useServerAction,
} from "~/components/admin/editor";
import { cn } from "~/lib/utils";

export type AdminItemOption = {
  id: number;
  name: string;
  sprite: string;
  rarity: ItemRarity;
};

export type AdminCreatureDrop = {
  id?: number;
  itemId: number;
  enabled: boolean;
  baseChance: number;
  minQuantity: number;
  maxQuantity: number;
  requiredLevel: number;
  item: AdminItemOption;
};

export type AdminCreature = {
  id: number;
  kind: CreatureKind;
  name: string;
  description: string | null;
  asset: string;
  enabled: boolean;
  attackStyle: CreatureAttackStyle;
  attackChance: number;
  damageMin: number;
  damageMax: number;
  magicDamageMin: number;
  magicDamageMax: number;
  damageType: CreatureDamageType | null;
  elementalDamageMin: number;
  elementalDamageMax: number;
  health: number;
  armor: number;
  magicResist: number;
  evasion: number;
  blockChance: number;
  critChance: number;
  critDamage: number;
  drops: AdminCreatureDrop[];
};

const COPY = {
  ANIMAL: {
    noun: "animal",
    levelLabel: "Hunting lv",
    newAsset: "/assets/creatures/animals/meadow-hare-hunting-v1.png",
  },
  MONSTER: {
    noun: "monster",
    levelLabel: "Character lv",
    newAsset: "/assets/creatures/monsters/low-level/goblin.png",
  },
} as const;

const DAMAGE_TYPES: Array<{ value: CreatureDamageType; label: string }> = [
  { value: "FIRE", label: "Fire" },
  { value: "ICE", label: "Ice (cold resistance)" },
  { value: "LIGHTNING", label: "Lightning" },
  { value: "POISON", label: "Poison" },
];

/** Damage pairs that must stay min ≤ max, by field name. */
const DAMAGE_RANGES = [
  { label: "Physical damage", min: "damageMin", max: "damageMax" },
  { label: "Magic damage", min: "magicDamageMin", max: "magicDamageMax" },
  {
    label: "Elemental damage",
    min: "elementalDamageMin",
    max: "elementalDamageMax",
  },
] as const;

function newCreaturePayload(kind: CreatureKind, index: number) {
  const monster = kind === "MONSTER";
  return {
    kind,
    name: `New ${monster ? "Monster" : "Animal"} ${index}`,
    description: null,
    asset: COPY[kind].newAsset,
    enabled: false,
    attackStyle: "MELEE",
    attackChance: monster ? 0 : 0.1,
    damageMin: 1,
    damageMax: 3,
    magicDamageMin: 0,
    magicDamageMax: 0,
    damageType: null,
    elementalDamageMin: 0,
    elementalDamageMax: 0,
    health: monster ? 10 : 0,
    armor: 0,
    magicResist: 0,
    evasion: 0,
    blockChance: 0,
    critChance: 0,
    critDamage: monster ? 150 : 0,
    drops: [],
  };
}

function toPayload({ id: _id, drops, ...creature }: AdminCreature) {
  return {
    ...creature,
    drops: drops.map(({ id: _dropId, item: _item, ...drop }) => drop),
  };
}

export const saveCreature = patchRow<AdminCreature>(
  "/api/admin/creatures",
  toPayload,
);

/** Blocking problems the API would reject, worded for the Save bar. */
export function creatureProblems(creatures: AdminCreature[]) {
  return creatures.flatMap((creature) => [
    ...(creature.name.trim() ? [] : ["A creature needs a name"]),
    ...DAMAGE_RANGES.filter(
      (range) => creature[range.max] < creature[range.min],
    ).map(
      (range) => `${creature.name}: ${range.label.toLowerCase()} max below min`,
    ),
    ...creature.drops
      .filter((drop) => drop.maxQuantity < drop.minQuantity)
      .map((drop) => `${creature.name}: ${drop.item.name} max below min`),
  ]);
}

function summary(creature: AdminCreature) {
  const parts = [
    creature.kind === "MONSTER"
      ? `${creature.health} HP`
      : `${Math.round(creature.attackChance * 100)}% retaliation`,
    `${creature.damageMin}–${creature.damageMax} physical`,
  ];
  if (creature.magicDamageMax > 0) {
    parts.push(`${creature.magicDamageMin}–${creature.magicDamageMax} magic`);
  }
  if (creature.damageType) {
    parts.push(
      `+${creature.elementalDamageMin}–${creature.elementalDamageMax} ${creature.damageType.toLowerCase()}`,
    );
  }
  return parts.join(" · ");
}

export function CreatureArt({ src, size }: { src: string; size: number }) {
  return <Art src={src} size={size} />;
}

function CreatureForm(props: {
  creature: AdminCreature;
  items: AdminItemOption[];
  update: (patch: Partial<AdminCreature>) => void;
  onDelete: () => void;
  usage?: React.ReactNode;
}) {
  const { creature, update } = props;
  const copy = COPY[creature.kind];
  const animal = creature.kind === "ANIMAL";
  const used = new Set(creature.drops.map((drop) => drop.itemId));
  const updateDrop = (itemId: number, patch: Partial<AdminCreatureDrop>) =>
    update({
      drops: creature.drops.map((drop) =>
        drop.itemId === itemId ? { ...drop, ...patch } : drop,
      ),
    });
  const range = (field: (typeof DAMAGE_RANGES)[number], disabled?: boolean) => (
    <Labeled label={field.label}>
      <RangeInputs
        label={field.label}
        min={creature[field.min]}
        max={creature[field.max]}
        disabled={disabled}
        onChange={({ min, max }) =>
          update({
            [field.min]: min ?? creature[field.min],
            [field.max]: max ?? creature[field.max],
          })
        }
      />
    </Labeled>
  );

  const defence = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Labeled label="Health">
        <Num
          label="Health"
          value={creature.health}
          min={0}
          integer
          onChange={(health) => update({ health })}
        />
      </Labeled>
      <Labeled
        label="Armor"
        hint="Equal to the attacker's K halves its damage."
      >
        <Num
          label="Armor"
          value={creature.armor}
          min={0}
          onChange={(armor) => update({ armor })}
        />
      </Labeled>
      <Labeled label="Magic resist" hint="Negative is a weakness.">
        <Num
          label="Magic resist"
          value={creature.magicResist}
          min={-100}
          max={75}
          suffix="%"
          onChange={(magicResist) => update({ magicResist })}
        />
      </Labeled>
      <Labeled label="Evasion">
        <Num
          label="Evasion"
          value={creature.evasion}
          min={0}
          max={75}
          step={0.5}
          suffix="%"
          onChange={(evasion) => update({ evasion })}
        />
      </Labeled>
      <Labeled label="Block">
        <Num
          label="Block"
          value={creature.blockChance}
          min={0}
          max={75}
          step={0.5}
          suffix="%"
          onChange={(blockChance) => update({ blockChance })}
        />
      </Labeled>
    </div>
  );

  return (
    <div className="min-w-0 space-y-4">
      <DetailHeader
        image={creature.asset}
        title={creature.name || "Unnamed"}
        subtitle={props.usage ?? summary(creature)}
      >
        <label className="flex items-center gap-2 text-sm text-white/70">
          <Toggle
            label={`${creature.name} enabled`}
            checked={creature.enabled}
            onChange={(enabled) => update({ enabled })}
          />
          {creature.enabled ? "Enabled" : "Disabled"}
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={props.onDelete}
          aria-label={`Delete ${creature.name}`}
        >
          <Trash2 className="h-4 w-4 text-red-300" />
        </Button>
      </DetailHeader>

      <Card title="Identity">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Name">
            <input
              className={editorInput}
              value={creature.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </Labeled>
          <Labeled label="Art path">
            <input
              className={editorInput}
              value={creature.asset}
              onChange={(event) => update({ asset: event.target.value })}
            />
          </Labeled>
          <Labeled label="Description" className="sm:col-span-2">
            <textarea
              className={cn(editorInput, "h-auto py-1.5")}
              rows={2}
              value={creature.description ?? ""}
              onChange={(event) =>
                update({ description: event.target.value || null })
              }
            />
          </Labeled>
        </div>
      </Card>

      <Card
        title="Attack"
        description={
          animal
            ? "An animal strikes back with this chance per encounter. Style decides which evasion avoids it; armor, magic resist and the matching resistance reduce each damage part."
            : "Style decides which evasion avoids the strike; armor, magic resist and the matching resistance reduce each damage part."
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Labeled label="Attack style">
            <select
              className={editorInput}
              value={creature.attackStyle}
              onChange={(event) =>
                update({
                  attackStyle: event.target.value as CreatureAttackStyle,
                })
              }
            >
              <option value="MELEE">Melee</option>
              <option value="RANGED">Ranged</option>
              <option value="MAGIC">Magic</option>
            </select>
          </Labeled>
          {animal ? (
            <Labeled label="Retaliation chance">
              <Percent
                label="Retaliation chance"
                value={creature.attackChance}
                step={1}
                onChange={(attackChance) => update({ attackChance })}
              />
            </Labeled>
          ) : null}
          <Labeled label="Crit chance">
            <Num
              label="Crit chance"
              value={creature.critChance}
              min={0}
              max={100}
              step={0.5}
              suffix="%"
              onChange={(critChance) => update({ critChance })}
            />
          </Labeled>
          <Labeled label="Crit damage" hint="150% = ×1.5">
            <Num
              label="Crit damage"
              value={creature.critDamage}
              min={0}
              step={5}
              suffix="%"
              onChange={(critDamage) => update({ critDamage })}
            />
          </Labeled>
          {range(DAMAGE_RANGES[0])}
          {range(DAMAGE_RANGES[1])}
          <Labeled label="Element">
            <select
              className={editorInput}
              value={creature.damageType ?? ""}
              onChange={(event) =>
                update({
                  damageType:
                    (event.target.value as CreatureDamageType) || null,
                })
              }
            >
              <option value="">None</option>
              {DAMAGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Labeled>
          {range(DAMAGE_RANGES[2], !creature.damageType)}
        </div>
      </Card>

      {animal ? (
        <details className={cn(cardClass, "group")}>
          <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Defence{" "}
            <span className="font-normal text-white/45">
              · dungeons only, hunting ignores it
            </span>
          </summary>
          <div className="mt-3">{defence}</div>
        </details>
      ) : (
        <Card title="Defence">{defence}</Card>
      )}

      <Card
        title={`Drops (${creature.drops.length})`}
        description={
          animal
            ? "Rolled on every successful hunt encounter."
            : "Every defeated monster rolls its own table; chances are capped at 95% and never shown to players."
        }
        className="overflow-x-auto"
      >
        <table className="w-full min-w-[600px] text-sm">
          <thead className={theadClass}>
            <tr>
              <th>Item</th>
              <th className="w-28">Chance</th>
              <th className="w-44">Amount</th>
              <th className="w-24">{copy.levelLabel}</th>
              <th className="w-12">On</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {creature.drops.map((drop) => (
              <tr
                key={drop.itemId}
                className={cn(rowClass, !drop.enabled && "text-white/40")}
              >
                <td>
                  <div className="flex items-center gap-2">
                    <Art src={drop.item.sprite} size={28} />
                    <span className="truncate font-medium">
                      {drop.item.name}
                    </span>
                  </div>
                </td>
                <td>
                  <Percent
                    label={`${drop.item.name} chance`}
                    value={drop.baseChance}
                    onChange={(baseChance) =>
                      updateDrop(drop.itemId, { baseChance })
                    }
                  />
                </td>
                <td>
                  <RangeInputs
                    label={`${drop.item.name} amount`}
                    floor={1}
                    min={drop.minQuantity}
                    max={drop.maxQuantity}
                    onChange={({ min, max }) =>
                      updateDrop(drop.itemId, {
                        minQuantity: min ?? drop.minQuantity,
                        maxQuantity: max ?? drop.maxQuantity,
                      })
                    }
                  />
                </td>
                <td>
                  <Num
                    label={`${drop.item.name} required level`}
                    value={drop.requiredLevel}
                    min={1}
                    integer
                    onChange={(requiredLevel) =>
                      updateDrop(drop.itemId, { requiredLevel })
                    }
                  />
                </td>
                <td>
                  <Toggle
                    label={`${drop.item.name} enabled`}
                    checked={drop.enabled}
                    onChange={(enabled) => updateDrop(drop.itemId, { enabled })}
                  />
                </td>
                <td>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    aria-label={`Remove ${drop.item.name}`}
                    onClick={() =>
                      update({
                        drops: creature.drops.filter(
                          (entry) => entry.itemId !== drop.itemId,
                        ),
                      })
                    }
                  >
                    <X className="h-4 w-4 text-red-300" />
                  </Button>
                </td>
              </tr>
            ))}
            {creature.drops.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-white/45"
                >
                  No drops yet. Add an item below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <SearchSelect
          className="max-w-xs"
          placeholder="+ Add a drop…"
          options={props.items
            .filter((item) => !used.has(item.id))
            .map((item) => ({
              id: item.id,
              name: item.name,
              image: item.sprite,
            }))}
          value={null}
          onChange={(id) => {
            const item = props.items.find((option) => option.id === id);
            if (!item) return;
            update({
              drops: [
                ...creature.drops,
                {
                  itemId: item.id,
                  item,
                  enabled: true,
                  baseChance: 0.5,
                  minQuantity: 1,
                  maxQuantity: 1,
                  requiredLevel: 1,
                },
              ],
            });
          }}
        />
      </Card>
    </div>
  );
}

/** Searchable creature list beside the selected creature's form. */
export function CreatureEditor(props: {
  kind: CreatureKind;
  draft: Draft<AdminCreature>;
  items: AdminItemOption[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Subtitle under the creature's name, e.g. where an animal lives. */
  usage?: (creature: AdminCreature) => React.ReactNode;
}) {
  const run = useServerAction();
  const copy = COPY[props.kind];
  const creature = props.draft.rows.find((row) => row.id === props.selectedId);

  const create = async () => {
    const result = await run(
      () =>
        adminRequest(
          "/api/admin/creatures",
          "POST",
          newCreaturePayload(props.kind, props.draft.rows.length + 1),
        ),
      `New ${copy.noun} created (disabled)`,
    );
    const created = result?.creature as { id?: number } | undefined;
    if (created?.id) props.onSelect(created.id);
  };
  const remove = (target: AdminCreature) => {
    if (
      !window.confirm(
        `Delete ${target.name}? Its drop table and every placement are removed. Characters already out keep their snapshot.`,
      )
    )
      return;
    void run(
      () => adminRequest(`/api/admin/creatures/${target.id}`, "DELETE"),
      `${target.name} deleted`,
    );
  };

  return (
    <div className={masterDetailClass}>
      <PickList
        placeholder={`Find ${copy.noun === "animal" ? "an animal" : "a monster"}…`}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        items={props.draft.rows.map((row) => ({
          id: row.id,
          name: row.name,
          image: row.asset,
          detail: `${row.kind === "MONSTER" ? `${row.health} HP` : `${Math.round(row.attackChance * 100)}%`} · ${row.drops.length} drops`,
          muted: !row.enabled,
        }))}
        footer={
          <ListAction onClick={() => void create()}>New {copy.noun}</ListAction>
        }
      />
      {creature ? (
        <CreatureForm
          key={creature.id}
          creature={creature}
          items={props.items}
          update={(patch) => props.draft.update(creature.id, patch)}
          onDelete={() => remove(creature)}
          usage={props.usage?.(creature)}
        />
      ) : (
        <p className="text-sm text-white/55">
          No {copy.noun}s yet. Create one to get started.
        </p>
      )}
    </div>
  );
}
