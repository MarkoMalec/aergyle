"use client";

import React, { useState } from "react";
import { Clock, Save } from "lucide-react";
import toast from "react-hot-toast";
import { adminRequest, NumberField, Panel } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import { formatLength } from "~/components/game/actions/format";
import { VOCATION_DURATION_LIMITS_SECONDS } from "~/server/vocations/constants";

const PREVIEW_CHECK_INS = [1, 2, 3, 4, 6];

/** Hours a day a vocation keeps running for a player checking in this often. */
const hoursPerDay = (checkIns: number, runSeconds: number) =>
  formatLength(Math.min(24 * 3_600, checkIns * runSeconds));

/** One run length shared by every vocational skill. */
export function VocationRunLengthEditor(props: { initialSeconds: number }) {
  const [savedSeconds, setSavedSeconds] = useState(props.initialSeconds);
  const [hours, setHours] = useState(props.initialSeconds / 3_600);
  const [saving, setSaving] = useState(false);
  const seconds = Math.round(hours * 3_600);
  const dirty = seconds !== savedSeconds;
  const valid =
    seconds >= VOCATION_DURATION_LIMITS_SECONDS.min &&
    seconds <= VOCATION_DURATION_LIMITS_SECONDS.max;

  const save = async () => {
    setSaving(true);
    try {
      await adminRequest("/api/admin/vocations/config", "PATCH", {
        maxDurationSeconds: seconds,
      });
      setSavedSeconds(seconds);
      toast.success("Run length saved");
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
          <Clock className="h-4 w-4 text-amber-300" aria-hidden="true" />
          Run length
        </>
      }
      description={
        <>
          The longest a single run of any vocational skill lasts before the
          player has to restart it. Runs already underway keep the length they
          started with. The Leveling and Simulations pages use this value.
        </>
      }
      action={
        <Button
          onClick={() => void save()}
          disabled={saving || !dirty || !valid}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save run length"}
        </Button>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <NumberField
          label="Longest run"
          hint={`Between ${formatLength(VOCATION_DURATION_LIMITS_SECONDS.min)} and ${formatLength(VOCATION_DURATION_LIMITS_SECONDS.max)}.`}
          value={hours}
          min={VOCATION_DURATION_LIMITS_SECONDS.min / 3_600}
          max={VOCATION_DURATION_LIMITS_SECONDS.max / 3_600}
          step={0.25}
          suffix="hours"
          onChange={setHours}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-white/45">
                <th className="px-3 py-2 font-medium">Check-ins a day</th>
                <th className="px-3 py-2 text-right font-medium">
                  Running now
                </th>
                {dirty && valid ? (
                  <th className="px-3 py-2 text-right font-medium">
                    After saving
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {PREVIEW_CHECK_INS.map((checkIns) => (
                <tr key={checkIns} className="odd:bg-white/[0.03]">
                  <td className="rounded-l-lg px-3 py-1.5">{checkIns}</td>
                  <td
                    className={
                      dirty && valid
                        ? "px-3 py-1.5 text-right"
                        : "rounded-r-lg px-3 py-1.5 text-right"
                    }
                  >
                    {hoursPerDay(checkIns, savedSeconds)}
                  </td>
                  {dirty && valid ? (
                    <td className="rounded-r-lg px-3 py-1.5 text-right text-amber-200">
                      {hoursPerDay(checkIns, seconds)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}
