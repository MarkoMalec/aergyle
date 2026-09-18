"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { CirclePlus, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import type {
  CreatureAttackStyle,
  CreatureDamageType,
  CreatureKind,
  ItemRarity,
} from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import {
  adminRequest,
  EnabledField,
  inputClass,
  labelClass,
  NumberField,
} from "~/components/admin/fields";

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
    title: "Animal catalogue and drop tables",
    description:
      "When an animal retaliates (retaliation chance per encounter), it uses its full attack: physical, magic and elemental damage plus critical hits. Defence stats only matter in dungeons and can stay at 0.",
    levelLabel: "Hunting level",
    newAsset: "/assets/creatures/animals/meadow-hare-hunting-v1.png",
  },
  MONSTER: {
    noun: "monster",
    title: "Monster catalogue and drop tables",
    description:
      "Monsters fight until one side falls. Every defeated monster rolls its own drop table; drop chances are capped at 95% and never shown to players.",
    levelLabel: "Character level",
    newAsset: "/assets/creatures/monsters/goblin.png",
  },
} as const;

const DAMAGE_TYPES: Array<{ value: CreatureDamageType; label: string }> = [
  { value: "FIRE", label: "Fire" },
  { value: "ICE", label: "Ice (cold resistance)" },
  { value: "LIGHTNING", label: "Lightning" },
  { value: "POISON", label: "Poison" },
];

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

function CreatureSummary({ creature }: { creature: AdminCreature }) {
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
  parts.push(`${creature.drops.length} drops`);
  return <small className="text-white/45">{parts.join(" · ")}</small>;
}

export function CreatureArt({ src, size }: { src: string; size: number }) {
  // next/image rejects relative or malformed paths while an admin is typing.
  if (!src.startsWith("/")) {
    return (
      <span
        className="shrink-0 rounded-lg bg-black/30"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-lg bg-black/30 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function CreatureEditor(props: {
  kind: CreatureKind;
  initial: AdminCreature[];
  items: AdminItemOption[];
  onChange: (creatures: AdminCreature[]) => void;
}) {
  const router = useRouter();
  const copy = COPY[props.kind];
  const [rows, setRows] = useState(props.initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  useEffect(() => setRows(props.initial), [props.initial]);

  const update = (id: number, patch: Partial<AdminCreature>) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const updateDrop = (
    creature: AdminCreature,
    index: number,
    patch: Partial<AdminCreatureDrop>,
  ) =>
    update(creature.id, {
      drops: creature.drops.map((drop, dropIndex) =>
        dropIndex === index ? { ...drop, ...patch } : drop,
      ),
    });
  const addDrop = (creature: AdminCreature) => {
    const used = new Set(creature.drops.map((drop) => drop.itemId));
    const item = props.items.find((option) => !used.has(option.id));
    if (!item) return toast.error("Every item is already in this drop table");
    update(creature.id, {
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
  };

  const save = async (creature: AdminCreature) => {
    setBusyId(creature.id);
    try {
      await adminRequest(
        `/api/admin/creatures/${creature.id}`,
        "PATCH",
        toPayload(creature),
      );
      props.onChange(rows);
      toast.success(`${creature.name} saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusyId(null);
    }
  };
  const remove = async (creature: AdminCreature) => {
    if (
      !window.confirm(
        `Delete ${creature.name}? Its drop table and every placement are removed. Characters already out keep their snapshot.`,
      )
    ) {
      return;
    }
    setBusyId(creature.id);
    try {
      await adminRequest(`/api/admin/creatures/${creature.id}`, "DELETE");
      toast.success(`${creature.name} deleted`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
    } finally {
      setBusyId(null);
    }
  };
  const create = async () => {
    try {
      await adminRequest(
        "/api/admin/creatures",
        "POST",
        newCreaturePayload(props.kind, rows.length + 1),
      );
      toast.success(`New ${copy.noun} created; configure its asset and drops`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create");
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-gray-950/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            {copy.description}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void create()}>
          <CirclePlus className="mr-2 h-4 w-4" />
          New {copy.noun}
        </Button>
      </div>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-white/45">No {copy.noun}s yet.</p>
        ) : null}
        {rows.map((creature) => (
          <details
            className="rounded-xl border border-white/10 bg-black/15"
            key={creature.id}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
              <CreatureArt src={creature.asset} size={48} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate">{creature.name}</strong>
                <CreatureSummary creature={creature} />
              </span>
              <span
                className={
                  creature.enabled
                    ? "text-xs text-emerald-300"
                    : "text-xs text-white/35"
                }
              >
                {creature.enabled ? "Enabled" : "Disabled"}
              </span>
            </summary>
            <div className="space-y-5 border-t border-white/10 p-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <label className={labelClass}>
                  <span>Name</span>
                  <input
                    className={inputClass}
                    value={creature.name}
                    onChange={(event) =>
                      update(creature.id, { name: event.target.value })
                    }
                  />
                </label>
                <label className={`${labelClass} lg:col-span-2`}>
                  <span>Asset path</span>
                  <input
                    className={inputClass}
                    value={creature.asset}
                    onChange={(event) =>
                      update(creature.id, { asset: event.target.value })
                    }
                  />
                </label>
                <EnabledField
                  value={creature.enabled}
                  onChange={(enabled) => update(creature.id, { enabled })}
                />
                <label className={`${labelClass} md:col-span-2 lg:col-span-4`}>
                  <span>Description</span>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={creature.description ?? ""}
                    onChange={(event) =>
                      update(creature.id, {
                        description: event.target.value || null,
                      })
                    }
                  />
                </label>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/45">
                  Attack
                </p>
                <p className="mb-2 text-xs text-white/40">
                  Attack style decides which evasion can avoid the strike.
                  Physical damage is reduced by armor, magic damage by magic
                  resist, and elemental damage by the matching resistance.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                  <label className={labelClass}>
                    <span>Attack style</span>
                    <select
                      className={inputClass}
                      value={creature.attackStyle}
                      onChange={(event) =>
                        update(creature.id, {
                          attackStyle: event.target
                            .value as CreatureAttackStyle,
                        })
                      }
                    >
                      <option value="MELEE">Melee</option>
                      <option value="RANGED">Ranged</option>
                      <option value="MAGIC">Magic</option>
                    </select>
                  </label>
                  {creature.kind === "ANIMAL" ? (
                    <NumberField
                      label="Retaliation chance (0–1)"
                      value={creature.attackChance}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(value) =>
                        update(creature.id, { attackChance: value })
                      }
                    />
                  ) : null}
                  <NumberField
                    label="Physical damage min"
                    value={creature.damageMin}
                    min={0}
                    onChange={(value) =>
                      update(creature.id, { damageMin: value })
                    }
                  />
                  <NumberField
                    label="Physical damage max"
                    value={creature.damageMax}
                    min={0}
                    onChange={(value) =>
                      update(creature.id, { damageMax: value })
                    }
                  />
                  <NumberField
                    label="Magic damage min"
                    value={creature.magicDamageMin}
                    min={0}
                    onChange={(value) =>
                      update(creature.id, { magicDamageMin: value })
                    }
                  />
                  <NumberField
                    label="Magic damage max"
                    value={creature.magicDamageMax}
                    min={0}
                    onChange={(value) =>
                      update(creature.id, { magicDamageMax: value })
                    }
                  />
                  <label className={labelClass}>
                    <span>Damage type</span>
                    <select
                      className={inputClass}
                      value={creature.damageType ?? ""}
                      onChange={(event) =>
                        update(creature.id, {
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
                  </label>
                  <NumberField
                    label="Elemental damage min"
                    value={creature.elementalDamageMin}
                    min={0}
                    disabled={!creature.damageType}
                    onChange={(value) =>
                      update(creature.id, { elementalDamageMin: value })
                    }
                  />
                  <NumberField
                    label="Elemental damage max"
                    value={creature.elementalDamageMax}
                    min={0}
                    disabled={!creature.damageType}
                    onChange={(value) =>
                      update(creature.id, { elementalDamageMax: value })
                    }
                  />
                  <NumberField
                    label="Crit chance %"
                    value={creature.critChance}
                    min={0}
                    max={100}
                    step={0.5}
                    onChange={(value) =>
                      update(creature.id, { critChance: value })
                    }
                  />
                  <NumberField
                    label="Crit damage % (150 = ×1.5)"
                    value={creature.critDamage}
                    min={0}
                    step={5}
                    onChange={(value) =>
                      update(creature.id, { critDamage: value })
                    }
                  />
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/45">
                  Defence
                </p>
                <p className="mb-2 text-xs text-white/40">
                  Used in dungeons only. Hunting ignores these because every
                  hunt is a guaranteed kill; leave them at 0 for animals.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
                  <NumberField
                    label="Health"
                    value={creature.health}
                    min={0}
                    onChange={(value) => update(creature.id, { health: value })}
                  />
                  <NumberField
                    label="Armor"
                    value={creature.armor}
                    min={0}
                    onChange={(value) => update(creature.id, { armor: value })}
                  />
                  <NumberField
                    label="Magic resist"
                    value={creature.magicResist}
                    min={0}
                    onChange={(value) =>
                      update(creature.id, { magicResist: value })
                    }
                  />
                  <NumberField
                    label="Evasion % (max 75)"
                    value={creature.evasion}
                    min={0}
                    max={75}
                    step={0.5}
                    onChange={(value) =>
                      update(creature.id, { evasion: value })
                    }
                  />
                  <NumberField
                    label="Block % (max 75)"
                    value={creature.blockChance}
                    min={0}
                    max={75}
                    step={0.5}
                    onChange={(value) =>
                      update(creature.id, { blockChance: value })
                    }
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-white/45">
                    <tr>
                      <th className="p-2">Drop item</th>
                      <th className="p-2">Chance (0–1)</th>
                      <th className="p-2">Min</th>
                      <th className="p-2">Max</th>
                      <th className="p-2">{copy.levelLabel}</th>
                      <th className="p-2">Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {creature.drops.map((drop, index) => (
                      <tr
                        className="border-t border-white/10"
                        key={`${creature.id}-${drop.itemId}-${index}`}
                      >
                        <td className="p-2">
                          <select
                            className={inputClass}
                            value={drop.itemId}
                            onChange={(event) => {
                              const item = props.items.find(
                                (option) =>
                                  option.id === Number(event.target.value),
                              );
                              if (item) {
                                updateDrop(creature, index, {
                                  itemId: item.id,
                                  item,
                                });
                              }
                            }}
                          >
                            {props.items.map((item) => (
                              <option value={item.id} key={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            className={inputClass}
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={drop.baseChance}
                            onChange={(event) =>
                              updateDrop(creature, index, {
                                baseChance: Number(event.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <input
                            className={inputClass}
                            type="number"
                            min={1}
                            value={drop.minQuantity}
                            onChange={(event) =>
                              updateDrop(creature, index, {
                                minQuantity: Number(event.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <input
                            className={inputClass}
                            type="number"
                            min={1}
                            value={drop.maxQuantity}
                            onChange={(event) =>
                              updateDrop(creature, index, {
                                maxQuantity: Number(event.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <input
                            className={inputClass}
                            type="number"
                            min={1}
                            value={drop.requiredLevel}
                            onChange={(event) =>
                              updateDrop(creature, index, {
                                requiredLevel: Number(event.target.value),
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className={inputClass}
                            value={drop.enabled ? "yes" : "no"}
                            onChange={(event) =>
                              updateDrop(creature, index, {
                                enabled: event.target.value === "yes",
                              })
                            }
                          >
                            <option value="yes">Enabled</option>
                            <option value="no">Disabled</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Remove drop"
                            onClick={() =>
                              update(creature.id, {
                                drops: creature.drops.filter(
                                  (_, dropIndex) => dropIndex !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-between gap-3">
                <Button variant="secondary" onClick={() => addDrop(creature)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add drop
                </Button>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="destructive"
                    onClick={() => void remove(creature)}
                    disabled={busyId === creature.id}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {copy.noun}
                  </Button>
                  <Button
                    onClick={() => void save(creature)}
                    disabled={busyId === creature.id}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {busyId === creature.id ? "Saving…" : `Save ${copy.noun}`}
                  </Button>
                </div>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
