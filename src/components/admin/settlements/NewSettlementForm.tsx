"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { CirclePlus } from "lucide-react";
import toast from "react-hot-toast";
import { adminRequest, Field, inputClass, Panel } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import type { SettlementKind } from "~/generated/prisma/enums";
import { SETTLEMENT_KIND_LABELS } from "~/game/settlements";

export function NewSettlementForm(props: {
  locations: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(props.locations[0]?.id ?? 0);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SettlementKind>("VILLAGE");
  const [saving, setSaving] = useState(false);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await adminRequest("/api/admin/settlements", "POST", {
        locationId,
        name,
        kind,
        description: null,
        image: null,
        enabled: false,
        sortOrder: 0,
      });
      const settlement = result?.settlement as { id: number };
      toast.success("Settlement created (disabled). Set it up, then enable it.");
      router.push(`/admin/settlements/${settlement.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create");
      setSaving(false);
    }
  };

  return (
    <Panel
      title="New settlement"
      description="It starts disabled, so players won't see it until you enable it."
    >
      {props.locations.length === 0 ? (
        <p className="text-sm text-white/45">Create a world location first.</p>
      ) : (
        <form
          onSubmit={(event) => void create(event)}
          className="grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <Field label="Location">
            <select
              className={inputClass}
              value={locationId}
              onChange={(event) => setLocationId(Number(event.target.value))}
            >
              {props.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name">
            <input
              className={inputClass}
              value={name}
              required
              maxLength={120}
              placeholder="e.g. Tenreed"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Kind">
            <select
              className={inputClass}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as SettlementKind)
              }
            >
              {Object.entries(SETTLEMENT_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={saving || !name.trim()}>
            <CirclePlus className="mr-2 h-4 w-4" />
            {saving ? "Creating…" : "Create"}
          </Button>
        </form>
      )}
    </Panel>
  );
}
