"use client";

import React, { useMemo, useState } from "react";
import {
  Field,
  inputClass,
  NumberInput,
  Panel,
} from "~/components/admin/fields";
import { SearchSelect } from "~/components/admin/SearchSelect";
import { Button } from "~/components/ui/button";
import {
  VocationalActionType,
  XpActionType,
  type StatType,
} from "~/generated/prisma/enums";
import { cn } from "~/lib/utils";
import { STAT_METADATA, StatCategory } from "~/types/stats";
import {
  ActionButton,
  Empty,
  formatDate,
  fromNow,
  humanize,
  ItemArt,
  Row,
  Tag,
  usePlayerEdit,
} from "./shared";

const CATEGORY_LABELS: Record<StatCategory, string> = {
  [StatCategory.OFFENSIVE]: "Offense",
  [StatCategory.DEFENSIVE]: "Defense",
  [StatCategory.RESISTANCE]: "Resistances",
  [StatCategory.CHARACTER]: "Character",
  [StatCategory.SPECIAL]: "Special",
};

const number = (value: number) =>
  Math.abs(value) < 1e-9
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

function StatsEditor() {
  const { player, run } = usePlayerEdit();
  const saved = useMemo(
    () =>
      Object.fromEntries(player.stats.map((row) => [row.statType, row.bonus])) as Record<
        StatType,
        number
      >,
    [player.stats],
  );
  const [draft, setDraft] = useState(saved);
  const changed = player.stats.some(
    (row) => (draft[row.statType] ?? 0) !== row.bonus,
  );

  const groups = Object.values(StatCategory).map((category) => ({
    category,
    rows: player.stats.filter(
      (row) => STAT_METADATA[row.statType].category === category,
    ),
  }));

  return (
    <Panel
      title="Stats"
      description="Level, equipment and food come from the game and change on their own. Bonus is this character's own addition and stays until you change it; Carrying capacity adds bag slots."
      action={
        <div className="flex gap-2">
          {changed ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(saved)}>
              Discard
            </Button>
          ) : null}
          <ActionButton
            actionKey="stats"
            variant="default"
            disabled={!changed}
            onClick={() =>
              run(
                "stats",
                "/stats",
                "PATCH",
                {
                  stats: Object.entries(draft)
                    .filter(([, value]) => value !== 0)
                    .map(([statType, value]) => ({ statType, value })),
                },
                "Stats saved",
              )
            }
          >
            Save bonuses
          </ActionButton>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-xs text-white/45">
              <th className="py-2 pr-3 font-medium">Stat</th>
              <th className="px-3 py-2 text-right font-medium">Level</th>
              <th className="px-3 py-2 text-right font-medium">Equipment</th>
              <th className="px-3 py-2 text-right font-medium">Food</th>
              <th className="w-36 px-3 py-2 font-medium">Bonus</th>
              <th className="py-2 pl-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.category}>
              <tr>
                <td
                  colSpan={6}
                  className="pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-white/40"
                >
                  {CATEGORY_LABELS[group.category]}
                </td>
              </tr>
              {group.rows.map((row) => {
                const bonus = draft[row.statType] ?? 0;
                const total = row.total - row.bonus + bonus;
                return (
                  <tr key={row.statType} className="even:bg-white/[0.02]">
                    <td className="py-1 pr-3">
                      {STAT_METADATA[row.statType].label}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums text-white/60">
                      {number(row.fromLevel)}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums text-white/60">
                      {number(row.equipment)}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums text-white/60">
                      {number(row.food)}
                    </td>
                    <td className="px-3 py-1">
                      <NumberInput
                        className={cn(
                          inputClass,
                          "h-8 py-1 text-right",
                          bonus !== row.bonus && "border-amber-400/60",
                        )}
                        step={0.1}
                        value={bonus}
                        onValueChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            [row.statType]: value ?? 0,
                          }))
                        }
                      />
                    </td>
                    <td className="py-1 pl-3 text-right font-semibold tabular-nums">
                      {number(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </Panel>
  );
}

function FoodEffect() {
  const { player, options, run } = usePlayerEdit();
  const [itemId, setItemId] = useState<number | null>(null);
  const [minutes, setMinutes] = useState<number | null>(30);
  const foods = useMemo(
    () =>
      options.items
        .filter((item) => item.isFood)
        .map((item) => ({ id: item.id, name: item.name, image: item.sprite })),
    [options.items],
  );
  const effect = player.foodEffect;
  const effectItem = options.items.find((item) => item.id === effect?.itemId);

  return (
    <Panel
      title="Food effect"
      description="One timed food, potion or elixir effect at a time; a new one replaces it."
    >
      {effect ? (
        <Row>
          <ItemArt sprite={effect.sprite} rarity={effectItem?.rarity ?? "COMMON"} />
          <div className="min-w-0 flex-1 text-sm">
            {effect.name}
            <div className="text-xs text-white/50">Ends {fromNow(effect.endsAt)}</div>
          </div>
          <ActionButton
            actionKey="food-remove"
            variant="ghost"
            onClick={() =>
              run("food-remove", "/effects", "DELETE", { type: "food" }, "Effect removed")
            }
          >
            Remove
          </ActionButton>
        </Row>
      ) : (
        <Empty>No effect active.</Empty>
      )}
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_140px_auto] md:items-end">
        <Field label="Start an effect">
          <SearchSelect
            options={foods}
            value={itemId}
            placeholder="Choose a food, potion or elixir…"
            onChange={setItemId}
          />
        </Field>
        <Field label="Minutes">
          <NumberInput
            className={inputClass}
            min={1}
            value={minutes}
            onValueChange={setMinutes}
          />
        </Field>
        <ActionButton
          actionKey="food"
          className="h-9"
          disabled={!itemId || !minutes}
          onClick={() =>
            run("food", "/effects", "POST", { type: "food", itemId, minutes }, "Effect started")
          }
        >
          Start
        </ActionButton>
      </div>
    </Panel>
  );
}

function XpMultipliers() {
  const { player, run } = usePlayerEdit();
  const [name, setName] = useState("Admin boost");
  const [multiplier, setMultiplier] = useState<number | null>(2);
  const [actionType, setActionType] = useState<XpActionType | "">("");
  const [vocation, setVocation] = useState<VocationalActionType | "">("");
  const [expiresAt, setExpiresAt] = useState("");
  const [uses, setUses] = useState<number | null>(null);
  const [stackable, setStackable] = useState(true);

  const add = () =>
    run(
      "multiplier",
      "/effects",
      "POST",
      {
        type: "multiplier",
        name,
        multiplier,
        actionType: actionType || null,
        vocationalActionType: actionType === "VOCATION" && vocation ? vocation : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        usesRemaining: uses,
        stackable,
      },
      "Multiplier added",
    );

  return (
    <Panel
      title="XP multipliers"
      description="Multiply the character XP they earn. Stackable ones multiply together; of the others only the highest counts."
    >
      {player.xpMultipliers.length === 0 ? (
        <Empty>None.</Empty>
      ) : (
        <div className="space-y-2">
          {player.xpMultipliers.map((row) => {
            const expired =
              row.expiresAt !== null && new Date(row.expiresAt).getTime() <= Date.now();
            return (
              <Row key={row.id} className="py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    ×{row.multiplier} {row.name}
                    {!row.isActive || expired ? <Tag tone="bad">Inactive</Tag> : null}
                    {row.stackable ? <Tag>Stacks</Tag> : null}
                  </div>
                  <div className="text-xs text-white/50">
                    {row.actionType ? humanize(row.actionType) : "All XP"}
                    {row.vocationalActionType ? ` · ${humanize(row.vocationalActionType)}` : ""}
                    {" · "}
                    {row.expiresAt ? `expires ${formatDate(row.expiresAt)}` : "never expires"}
                    {row.usesRemaining !== null ? ` · ${row.usesRemaining} uses left` : ""}
                  </div>
                </div>
                <ActionButton
                  actionKey={`multiplier-${row.id}`}
                  variant="ghost"
                  onClick={() =>
                    run(
                      `multiplier-${row.id}`,
                      "/effects",
                      "DELETE",
                      { type: "multiplier", id: row.id },
                      "Multiplier removed",
                    )
                  }
                >
                  Remove
                </ActionButton>
              </Row>
            );
          })}
        </div>
      )}

      <div className="grid gap-3 rounded-lg bg-black/25 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name">
          <input className={inputClass} value={name} maxLength={191} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Multiplier" hint="2 doubles their XP">
          <NumberInput className={inputClass} min={0} step={0.1} value={multiplier} onValueChange={setMultiplier} />
        </Field>
        <Field label="Applies to">
          <select
            className={inputClass}
            value={actionType}
            onChange={(event) => setActionType(event.target.value as XpActionType | "")}
          >
            <option value="">All XP</option>
            {Object.values(XpActionType).map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vocation">
          <select
            className={inputClass}
            value={vocation}
            disabled={actionType !== "VOCATION"}
            onChange={(event) => setVocation(event.target.value as VocationalActionType | "")}
          >
            <option value="">Every vocation</option>
            {Object.values(VocationalActionType).map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expires" hint="Empty never expires">
          <input
            className={inputClass}
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </Field>
        <Field label="Uses" hint="Empty is unlimited">
          <NumberInput className={inputClass} min={1} value={uses} onValueChange={setUses} />
        </Field>
        <Field label="Stacking">
          <select
            className={inputClass}
            value={stackable ? "yes" : "no"}
            onChange={(event) => setStackable(event.target.value === "yes")}
          >
            <option value="yes">Stacks with others</option>
            <option value="no">Highest only</option>
          </select>
        </Field>
        <div className="flex items-end">
          <ActionButton
            actionKey="multiplier"
            className="h-9"
            disabled={!name.trim() || multiplier === null}
            onClick={add}
          >
            Add multiplier
          </ActionButton>
        </div>
      </div>
    </Panel>
  );
}

export function StatsTab() {
  const { player } = usePlayerEdit();
  return (
    <div className="space-y-6">
      {/* A new key after each save resets the draft to the saved bonuses. */}
      <StatsEditor
        key={player.stats.map((row) => `${row.statType}:${row.bonus}`).join("|")}
      />
      <FoodEffect />
      <XpMultipliers />
    </div>
  );
}
