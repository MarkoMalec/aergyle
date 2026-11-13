"use client";

import React, { useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import toast from "react-hot-toast";
import { adminRequest, NumberInput, Panel } from "~/components/admin/fields";
import { SearchSelect } from "~/components/admin/SearchSelect";
import { Button } from "~/components/ui/button";
import { enchantLabel, enchantLevelsFor, type EnchantKind } from "~/game/enchanting";

type Override = { itemId: number; level: number; successChance: number };
type Enchantable = { id: number; name: string; image: string; kind: EnchantKind };

const round = (value: number) => Number(value.toFixed(4));
const withoutLevel = (draft: Record<number, number>, level: number) =>
  Object.fromEntries(Object.entries(draft).filter(([key]) => Number(key) !== level));

export function EnchantOverridesEditor(props: {
  enchantable: Enchantable[];
  initialOverrides: Override[];
}) {
  const [overrides, setOverrides] = useState(props.initialOverrides);
  const [itemId, setItemId] = useState<number | null>(null);
  // Percent per level for the picked item; a missing level uses the level value.
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const byId = useMemo(
    () => new Map(props.enchantable.map((item) => [item.id, item])),
    [props.enchantable],
  );
  const item = itemId === null ? null : byId.get(itemId) ?? null;

  const pick = (id: number | null) => {
    setItemId(id);
    setDraft(
      Object.fromEntries(
        overrides
          .filter((o) => o.itemId === id)
          .map((o) => [o.level, round(o.successChance * 100)]),
      ),
    );
  };

  const save = async () => {
    if (!item) return;
    const mine = Object.entries(draft).map(([level, pct]) => ({
      level: Number(level),
      successChance: round(Math.min(100, Math.max(0, pct)) / 100),
    }));
    setSaving(true);
    try {
      await adminRequest("/api/admin/enchanting/overrides", "POST", {
        itemId: item.id,
        overrides: mine,
      });
      setOverrides((prev) => [
        ...prev.filter((o) => o.itemId !== item.id),
        ...mine.map((o) => ({ itemId: item.id, ...o })),
      ]);
      toast.success("Overrides saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (target: Override) => {
    try {
      await adminRequest("/api/admin/enchanting/overrides", "DELETE", {
        itemId: target.itemId,
        level: target.level,
      });
      setOverrides((prev) => prev.filter((o) => o !== target));
      if (target.itemId === itemId) {
        setDraft((prev) => withoutLevel(prev, target.level));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove");
    }
  };

  const sorted = [...overrides].sort(
    (a, b) =>
      (byId.get(a.itemId)?.name ?? "").localeCompare(byId.get(b.itemId)?.name ?? "") ||
      a.level - b.level,
  );

  return (
    <Panel
      title="Per-item success chances"
      description="Replace the level's success chance for one item. Leave a level empty to use the level value."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <SearchSelect
            options={props.enchantable}
            value={itemId}
            onChange={pick}
            placeholder="Choose an item…"
            className="h-9 border-0"
          />
          {item ? (
            <>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {enchantLevelsFor(item.kind).map((level) => (
                  <label
                    key={level}
                    className="flex items-center justify-between gap-2 rounded-md bg-white/[0.04] px-2 py-1 text-xs text-white/70"
                  >
                    <span className="truncate">{enchantLabel(level)}</span>
                    <NumberInput
                      className="h-7 w-16 rounded-md bg-black/25 px-1.5 text-right text-xs text-white outline-none focus:ring-1 focus:ring-amber-400/60"
                      min={0}
                      max={100}
                      step={0.1}
                      placeholder="%"
                      value={draft[level] ?? null}
                      onValueChange={(v) =>
                        setDraft((prev) =>
                          v === null
                            ? withoutLevel(prev, level)
                            : { ...prev, [level]: v },
                        )
                      }
                    />
                  </label>
                ))}
              </div>
              <Button onClick={() => void save()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save item"}
              </Button>
            </>
          ) : null}
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-sm text-white/40">No overrides yet.</p>
          ) : (
            sorted.map((o) => (
              <div
                key={`${o.itemId}:${o.level}`}
                className="flex items-center gap-2 rounded-md bg-white/[0.04] px-2 py-1 text-xs"
              >
                <span className="min-w-0 flex-1 truncate text-white/85">
                  {byId.get(o.itemId)?.name ?? `#${o.itemId}`}
                </span>
                <span className="text-white/55">{enchantLabel(o.level)}</span>
                <span className="w-14 text-right font-semibold tabular-nums">
                  {round(o.successChance * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="Remove override"
                  className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
                  onClick={() => void remove(o)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}
