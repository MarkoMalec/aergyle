"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CirclePlus, Save, Trash2 } from "lucide-react";
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
import { AssetPreview } from "./SettlementForm";

type StorageDraft = {
  id: number;
  name: string;
  description: string | null;
  unlockCost: number;
  slots: number;
  enabled: boolean;
};

const DESCRIPTION =
  "A pin on the settlement map. Players rent it once, for gold, and keep items in it while they are here. Every settlement's storage is separate, and only reachable at its location.";

/** The settlement's storage, or the button that gives it one. */
export function StorageEditor(props: {
  settlementId: number;
  storage: StorageDraft | null;
  renters: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await adminRequest("/api/admin/storages", "POST", {
        settlementId: props.settlementId,
        name: "Storage",
        description: null,
        unlockCost: 0,
        slots: 10,
        enabled: false,
      });
      toast.success("Storage created (disabled). Set its cost and place it.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create");
    } finally {
      setBusy(false);
    }
  };

  if (!props.storage) {
    return (
      <Panel
        title="Storage"
        description={DESCRIPTION}
        action={
          <Button
            variant="secondary"
            onClick={() => void create()}
            disabled={busy}
          >
            <CirclePlus className="mr-2 h-4 w-4" />
            Add storage
          </Button>
        }
      >
        <p className="text-sm text-white/45">
          This settlement has no storage yet.
        </p>
      </Panel>
    );
  }

  return <StorageForm storage={props.storage} renters={props.renters} />;
}

function StorageForm(props: { storage: StorageDraft; renters: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState(props.storage);
  const [saved, setSaved] = useState(props.storage);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const update = (patch: Partial<StorageDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const { id, ...body } = draft;
      await adminRequest(`/api/admin/storages/${id}`, "PATCH", body);
      setSaved(draft);
      toast.success("Storage saved");
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
        `Delete ${saved.name}? ${props.renters} player${props.renters === 1 ? "" : "s"} rent it, and everything they keep in it is destroyed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await adminRequest(`/api/admin/storages/${saved.id}`, "DELETE");
      toast.success("Storage deleted");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Storage"
      description={DESCRIPTION}
      action={
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={() => void remove()}
            disabled={busy}
          >
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Name" hint="Shown on the pin and above the window.">
          <input
            className={inputClass}
            value={draft.name}
            maxLength={120}
            onChange={(event) => update({ name: event.target.value })}
          />
        </Field>
        <NumberField
          label="Rent cost"
          hint="Gold, paid once per player."
          value={draft.unlockCost}
          min={0}
          step={0.01}
          suffix="gold"
          onChange={(unlockCost) => update({ unlockCost })}
        />
        <NumberField
          label="Slots"
          hint="Stacks it holds. Lowering it leaves what players stored where it is; they simply cannot open new stacks until they are under the limit."
          value={draft.slots}
          min={1}
          max={500}
          onChange={(slots) => update({ slots })}
        />
        <EnabledField
          value={draft.enabled}
          onChange={(enabled) => update({ enabled })}
          hint="A disabled storage is hidden from players; what they stored stays."
        />
        <Field
          label="Description"
          hint="Optional. Shown while a player has not rented it yet."
          className="md:col-span-2 xl:col-span-4"
        >
          <textarea
            className={inputClass}
            rows={2}
            maxLength={4_000}
            value={draft.description ?? ""}
            onChange={(event) =>
              update({ description: event.target.value || null })
            }
          />
        </Field>
      </div>
      <p className="text-xs text-white/40">
        {props.renters} player{props.renters === 1 ? "" : "s"} rent this
        storage. Place its pin in the settlement map above.
      </p>
    </Panel>
  );
}

/** The chest artwork shared by every storage in the game. */
export function StorageIconForm({ icon }: { icon: string | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState(icon);
  const [saved, setSaved] = useState(icon);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await adminRequest("/api/admin/storages/config", "PATCH", {
        icon: draft,
      });
      setSaved(draft);
      toast.success("Storage icon saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Storage icon"
      description="The chest every settlement's storage uses, on its map pin and above its window. One image for the whole game."
      action={
        <Button onClick={() => void save()} disabled={busy || draft === saved}>
          <Save className="mr-2 h-4 w-4" />
          {busy ? "Saving…" : draft === saved ? "Saved" : "Save"}
        </Button>
      }
    >
      <div className="flex items-end gap-4">
        <AssetPreview src={draft} width={64} height={64} />
        <Field
          label="Icon path"
          hint="e.g. /assets/ui/storage-chest-v1.png. Square artwork works best."
          className="max-w-md flex-1"
        >
          <input
            className={inputClass}
            value={draft ?? ""}
            maxLength={191}
            onChange={(event) => setDraft(event.target.value.trim() || null)}
          />
        </Field>
      </div>
    </Panel>
  );
}
