"use client";

import React, { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";

type LocationRow = {
  id: number;
  name: string;
};

type AssignedRow = {
  locationId: number;
  enabled: boolean;
};

export function ResourceLocationsEditor(props: {
  resourceId: number;
  locations: LocationRow[];
  assigned: AssignedRow[];
}) {
  const [selected, setSelected] = useState<Set<number>>(() => {
    const set = new Set<number>();
    for (const a of props.assigned) {
      if (a.enabled) set.add(a.locationId);
    }
    return set;
  });

  const [isSaving, setIsSaving] = useState(false);

  const locationsSorted = useMemo(() => {
    return [...props.locations].sort((a, b) => a.name.localeCompare(b.name));
  }, [props.locations]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/vocations/resources/${props.resourceId}/locations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationIds: Array.from(selected) }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "Failed to save");
        return;
      }

      window.location.reload();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Available locations</div>
          <div className="text-xs text-white/60">Assign this resource to locations.</div>
        </div>
        <Button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save locations"}
        </Button>
      </div>

      <div className="divide-y divide-gray-800/60 overflow-hidden rounded-md border border-gray-800/60">
        {locationsSorted.map((loc) => {
          const checked = selected.has(loc.id);
          return (
            <label
              key={loc.id}
              className="flex cursor-pointer items-center justify-between gap-3 bg-gray-900/20 px-3 py-2 hover:bg-gray-900/35"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-white">
                  {loc.name}
                  <span className="ml-2 text-xs text-white/50">#{loc.id}</span>
                </div>
              </div>

              <input
                type="checkbox"
                className="h-4 w-4 accent-white"
                checked={checked}
                onChange={() => toggle(loc.id)}
              />
            </label>
          );
        })}

        {locationsSorted.length === 0 ? (
          <div className="p-3 text-sm text-white/60">No locations yet.</div>
        ) : null}
      </div>
    </div>
  );
}
