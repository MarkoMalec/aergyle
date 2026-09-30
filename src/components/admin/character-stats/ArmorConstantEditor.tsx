"use client";

import React, { useState } from "react";
import { Save, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { adminRequest, NumberField, Panel } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import { armorConstant, type CombatConfig } from "~/server/combat/rules";

const PREVIEW_LEVELS = [1, 25, 50, 100, 150, 200, 250, 340];

const whole = (value: number) => Math.round(value).toLocaleString("en-US");

/** Armor K: the armor that halves damage from an attacker of each level. */
export function ArmorConstantEditor(props: { initial: CombatConfig }) {
  const [saved, setSaved] = useState(props.initial);
  const [config, setConfig] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  const dirty =
    config.armorK0 !== saved.armorK0 || config.armorK1 !== saved.armorK1;
  const valid = config.armorK0 + config.armorK1 > 0;

  const save = async () => {
    setSaving(true);
    try {
      await adminRequest("/api/admin/combat-config", "PATCH", config);
      setSaved(config);
      toast.success("Armor K saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title={
        <>
          <Shield className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Armor against each level
        </>
      }
      description={
        <>
          Armor reduces every hit by{" "}
          <span className="font-mono text-white/70">K / (K + armor)</span>,
          where K is the armor that halves damage from an attacker of that
          level. Give on-level gear about K armor for 50%. Dungeons and hunts
          keep the K they started with.
        </>
      }
      action={
        <Button
          onClick={() => void save()}
          disabled={saving || !dirty || !valid}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save armor K"}
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <NumberField
          label="K at level 0"
          hint="The flat part of K."
          value={config.armorK0}
          min={0}
          onChange={(value) => setConfig((row) => ({ ...row, armorK0: value }))}
        />
        <NumberField
          label="K added per attacker level"
          hint="Match how fast gear armor grows per level."
          value={config.armorK1}
          min={0}
          step={0.1}
          onChange={(value) => setConfig((row) => ({ ...row, armorK1: value }))}
        />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm tabular-nums">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-white/45">
              <th className="px-3 py-2 font-medium">Attacker level</th>
              <th className="px-3 py-2 text-right font-medium">K</th>
              <th className="px-3 py-2 text-right font-medium">
                Armor for 50%
              </th>
              <th className="px-3 py-2 text-right font-medium">For 67%</th>
              <th className="px-3 py-2 text-right font-medium">For 80%</th>
            </tr>
          </thead>
          <tbody>
            {PREVIEW_LEVELS.map((level) => {
              const k = armorConstant(level, config);
              return (
                <tr key={level} className="odd:bg-white/[0.03]">
                  <td className="rounded-l-lg px-3 py-1.5">{level}</td>
                  <td className="px-3 py-1.5 text-right text-amber-200">
                    {whole(k)}
                  </td>
                  <td className="px-3 py-1.5 text-right">{whole(k)}</td>
                  <td className="px-3 py-1.5 text-right">{whole(k * 2)}</td>
                  <td className="rounded-r-lg px-3 py-1.5 text-right">
                    {whole(k * 4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
