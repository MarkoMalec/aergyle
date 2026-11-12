"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import toast from "react-hot-toast";
import { adminRequest, Panel } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";

type ResourceRow = {
  id: number;
  actionType: string;
  name: string;
  item?: { name: string } | null;
};

/** Which vocation resources (woodcutting, mining, …) can be worked in a region. */
export function LocationResourcesEditor(props: {
  locationId: number;
  resources: ResourceRow[];
  assigned: Array<{ resourceId: number; enabled: boolean }>;
}) {
  const router = useRouter();
  const initial = useMemo(
    () => props.assigned.filter((a) => a.enabled).map((a) => a.resourceId),
    [props.assigned],
  );
  const [selected, setSelected] = useState(() => new Set(initial));
  const [saving, setSaving] = useState(false);
  const dirty =
    selected.size !== initial.length || initial.some((id) => !selected.has(id));

  const groups = useMemo(() => {
    const map = new Map<string, ResourceRow[]>();
    for (const r of props.resources) {
      map.set(r.actionType, [...(map.get(r.actionType) ?? []), r]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [props.resources]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await adminRequest(`/api/admin/locations/${props.locationId}/resources`, "PATCH", {
        resourceIds: Array.from(selected),
      });
      toast.success("Resources saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel
      title="Vocation resources"
      description="Tick what players can work in this region. Resource stats and recipes live under Vocation resources."
      action={
        <Button onClick={() => void save()} disabled={saving || !dirty}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      }
    >
      {groups.length === 0 ? (
        <p className="text-sm text-white/45">No vocation resources exist yet.</p>
      ) : null}
      {groups.map(([actionType, rows]) => (
        <div key={actionType} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
            {actionType.toLowerCase().replaceAll("_", " ")} ·{" "}
            {rows.filter((r) => selected.has(r.id)).length}/{rows.length}
          </h3>
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2 hover:bg-white/[0.06]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-400"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{r.name}</span>
                  <span className="block truncate text-xs text-white/45">
                    {r.item?.name ?? "No output"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </Panel>
  );
}
