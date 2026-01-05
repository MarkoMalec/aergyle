"use client";

import React, { useMemo, useState } from "react";
import { ItemRarity } from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

type RarityConfigRow = {
  id: number;
  rarity: ItemRarity;
  statMultiplier: number;
  minStats: number;
  maxStats: number;
  bonusStatChance: number;
  color: string;
  displayName: string;
  sortOrder: number;
  upgradeEnabled: boolean;
  nextRarity: ItemRarity | null;
  upgradeCost: number | null;
};

export function RarityConfigForm(props: { initialConfigs: RarityConfigRow[] }) {
  const [rows, setRows] = useState<RarityConfigRow[]>(props.initialConfigs);
  const [isSaving, setIsSaving] = useState(false);

  const rarityValues = useMemo(() => Object.values(ItemRarity), []);

  const updateRow = <K extends keyof RarityConfigRow>(
    rarity: ItemRarity,
    key: K,
    value: RarityConfigRow[K],
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.rarity === rarity ? ({ ...r, [key]: value } as RarityConfigRow) : r)),
    );
  };

  const onSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/rarity/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: rows }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "Failed to save rarity config");
        return;
      }

      // Server returns normalized configs
      if (Array.isArray(json)) {
        setRows(json);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-gray-800/60 p-4 text-sm text-white/70">
        No rarity configs found. Run the init endpoint: <span className="font-mono">POST /api/admin/rarity/init</span>
      </div>
    );
  }

  const inputClassName = "h-8 px-2 text-xs";
  const selectTriggerClassName = "h-8 px-2 text-xs";

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-800/60">
        <table className="w-full text-xs">
          <thead className="bg-gray-900/50 text-white/80">
            <tr>
              {/* <th className="px-2 py-2 text-left">Rarity</th> */}
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Color</th>
              <th className="px-2 py-2 text-right">Mult</th>
              <th className="px-2 py-2 text-right">Min</th>
              <th className="px-2 py-2 text-right">Max</th>
              <th className="px-2 py-2 text-right">Bonus%</th>
              <th className="px-2 py-2 text-right">Order</th>
              <th className="px-2 py-2 text-right">Upgrade</th>
              <th className="px-2 py-2 text-right">Next</th>
              <th className="px-2 py-2 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-800/60">
                {/* <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-white">{r.rarity}</td> */}
                <td className="min-w-[130px] px-2 py-1.5">
                  <Input
                    value={r.displayName}
                    onChange={(e) => updateRow(r.rarity, "displayName", e.target.value)}
                    className={inputClassName}
                  />
                </td>
                <td className="min-w-[160px] px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded border border-gray-800/60"
                      style={{ backgroundColor: r.color || "transparent" }}
                    />
                    <Input
                      value={r.color}
                      onChange={(e) => updateRow(r.rarity, "color", e.target.value)}
                      placeholder="#ffffff"
                      className={inputClassName}
                    />
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right min-w-[60px]">
                  <Input
                    type="number"
                    value={r.statMultiplier}
                    onChange={(e) =>
                      updateRow(r.rarity, "statMultiplier", Number.parseFloat(e.target.value || "0"))
                    }
                    className={inputClassName + " text-right"}
                  />
                </td>
                <td className="px-2 py-1.5 text-right min-w-[50px]">
                  <Input
                    type="number"
                    value={r.minStats}
                    onChange={(e) => updateRow(r.rarity, "minStats", Number.parseInt(e.target.value || "0", 10))}
                    className={inputClassName + " text-right"}
                  />
                </td>
                <td className="px-2 py-1.5 text-right min-w-[50px]">
                  <Input
                    type="number"
                    value={r.maxStats}
                    onChange={(e) => updateRow(r.rarity, "maxStats", Number.parseInt(e.target.value || "0", 10))}
                    className={inputClassName + " text-right"}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Input
                    type="number"
                    value={r.bonusStatChance}
                    onChange={(e) =>
                      updateRow(r.rarity, "bonusStatChance", Number.parseFloat(e.target.value || "0"))
                    }
                    className={inputClassName + " text-right"}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Input
                    type="number"
                    value={r.sortOrder}
                    onChange={(e) => updateRow(r.rarity, "sortOrder", Number.parseInt(e.target.value || "0", 10))}
                    className={inputClassName + " text-right"}
                  />
                </td>
                <td className="min-w-[110px] px-2 py-1.5 text-right">
                  <Select
                    value={String(r.upgradeEnabled)}
                    onValueChange={(v) => updateRow(r.rarity, "upgradeEnabled", v === "true")}
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="min-w-[125px] px-2 py-1.5 text-right">
                  <Select
                    value={r.nextRarity ?? "__null"}
                    onValueChange={(v) =>
                      updateRow(r.rarity, "nextRarity", v === "__null" ? null : (v as ItemRarity))
                    }
                  >
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__null">—</SelectItem>
                      {rarityValues.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="min-w-[80px] px-2 py-1.5 text-right">
                  <Input
                    type="number"
                    value={r.upgradeCost ?? ""}
                    onChange={(e) =>
                      updateRow(
                        r.rarity,
                        "upgradeCost",
                        e.target.value === "" ? null : Number.parseInt(e.target.value, 10),
                      )
                    }
                    className={inputClassName + " text-right"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end">
        <Button onClick={onSave} disabled={isSaving} size="sm" className="h-8 px-3 text-xs">
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
