"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CirclePlus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { adminRequest, Field, inputClass } from "~/components/admin/fields";
import { Button } from "~/components/ui/button";

/**
 * Create a region (no locationId) or rename/re-level one. Deleting asks with
 * `deleteWarning`, since a region takes everything placed in it along.
 */
export function LocationForm(props: {
  locationId?: number;
  initialValues?: { name: string; requiredLevel: number };
  deleteWarning?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(props.initialValues?.name ?? "");
  const [requiredLevel, setRequiredLevel] = useState(
    props.initialValues?.requiredLevel ?? 1,
  );
  const [busy, setBusy] = useState(false);
  const editing = props.locationId !== undefined;
  const dirty =
    !editing ||
    name !== props.initialValues?.name ||
    requiredLevel !== props.initialValues?.requiredLevel;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await adminRequest(
        editing ? `/api/admin/locations/${props.locationId}` : "/api/admin/locations",
        editing ? "PATCH" : "POST",
        { name: name.trim(), requiredLevel },
      );
      toast.success(editing ? "Region saved" : "Region created");
      if (editing) router.refresh();
      else router.push(`/admin/world/${(result as { id: number }).id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(props.deleteWarning ?? "Delete this region?")) return;
    setBusy(true);
    try {
      await adminRequest(`/api/admin/locations/${props.locationId}`, "DELETE");
      toast.success("Region deleted");
      router.push("/admin/world");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]"
    >
      <Field label="Name">
        <input
          className={inputClass}
          value={name}
          required
          maxLength={120}
          placeholder="e.g. Greenveil Plains"
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <Field label="Required level">
        <input
          className={inputClass}
          type="number"
          min={1}
          max={500}
          value={requiredLevel}
          onChange={(event) => setRequiredLevel(Number(event.target.value))}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !dirty || !name.trim()}>
          {editing ? (
            <Save className="mr-2 h-4 w-4" />
          ) : (
            <CirclePlus className="mr-2 h-4 w-4" />
          )}
          {editing ? "Save" : "Create region"}
        </Button>
        {editing ? (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => void remove()}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete region</span>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
