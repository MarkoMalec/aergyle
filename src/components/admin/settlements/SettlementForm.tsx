"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { CirclePlus, ImageOff, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  adminRequest,
  EnabledField,
  Field,
  inputClass,
  NumberField,
  Panel,
} from "~/components/admin/fields";
import { Button } from "~/components/ui/button";
import type { SettlementKind } from "~/generated/prisma/enums";
import { SETTLEMENT_KIND_LABELS } from "~/game/settlements";

/** Live preview of a typed asset path; a placeholder until it's valid. */
export function AssetPreview(props: {
  src: string | null;
  width: number;
  height: number;
}) {
  const style = { width: props.width, height: props.height };
  // next/image rejects relative or malformed paths while an admin is typing.
  if (!props.src?.startsWith("/")) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-lg bg-black/30"
        style={style}
      >
        <ImageOff className="h-5 w-5 text-white/25" />
      </span>
    );
  }
  return (
    <Image
      src={props.src}
      alt=""
      width={props.width}
      height={props.height}
      className="shrink-0 rounded-lg bg-black/30 object-cover object-top"
      style={style}
    />
  );
}

type SettlementDraft = {
  id: number;
  locationId: number;
  name: string;
  kind: SettlementKind;
  description: string | null;
  image: string | null;
  enabled: boolean;
  sortOrder: number;
};

export function SettlementForm(props: {
  settlement: SettlementDraft;
  locations: Array<{ id: number; name: string }>;
  npcCount: number;
  projectCount: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(props.settlement);
  const [saved, setSaved] = useState(props.settlement);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const update = (patch: Partial<SettlementDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const { id, ...body } = draft;
      await adminRequest(`/api/admin/settlements/${id}`, "PATCH", body);
      setSaved(draft);
      toast.success("Settlement saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (
      !window.confirm(
        `Delete ${saved.name}? Its ${props.npcCount} NPCs (with their shops, quests and every player's quest progress) and ${props.projectCount} community projects are deleted too. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await adminRequest(`/api/admin/settlements/${saved.id}`, "DELETE");
      toast.success(`${saved.name} deleted`);
      router.push("/admin/settlements");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Details"
      description="What players see at the top of the settlement page. Players only see enabled settlements, and only while they are at its location."
      action={
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
          <Button onClick={() => void save()} disabled={busy || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <AssetPreview src={draft.image} width={240} height={150} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Name">
            <input
              className={inputClass}
              value={draft.name}
              maxLength={120}
              onChange={(event) => update({ name: event.target.value })}
            />
          </Field>
          <Field label="Location" hint="Moving it takes its NPCs and projects along.">
            <select
              className={inputClass}
              value={draft.locationId}
              onChange={(event) =>
                update({ locationId: Number(event.target.value) })
              }
            >
              {props.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kind">
            <select
              className={inputClass}
              value={draft.kind}
              onChange={(event) =>
                update({ kind: event.target.value as SettlementKind })
              }
            >
              {Object.entries(SETTLEMENT_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <EnabledField
            value={draft.enabled}
            onChange={(enabled) => update({ enabled })}
            hint="Disabled settlements are hidden from players."
          />
          <Field
            label="Image path"
            hint="Optional banner, e.g. /assets/settlements/tenreed.png"
            className="md:col-span-2"
          >
            <input
              className={inputClass}
              value={draft.image ?? ""}
              maxLength={191}
              onChange={(event) =>
                update({ image: event.target.value.trim() || null })
              }
            />
          </Field>
          <NumberField
            label="Sort order"
            hint="Lower numbers are listed first in the location."
            value={draft.sortOrder}
            onChange={(sortOrder) => update({ sortOrder })}
          />
          <Field label="Description" className="md:col-span-2 xl:col-span-4">
            <textarea
              className={inputClass}
              rows={3}
              maxLength={4_000}
              value={draft.description ?? ""}
              onChange={(event) =>
                update({ description: event.target.value || null })
              }
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}

export function NewNpcButton({ settlementId }: { settlementId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const result = await adminRequest("/api/admin/npcs", "POST", {
        settlementId,
        name: "New NPC",
        description: null,
        portrait: null,
        headX: null,
        headY: null,
        headSize: null,
        profession: null,
        requiredProjectId: null,
        enabled: false,
        sortOrder: 0,
        offers: [],
      });
      const npc = result?.npc as { id: number };
      toast.success("NPC created (disabled). Give it a name and portrait.");
      router.push(`/admin/npcs/${npc.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create");
      setBusy(false);
    }
  };
  return (
    <Button variant="secondary" onClick={() => void create()} disabled={busy}>
      <CirclePlus className="mr-2 h-4 w-4" />
      New NPC
    </Button>
  );
}
