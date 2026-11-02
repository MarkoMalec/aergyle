"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { Briefcase, Check, Plus, Trash2 } from "lucide-react";
import { adminRequest } from "~/components/admin/fields";
import { controlClass } from "~/components/admin/items/ItemFormControls";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type Profession = { id: number; name: string; npcs: number };

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function ProfessionRow(props: {
  profession: Profession;
  busy: boolean;
  run: (task: () => Promise<void>) => Promise<void>;
}) {
  const { profession } = props;
  const [name, setName] = useState(profession.name);
  const dirty = name.trim() !== profession.name && name.trim() !== "";
  const rename = () =>
    props.run(async () => {
      await adminRequest(`/api/admin/npc-professions/${profession.id}`, "PATCH", {
        name,
      });
      toast.success(`Renamed to ${name.trim()}`);
    });
  const remove = () => {
    if (
      !window.confirm(
        `Delete ${profession.name}? ${profession.npcs} NPC${profession.npcs === 1 ? "" : "s"} will have no profession.`,
      )
    ) {
      return;
    }
    void props.run(async () => {
      await adminRequest(`/api/admin/npc-professions/${profession.id}`, "DELETE");
      toast.success(`${profession.name} deleted`);
    });
  };

  return (
    <li className="flex items-center gap-2">
      <input
        className={controlClass}
        value={name}
        maxLength={120}
        aria-label={`Name of ${profession.name}`}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && dirty) void rename();
        }}
      />
      {dirty ? (
        <Button
          size="sm"
          variant="soft"
          disabled={props.busy}
          onClick={() => void rename()}
          aria-label={`Save ${name.trim()}`}
        >
          <Check className="h-4 w-4" />
        </Button>
      ) : null}
      <span className="w-14 shrink-0 text-right text-xs text-white/40">
        {profession.npcs} NPC{profession.npcs === 1 ? "" : "s"}
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={props.busy}
        aria-label={`Delete ${profession.name}`}
        title="Delete profession"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/30 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

/** Add, rename and delete the professions NPCs can have. */
export function ProfessionsDialog({ professions }: { professions: Profession[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      router.refresh();
    } catch (error) {
      toast.error(errorText(error, "Unable to save"));
    } finally {
      setBusy(false);
    }
  };
  const add = () =>
    run(async () => {
      await adminRequest("/api/admin/npc-professions", "POST", { name: newName });
      toast.success(`${newName.trim()} added`);
      setNewName("");
    });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Briefcase className="mr-2 h-4 w-4" />
        Professions
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>NPC professions</DialogTitle>
            <DialogDescription>
              Shown with an NPC&apos;s name. Choose an NPC&apos;s profession in its
              editor; deleting one leaves its NPCs without a profession.
            </DialogDescription>
          </DialogHeader>
          {professions.length === 0 ? (
            <p className="text-sm text-white/40">No professions yet.</p>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {professions.map((profession) => (
                <ProfessionRow
                  // Starts over from the saved name after each save.
                  key={`${profession.id}-${profession.name}`}
                  profession={profession}
                  busy={busy}
                  run={run}
                />
              ))}
            </ul>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (newName.trim()) void add();
            }}
          >
            <input
              className={controlClass}
              value={newName}
              maxLength={120}
              placeholder="New profession, e.g. Cook"
              onChange={(event) => setNewName(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={busy || !newName.trim()}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
