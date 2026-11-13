"use client";

import React, { useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import toast from "react-hot-toast";
import { adminRequest, NumberField, NumberInput, Panel } from "~/components/admin/fields";
import { SearchSelect, type SearchOption } from "~/components/admin/SearchSelect";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  EnchantKind,
  enchantLabel,
  type EnchantGlobalSettings,
} from "~/game/enchanting";

type Material = { itemId: number; quantity: number };
type LevelRow = {
  kind: EnchantKind;
  level: number;
  saved: boolean;
  successChance: number; // 0-1
  goldCost: number;
  statBonusPercent: number;
  dropOnFail: boolean;
  materials: Material[];
};

const cell =
  "h-8 w-full rounded-md bg-black/25 px-2 text-right text-xs text-white outline-none focus:ring-1 focus:ring-amber-400/60";

// Floats like 0.0025 * 100 would otherwise show as 0.25000000000000006.
const round = (value: number, digits = 4) => Number(value.toFixed(digits));

export function EnchantingForm(props: {
  globals: EnchantGlobalSettings;
  levels: LevelRow[];
  items: SearchOption[];
}) {
  const [globals, setGlobals] = useState(props.globals);
  const [rows, setRows] = useState(props.levels);
  const [saving, setSaving] = useState(false);
  const itemName = useMemo(
    () => new Map(props.items.map((item) => [item.id, item.name])),
    [props.items],
  );

  const patch = (kind: EnchantKind, level: number, change: Partial<LevelRow>) =>
    setRows((prev) =>
      prev.map((row) =>
        row.kind === kind && row.level === level ? { ...row, ...change } : row,
      ),
    );

  const save = async () => {
    setSaving(true);
    try {
      await adminRequest("/api/admin/enchanting", "PATCH", {
        globals,
        levels: rows.map(({ saved: _saved, ...row }) => row),
      });
      setRows((prev) => prev.map((row) => ({ ...row, saved: true })));
      toast.success("Enchanting saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <Button onClick={() => void save()} disabled={saving}>
      <Save className="mr-2 h-4 w-4" />
      {saving ? "Saving…" : "Save all"}
    </Button>
  );

  const table = (kind: EnchantKind) => {
    const gear = kind === EnchantKind.GEAR;
    return (
      <div className="w-0 min-w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/60">
              <tr>
                <th className="px-1.5 py-2 text-left font-medium">Level</th>
                <th className="px-1.5 py-2 text-right font-medium">Success %</th>
                <th className="px-1.5 py-2 text-right font-medium">Gold</th>
                <th className="px-1.5 py-2 text-right font-medium">Bonus %</th>
                <th className="px-1.5 py-2 text-left font-medium">On failure</th>
                <th className="px-1.5 py-2 text-left font-medium">Materials</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((row) => row.kind === kind)
                .map((row) => (
                  <tr key={row.level} className="odd:bg-white/[0.03] align-top">
                    <td className="whitespace-nowrap px-1.5 py-1.5 font-semibold text-white">
                      {enchantLabel(row.level)}
                      {row.saved ? null : (
                        <span className="ml-1.5 text-[10px] font-normal text-white/35">
                          default
                        </span>
                      )}
                    </td>
                    <td className="min-w-[80px] px-1.5 py-1.5">
                      <NumberInput
                        className={cell}
                        min={0}
                        max={100}
                        step={0.1}
                        value={round(row.successChance * 100)}
                        onValueChange={(v) =>
                          v !== null && patch(kind, row.level, { successChance: round(v / 100, 6) })
                        }
                      />
                    </td>
                    <td className="min-w-[90px] px-1.5 py-1.5">
                      <NumberInput
                        className={cell}
                        min={0}
                        step={1}
                        value={row.goldCost}
                        onValueChange={(v) =>
                          v !== null && patch(kind, row.level, { goldCost: Math.round(v) })
                        }
                      />
                    </td>
                    <td className="min-w-[80px] px-1.5 py-1.5">
                      <NumberInput
                        className={cell}
                        min={0}
                        step={0.5}
                        value={row.statBonusPercent}
                        onValueChange={(v) =>
                          v !== null && patch(kind, row.level, { statBonusPercent: v })
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1.5">
                      {gear ? (
                        <select
                          className="h-8 rounded-md bg-black/25 px-2 text-xs text-white outline-none focus:ring-1 focus:ring-amber-400/60"
                          value={row.dropOnFail ? "drop" : "keep"}
                          onChange={(e) =>
                            patch(kind, row.level, { dropOnFail: e.target.value === "drop" })
                          }
                        >
                          <option value="keep">Stays</option>
                          <option value="drop">Drops a level</option>
                        </select>
                      ) : (
                        <span className="text-white/50">Item breaks</span>
                      )}
                    </td>
                    <td className="min-w-[230px] px-1.5 py-1.5">
                      <div className="space-y-1">
                        {row.materials.map((material) => (
                          <div key={material.itemId} className="flex items-center gap-1.5">
                            <NumberInput
                              className={cn(cell, "w-16 shrink-0")}
                              min={1}
                              step={1}
                              value={material.quantity}
                              onValueChange={(v) =>
                                v !== null &&
                                patch(kind, row.level, {
                                  materials: row.materials.map((m) =>
                                    m.itemId === material.itemId
                                      ? { ...m, quantity: Math.max(1, Math.round(v)) }
                                      : m,
                                  ),
                                })
                              }
                            />
                            <span className="min-w-0 flex-1 truncate text-white/80">
                              {itemName.get(material.itemId) ?? `#${material.itemId}`}
                            </span>
                            <button
                              type="button"
                              aria-label="Remove material"
                              className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
                              onClick={() =>
                                patch(kind, row.level, {
                                  materials: row.materials.filter(
                                    (m) => m.itemId !== material.itemId,
                                  ),
                                })
                              }
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <SearchSelect
                          options={props.items.filter(
                            (item) => !row.materials.some((m) => m.itemId === item.id),
                          )}
                          value={null}
                          placeholder="+ Add material"
                          className="h-8 border-0 text-xs"
                          onChange={(id) =>
                            id !== null &&
                            patch(kind, row.level, {
                              materials: [...row.materials, { itemId: id, quantity: 1 }],
                            })
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <>
      <Panel
        title="Global settings"
        description="One Save writes these and both tables below."
        action={saveButton}
      >
        <div className="grid gap-5 md:grid-cols-3">
          <NumberField
            label="Pity per failure"
            hint="Success chance added after each failed try at a level, in percentage points."
            suffix="pp"
            min={0}
            max={100}
            step={0.05}
            value={round(globals.pityPerFailure * 100)}
            onChange={(v) => setGlobals({ ...globals, pityPerFailure: round(v / 100, 6) })}
          />
          <NumberField
            label="Pity cap"
            hint="The most pity can add in total, in percentage points."
            suffix="pp"
            min={0}
            max={100}
            step={0.5}
            value={round(globals.pityCap * 100)}
            onChange={(v) => setGlobals({ ...globals, pityCap: round(v / 100, 6) })}
          />
          <NumberField
            label="Level cost divisor"
            hint="Gold = level cost × (1 + item required level ÷ divisor)."
            min={1}
            step={1}
            value={globals.levelCostDivisor}
            onChange={(v) =>
              setGlobals({ ...globals, levelCostDivisor: Math.max(1, Math.round(v)) })
            }
          />
        </div>
      </Panel>

      <Panel
        title="Gear (levels 1-20)"
        description="Weapons and armor. Bonus % is the total bonus on the item's stats at that level, not per step."
      >
        {table(EnchantKind.GEAR)}
      </Panel>

      <Panel
        title="Accessories (Kindled to Ascendant)"
        description="Rings, necklaces and amulets start at Kindled (I) and consume a copy of the item. A failed try always breaks the item."
        action={saveButton}
      >
        {table(EnchantKind.ACCESSORY)}
      </Panel>
    </>
  );
}
