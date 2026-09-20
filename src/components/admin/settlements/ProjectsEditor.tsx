"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { CirclePlus, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  adminRequest,
  EnabledField,
  Field,
  inputClass,
  NumberField,
  NumberInput,
  Panel,
} from "~/components/admin/fields";
import { SearchSelect, type SearchOption } from "~/components/admin/SearchSelect";
import { AssetPreview } from "~/components/admin/settlements/SettlementForm";
import { Button } from "~/components/ui/button";
import { contributionShare } from "~/server/settlements/rules";

type AdminProject = {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  enabled: boolean;
  sortOrder: number;
  completedAt: string | null;
  updatedAt: string;
  requirements: Array<{ itemId: number; quantity: number; contributed: number }>;
  contributors: number;
  /** Labels of the content that stays hidden until this project completes. */
  unlocks: string[];
};

function percent(value: number) {
  return `${Math.floor(value * 100)}%`;
}

function ProjectCard(props: {
  project: AdminProject;
  items: SearchOption[];
  settlementId: number;
}) {
  const router = useRouter();
  const { project } = props;
  const [draft, setDraft] = useState(project);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(project);
  const update = (patch: Partial<AdminProject>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const updateRequirement = (
    index: number,
    patch: Partial<AdminProject["requirements"][number]>,
  ) =>
    update({
      requirements: draft.requirements.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    });
  const progress = contributionShare(project.requirements);

  const save = async () => {
    setBusy(true);
    try {
      await adminRequest(`/api/admin/community-projects/${project.id}`, "PATCH", {
        settlementId: props.settlementId,
        name: draft.name,
        description: draft.description,
        image: draft.image,
        enabled: draft.enabled,
        sortOrder: draft.sortOrder,
        requirements: draft.requirements.map(({ itemId, quantity }) => ({
          itemId,
          quantity,
        })),
      });
      toast.success(`${draft.name} saved`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const warning =
      project.unlocks.length > 0
        ? ` The ${project.unlocks.length} things it unlocks will become visible to everyone.`
        : "";
    if (
      !window.confirm(
        `Delete ${project.name} and every contribution to it?${warning}`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await adminRequest(`/api/admin/community-projects/${project.id}`, "DELETE");
      toast.success(`${project.name} deleted`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
      setBusy(false);
    }
  };

  return (
    <details className="rounded-xl border border-white/10 bg-black/15">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <AssetPreview src={project.image} width={64} height={40} />
        <span className="min-w-0 flex-1">
          <strong className="block truncate">{project.name}</strong>
          <small className="text-white/45">
            {project.requirements.length} items needed · {percent(progress)}{" "}
            done · {project.contributors} contributors
          </small>
        </span>
        <span
          className={
            project.completedAt
              ? "text-xs text-emerald-300"
              : project.enabled
                ? "text-xs text-amber-300"
                : "text-xs text-white/35"
          }
        >
          {project.completedAt
            ? "Completed"
            : project.enabled
              ? "Open"
              : "Disabled"}
        </span>
      </summary>
      <div className="space-y-5 border-t border-white/10 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Name">
            <input
              className={inputClass}
              value={draft.name}
              maxLength={120}
              onChange={(event) => update({ name: event.target.value })}
            />
          </Field>
          <Field label="Image path" hint="Optional, e.g. /assets/projects/bridge.png">
            <input
              className={inputClass}
              value={draft.image ?? ""}
              maxLength={191}
              onChange={(event) =>
                update({ image: event.target.value.trim() || null })
              }
            />
          </Field>
          <EnabledField
            value={draft.enabled}
            onChange={(enabled) => update({ enabled })}
            hint="Disabled projects are hidden and take no contributions."
          />
          <NumberField
            label="Sort order"
            value={draft.sortOrder}
            onChange={(sortOrder) => update({ sortOrder })}
          />
          <Field
            label="Description"
            hint="Tell players what completing it will change; they can't see what it unlocks."
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

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Items needed
          </p>
          <p className="text-xs text-white/40">
            Players hand in any rarity. The project completes when every item
            is fully supplied. Removing an item deletes what players gave for
            it; raising a quantity on a completed project reopens it.
          </p>
          {draft.requirements.length === 0 ? (
            <p className="text-sm text-white/45">
              No items yet. A project without items never completes.
            </p>
          ) : null}
          {draft.requirements.map((requirement, index) => (
            <div
              key={`${requirement.itemId}-${index}`}
              className="grid items-center gap-3 rounded-lg bg-black/20 p-2 md:grid-cols-[minmax(0,2fr)_140px_minmax(0,1fr)_auto]"
            >
              <SearchSelect
                options={props.items}
                value={requirement.itemId}
                onChange={(itemId) => {
                  if (itemId) updateRequirement(index, { itemId });
                }}
              />
              <NumberInput
                className={inputClass}
                aria-label="Quantity needed"
                min={1}
                value={requirement.quantity}
                onValueChange={(quantity) => {
                  if (quantity !== null) {
                    updateRequirement(index, {
                      quantity: Math.max(1, Math.floor(quantity)),
                    });
                  }
                }}
              />
              <div className="text-xs text-white/55">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full bg-emerald-400/70"
                    style={{
                      width: percent(
                        Math.min(1, requirement.contributed / requirement.quantity),
                      ),
                    }}
                  />
                </div>
                <span className="mt-1 block tabular-nums">
                  {Math.min(requirement.contributed, requirement.quantity)} /{" "}
                  {requirement.quantity} supplied
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove item"
                onClick={() =>
                  update({
                    requirements: draft.requirements.filter(
                      (_, rowIndex) => rowIndex !== index,
                    ),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() => {
              const used = new Set(draft.requirements.map((row) => row.itemId));
              const item = props.items.find((option) => !used.has(option.id));
              if (!item) return toast.error("Every item is already needed");
              update({
                requirements: [
                  ...draft.requirements,
                  { itemId: item.id, quantity: 100, contributed: 0 },
                ],
              });
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </div>

        <div className="rounded-lg bg-black/20 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Unlocks when completed
          </p>
          {project.unlocks.length === 0 ? (
            <p className="mt-1 text-white/45">
              Nothing yet. On an NPC, shop item or quest, set “Hidden until
              project” to this project to reveal it on completion.
            </p>
          ) : (
            <ul className="mt-1 list-inside list-disc text-white/70">
              {project.unlocks.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="destructive" onClick={() => void remove()} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete project
          </Button>
          <Button onClick={() => void save()} disabled={busy || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {busy ? "Saving…" : dirty ? "Save project" : "Saved"}
          </Button>
        </div>
      </div>
    </details>
  );
}

export function ProjectsEditor(props: {
  settlementId: number;
  projects: AdminProject[];
  items: SearchOption[];
}) {
  const router = useRouter();
  const create = async () => {
    try {
      await adminRequest("/api/admin/community-projects", "POST", {
        settlementId: props.settlementId,
        name: `New project ${props.projects.length + 1}`,
        description: null,
        image: null,
        enabled: false,
        sortOrder: 0,
        requirements: [],
      });
      toast.success("Project created (disabled). Add the items it needs.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create");
    }
  };

  return (
    <Panel
      title="Community projects"
      description="Goals every player in the world works on together by handing in items. Completing one reveals the NPCs, shop items and quests set to be hidden until it is done. Players see a contributor leaderboard."
      action={
        <Button variant="secondary" onClick={() => void create()}>
          <CirclePlus className="mr-2 h-4 w-4" />
          New project
        </Button>
      }
    >
      <div className="space-y-3">
        {props.projects.length === 0 ? (
          <p className="text-sm text-white/45">No projects here yet.</p>
        ) : null}
        {props.projects.map((project) => (
          <ProjectCard
            // Remount when the saved row changes so drafts reset after saving.
            key={`${project.id}:${project.updatedAt}`}
            project={project}
            items={props.items}
            settlementId={props.settlementId}
          />
        ))}
      </div>
    </Panel>
  );
}
