"use client";

import React, { useState } from "react";
import { Route, Save } from "lucide-react";
import toast from "react-hot-toast";
import {
  adminRequest,
  inputClass,
  NumberField,
  NumberInput,
} from "~/components/admin/fields";
import { formatDuration } from "~/components/game/actions/format";
import { Button } from "~/components/ui/button";
import { toTravelRoutePair } from "~/game/world/travel";
import { cn } from "~/lib/utils";

type LocationRow = { id: number; name: string };
type RouteRow = { locationAId: number; locationBId: number; seconds: number };
/** Base seconds per "aId:bId" pair; missing pairs use the default. */
type RouteSeconds = Record<string, number>;

function pairKey(fromId: number, toId: number) {
  const pair = toTravelRoutePair(fromId, toId);
  return `${pair.locationAId}:${pair.locationBId}`;
}

function toMinutes(seconds: number | undefined) {
  return seconds === undefined ? null : Number((seconds / 60).toFixed(2));
}

function sameRoutes(a: RouteSeconds, b: RouteSeconds) {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  );
}

export function TravelRoutesEditor(props: {
  locations: LocationRow[];
  routes: RouteRow[];
  defaultSeconds: number;
}) {
  const initialRoutes = Object.fromEntries(
    props.routes.map((r) => [`${r.locationAId}:${r.locationBId}`, r.seconds]),
  );
  const [saved, setSaved] = useState({
    defaultSeconds: props.defaultSeconds,
    routes: initialRoutes,
  });
  const [defaultSeconds, setDefaultSeconds] = useState(props.defaultSeconds);
  const [routes, setRoutes] = useState<RouteSeconds>(initialRoutes);
  const [saving, setSaving] = useState(false);

  const dirty =
    defaultSeconds !== saved.defaultSeconds ||
    !sameRoutes(routes, saved.routes);

  const setRoute = (key: string, minutes: number | null) =>
    setRoutes((current) => {
      const next = { ...current };
      if (minutes === null || minutes <= 0) delete next[key];
      else next[key] = Math.max(1, Math.round(minutes * 60));
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await adminRequest("/api/admin/travel", "PATCH", {
        defaultSeconds,
        routes: Object.entries(routes).map(([key, seconds]) => {
          const [locationAId, locationBId] = key.split(":").map(Number);
          return { locationAId, locationBId, seconds };
        }),
      });
      setSaved({ defaultSeconds, routes });
      toast.success("Travel times saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-xl bg-gray-950/45 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Route className="h-4 w-4 text-amber-300" aria-hidden="true" />
            Travel time between locations
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            Minutes to travel between two locations at{" "}
            <strong className="text-white/70">100% movement speed</strong>. A
            pair has one time in both directions, so editing either cell edits
            both. Travel time is divided by the character&apos;s movement speed:
            at 125% a 60 minute route takes 48 minutes, at 80% it takes 75.
            Empty cells use the default below.
          </p>
        </div>
        <Button onClick={() => void save()} disabled={saving || !dirty}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
        </Button>
      </div>

      <NumberField
        label="Default travel time"
        className="w-56"
        suffix="min"
        min={1}
        step={1}
        value={Number((defaultSeconds / 60).toFixed(2))}
        onChange={(minutes) =>
          setDefaultSeconds(Math.max(1, Math.round(minutes * 60)))
        }
        hint={`Used for any pair without its own time (${formatDuration(defaultSeconds)}).`}
      />

      <div className="overflow-x-auto rounded-xl bg-white/[0.02]">
        <table className="text-sm">
          <thead className="text-xs text-white/45">
            <tr>
              <th className="sticky left-0 bg-gray-950 px-3 py-2 text-left font-medium">
                From \ To
              </th>
              {props.locations.map((location) => (
                <th
                  key={location.id}
                  className="min-w-[7rem] px-2 py-2 text-right font-medium"
                >
                  {location.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.locations.map((from) => (
              <tr key={from.id} className="border-t border-white/5">
                <th className="sticky left-0 whitespace-nowrap bg-gray-950 px-3 py-1.5 text-left font-medium text-white/80">
                  {from.name}
                </th>
                {props.locations.map((to) => {
                  if (from.id === to.id) {
                    return (
                      <td
                        key={to.id}
                        className="px-2 py-1.5 text-right text-white/20"
                      >
                        —
                      </td>
                    );
                  }
                  const key = pairKey(from.id, to.id);
                  const seconds = routes[key];
                  const changed = seconds !== saved.routes[key];
                  return (
                    <td
                      key={to.id}
                      className={cn(
                        "px-2 py-1.5",
                        changed && "bg-amber-400/[0.06]",
                      )}
                    >
                      <NumberInput
                        aria-label={`${from.name} to ${to.name} in minutes`}
                        className={cn(inputClass, "w-24 py-1.5 text-right")}
                        min={0}
                        step="any"
                        placeholder={String(toMinutes(defaultSeconds))}
                        value={toMinutes(seconds)}
                        onValueChange={(minutes) => setRoute(key, minutes)}
                      />
                      <span className="mt-0.5 block text-right text-[10px] tabular-nums text-white/35">
                        {seconds === undefined
                          ? "default"
                          : formatDuration(seconds)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
