"use client";

import React, { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";

type ResourceRow = {
  id: number;
  actionType: string;
  name: string;
  item?: { name: string } | null;
};

type AssignedRow = {
  resourceId: number;
  enabled: boolean;
};

export function LocationResourcesEditor(props: {
  locationId: number;
  resources: ResourceRow[];
  assigned: AssignedRow[];
}) {
  const [selected, setSelected] = useState<Set<number>>(() => {
    const set = new Set<number>();
    for (const a of props.assigned) {
      if (a.enabled) set.add(a.resourceId);
    }
    return set;
  });

  const [isSaving, setIsSaving] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, ResourceRow[]>();
    for (const r of props.resources) {
      const k = r.actionType;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [props.resources]);

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
      const res = await fetch(`/api/admin/locations/${props.locationId}/resources`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceIds: Array.from(selected) }),
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
          <div className="text-sm font-semibold text-white">Resources available here</div>
          <div className="text-xs text-white/60">Grouped by action type. Toggle to enable/disable.</div>
        </div>
        <Button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save availability"}
        </Button>
      </div>

      <div className="space-y-6">
        {groups.map(([actionType, rows]) => (
          <div key={actionType} className="space-y-2">
            <div className="text-xs font-semibold text-white/70">{actionType}</div>
            <div className="divide-y divide-gray-800/60 overflow-hidden rounded-md border border-gray-800/60">
              {rows.map((r) => {
                const checked = selected.has(r.id);
                return (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center justify-between gap-3 bg-gray-900/20 px-3 py-2 hover:bg-gray-900/35"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white">
                        {r.name}
                        <span className="ml-2 text-xs text-white/50">#{r.id}</span>
                      </div>
                      <div className="truncate text-xs text-white/60">
                        Output: {r.item?.name ?? "—"}
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-white"
                      checked={checked}
                      onChange={() => toggle(r.id)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
