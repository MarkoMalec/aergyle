"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  RotateCcw,
  Save,
} from "lucide-react";
import {
  type Announcements,
  closestCenter,
  DndContext,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ItemType, VocationalActionType } from "~/generated/prisma/enums";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getResourceSkillConflict, type SkillItemRules } from "~/game/crafting";
import { cn } from "~/lib/utils";

export type VocationResourceRow = {
  id: number;
  // The skill as saved; the board's layout holds where it sits right now.
  actionType: VocationalActionType;
  name: string;
  itemId: number;
  itemName: string | null;
  itemSprite: string | null;
  itemType: ItemType | null;
  requirementItemTypes: (ItemType | null)[];
  hasRecipeGate: boolean;
  requiredSkillLevel: number;
  defaultSeconds: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  recipeName: string | null;
  enabledLocationIds: number[];
};

// Skill -> its resource ids in display order.
type Layout = Record<string, number[]>;

const SKILLS = Object.values(VocationalActionType)
  .slice()
  .sort((a, b) => a.localeCompare(b));

function layoutOf(resources: VocationResourceRow[]): Layout {
  const layout: Layout = {};
  for (const resource of resources) {
    (layout[resource.actionType] ??= []).push(resource.id);
  }
  return layout;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function parseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

function skillConflict(
  row: VocationResourceRow,
  skill: string,
  itemRules: SkillItemRules,
) {
  // Its saved skill is always a valid way back, even for legacy rows that
  // predate a rule.
  if (skill === row.actionType) return null;
  return getResourceSkillConflict({
    actionType: skill as VocationalActionType,
    outputType: row.itemType,
    requirementTypes: row.requirementItemTypes,
    hasRecipeGate: row.hasRecipeGate,
    itemRules,
  });
}

// A dragged row slides only up and down, and never past its own table body:
// dragging reorders within one skill, the Skill picker moves between skills.
const withinList: Modifier = ({
  transform,
  draggingNodeRect,
  containerNodeRect,
}) => {
  if (!draggingNodeRect || !containerNodeRect) return { ...transform, x: 0 };
  const minY = containerNodeRect.top - draggingNodeRect.top;
  const maxY = containerNodeRect.bottom - draggingNodeRect.bottom;
  return {
    ...transform,
    x: 0,
    y: Math.min(Math.max(transform.y, minY), maxY),
  };
};

/**
 * Moves `ids` (in the order given) to the bottom of `target`. A resource going
 * back to its saved skill returns to its saved slot instead, so undoing a move
 * by hand leaves nothing to save.
 */
function moveToSkill(
  layout: Layout,
  saved: Layout,
  rowsById: Map<number, VocationResourceRow>,
  ids: number[],
  target: string,
): Layout {
  const alreadyThere = new Set(layout[target] ?? []);
  const moving = ids.filter((id) => !alreadyThere.has(id));
  if (moving.length === 0) return layout;

  const movingSet = new Set(moving);
  const next: Layout = {};
  for (const [skill, list] of Object.entries(layout)) {
    next[skill] = list.filter((id) => !movingSet.has(id));
  }

  const targetList = [...(next[target] ?? [])];
  const savedList = saved[target] ?? [];
  for (const id of moving) {
    if (rowsById.get(id)?.actionType === target) {
      const savedIndex = savedList.indexOf(id);
      const insertAt = targetList.findIndex(
        (other) => savedList.indexOf(other) > savedIndex,
      );
      targetList.splice(insertAt === -1 ? targetList.length : insertAt, 0, id);
    } else {
      targetList.push(id);
    }
  }
  next[target] = targetList;
  return next;
}

/**
 * Every vocational resource grouped by skill. Moving a resource to another
 * skill and reordering within a skill are staged, then saved together from the
 * bar at the bottom; only the skill and position change, never requirements.
 */
export function VocationResourcesBoard(props: {
  resources: VocationResourceRow[];
  locationCount: number;
  itemRules: SkillItemRules;
}) {
  const router = useRouter();
  const savedLayout = React.useMemo(
    () => layoutOf(props.resources),
    [props.resources],
  );
  const [layout, setLayout] = React.useState(savedLayout);
  const [rowsById, setRowsById] = React.useState(
    () => new Map(props.resources.map((row) => [row.id, row])),
  );
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRefreshing, startRefresh] = React.useTransition();
  const [pendingLocationsId, setPendingLocationsId] = React.useState<
    number | null
  >(null);

  // Re-sync when the server component sends a fresh list (after a save).
  React.useEffect(() => {
    setLayout(savedLayout);
    setRowsById(new Map(props.resources.map((row) => [row.id, row])));
    setSelected(new Set());
  }, [props.resources, savedLayout]);

  const busy = isSaving || isRefreshing;

  const skillOf = new Map<number, string>();
  for (const [skill, list] of Object.entries(layout)) {
    for (const id of list) skillOf.set(id, skill);
  }

  const changedSkills = SKILLS.filter(
    (skill) =>
      (layout[skill] ?? []).join(",") !== (savedLayout[skill] ?? []).join(","),
  );
  const movedCount = Array.from(rowsById.values()).filter(
    (row) => skillOf.get(row.id) !== row.actionType,
  ).length;
  const isDirty = changedSkills.length > 0;

  // A skill stays on screen while it has resources, or while emptying it is
  // still unsaved.
  const visibleSkills = SKILLS.filter(
    (skill) =>
      (layout[skill]?.length ?? 0) > 0 || (savedLayout[skill]?.length ?? 0) > 0,
  );
  const pageOrder = visibleSkills.flatMap((skill) => layout[skill] ?? []);
  const selectedIds = pageOrder.filter((id) => selected.has(id));

  React.useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const move = (ids: number[], target: string) =>
    setLayout((current) =>
      moveToSkill(current, savedLayout, rowsById, ids, target),
    );

  const moveSelected = (target: string) => {
    const blocked: string[] = [];
    const movable = selectedIds.filter((id) => {
      const row = rowsById.get(id)!;
      const conflict = skillConflict(row, target, props.itemRules);
      if (conflict) blocked.push(`${row.name}: ${conflict}`);
      return !conflict;
    });
    move(movable, target);
    setSelected(new Set());
    if (blocked.length > 0) {
      toast.error(
        `${blocked.length} not moved to ${target}.\n${blocked.slice(0, 3).join("\n")}${blocked.length > 3 ? "\n…" : ""}`,
        { duration: 8000, className: "whitespace-pre-line" },
      );
    }
  };

  const reorder = (skill: string, activeId: number, overId: number) =>
    setLayout((current) => {
      const list = current[skill] ?? [];
      const from = list.indexOf(activeId);
      const to = list.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return current;
      return { ...current, [skill]: arrayMove(list, from, to) };
    });

  const shift = (skill: string, index: number, direction: -1 | 1) => {
    const list = layout[skill] ?? [];
    const neighbour = list[index + direction];
    if (neighbour !== undefined) reorder(skill, list[index]!, neighbour);
  };

  // Briefly highlights a dropped row so the eye can find where it landed.
  const [flashId, setFlashId] = React.useState<number | null>(null);
  const flashTimer = React.useRef<ReturnType<typeof setTimeout>>();
  const flash = (id: number) => {
    clearTimeout(flashTimer.current);
    setFlashId(id);
    flashTimer.current = setTimeout(() => setFlashId(null), 1200);
  };
  React.useEffect(() => () => clearTimeout(flashTimer.current), []);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click on the handle
    // stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const announcementsFor = (skill: string): Announcements => {
    const list = layout[skill] ?? [];
    const name = (id: string | number) =>
      rowsById.get(Number(id))?.name ?? "Resource";
    const position = (id: string | number) =>
      `position ${list.indexOf(Number(id)) + 1} of ${list.length}`;
    return {
      onDragStart: ({ active }) =>
        `Picked up ${name(active.id)} at ${position(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${name(active.id)} moved to ${position(over.id)}.`
          : `${name(active.id)} is outside the list.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `${name(active.id)} dropped at ${position(over.id)}.`
          : `${name(active.id)} dropped back in place.`,
      onDragCancel: ({ active }) =>
        `Reordering cancelled; ${name(active.id)} is back at ${position(active.id)}.`,
    };
  };

  const toggle = (ids: number[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const discard = () => {
    setLayout(savedLayout);
    setSelected(new Set());
  };

  const save = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/vocations/resources/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: changedSkills.map((skill) => ({
            actionType: skill,
            resourceIds: layout[skill] ?? [],
          })),
        }),
      });
      if (!response.ok) {
        throw new Error(await parseError(response, "Unable to save changes"));
      }
      toast.success(
        movedCount > 0
          ? `Saved · ${movedCount} moved to another skill`
          : "Order saved",
      );
      startRefresh(() => router.refresh());
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save changes"));
    } finally {
      setIsSaving(false);
    }
  };

  const setAvailability = async (
    resource: VocationResourceRow,
    everywhere: boolean,
  ) => {
    if (
      !everywhere &&
      !window.confirm(
        `Remove ${resource.name} from every location? Nobody will be able to work it until a location is re-enabled.`,
      )
    ) {
      return;
    }

    setPendingLocationsId(resource.id);
    try {
      const response = await fetch(
        `/api/admin/vocations/resources/${resource.id}/locations`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            everywhere ? { allLocations: true } : { locationIds: [] },
          ),
        },
      );
      if (!response.ok) {
        throw new Error(
          await parseError(response, "Unable to save availability"),
        );
      }
      const body = (await response.json().catch(() => null)) as {
        locationIds?: number[];
      } | null;
      const enabledLocationIds = body?.locationIds ?? [];

      // Patched in place rather than through router.refresh(), so staged
      // moves and reorders survive the toggle.
      setRowsById((current) => {
        const next = new Map(current);
        next.set(resource.id, { ...resource, enabledLocationIds });
        return next;
      });
      toast.success(
        everywhere
          ? `${resource.name} is available in every location`
          : `${resource.name} removed from every location`,
      );
    } catch (error) {
      toast.error(errorMessage(error, "Unable to save availability"));
    } finally {
      setPendingLocationsId(null);
    }
  };

  const confirmLeave = (event: React.MouseEvent) => {
    if (
      isDirty &&
      !window.confirm("Leave without saving your moves and reordering?")
    ) {
      event.preventDefault();
    }
  };

  return (
    <div className="space-y-4">
      {visibleSkills.map((skill) => {
        const ids = layout[skill] ?? [];
        const allSelected =
          ids.length > 0 && ids.every((id) => selected.has(id));
        const changed = changedSkills.includes(skill);

        return (
          <details
            key={skill}
            className="group overflow-hidden rounded-lg border border-gray-800/60 bg-gray-900/30"
            open
          >
            <summary className="cursor-pointer select-none list-none bg-gray-900/40 px-4 py-3 text-sm text-white/90 hover:bg-gray-900/50 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-semibold">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  <span>{skill}</span>
                  {changed ? (
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-200">
                      unsaved
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-white/60">
                  <Link
                    href={`/admin/vocations/rules#${skill}`}
                    className="font-normal underline-offset-2 hover:text-white hover:underline"
                    onClick={confirmLeave}
                  >
                    Item rules
                  </Link>
                  <span>{ids.length} resources</span>
                </div>
              </div>
            </summary>

            {ids.length === 0 ? (
              <div className="p-4 text-sm text-white/60">
                Every resource has been moved out of {skill}.
              </div>
            ) : (
              <DndContext
                id={`vocations-${skill}`}
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[withinList]}
                accessibility={{ announcements: announcementsFor(skill) }}
                onDragEnd={({ active, over }) => {
                  if (!over || active.id === over.id) return;
                  reorder(skill, Number(active.id), Number(over.id));
                  flash(Number(active.id));
                }}
              >
                <div className="overflow-x-auto p-3">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/50 text-white/80">
                      <tr>
                        <th className="w-0 p-3 text-left">
                          <input
                            type="checkbox"
                            aria-label={`Select every ${skill} resource`}
                            className="h-4 w-4 accent-white"
                            checked={allSelected}
                            disabled={busy}
                            onChange={(event) =>
                              toggle(ids, event.target.checked)
                            }
                          />
                        </th>
                        <th className="w-0 p-3 text-left">#</th>
                        <th className="w-0 p-3 text-left"></th>
                        <th className="p-3 text-left">Name</th>
                        <th className="p-3 text-left">Skill</th>
                        <th className="p-3 text-left">Output Item</th>
                        <th className="p-3 text-right">Req Lvl</th>
                        <th className="p-3 text-right">Sec</th>
                        <th className="p-3 text-right">Yield</th>
                        <th className="p-3 text-right">XP</th>
                        <th className="p-3 text-left">Recipe</th>
                        <th className="p-3 text-right">Reqs</th>
                        <th className="p-3 text-center">All locations</th>
                        <th className="p-3 text-right">ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      <SortableContext
                        items={ids}
                        strategy={verticalListSortingStrategy}
                      >
                        {ids.map((id, index) => (
                          <SortableResourceRow
                            key={id}
                            row={rowsById.get(id)!}
                            skill={skill}
                            index={index}
                            count={ids.length}
                            isSelected={selected.has(id)}
                            isFlashing={flashId === id}
                            busy={busy}
                            locationCount={props.locationCount}
                            itemRules={props.itemRules}
                            pendingLocationsId={pendingLocationsId}
                            onToggle={(on) => toggle([id], on)}
                            onShift={(direction) =>
                              shift(skill, index, direction)
                            }
                            onMove={(target) => move([id], target)}
                            onAvailability={(on) =>
                              void setAvailability(rowsById.get(id)!, on)
                            }
                            onOpen={confirmLeave}
                          />
                        ))}
                      </SortableContext>
                    </tbody>
                  </table>
                </div>
              </DndContext>
            )}
          </details>
        );
      })}

      {selectedIds.length > 0 || isDirty ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-700/70 bg-gray-950/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">
                {selectedIds.length} selected
              </span>
              <Select value="" onValueChange={moveSelected} disabled={busy}>
                <SelectTrigger className="h-8 w-[170px] text-xs">
                  <SelectValue placeholder="Move to skill…" />
                </SelectTrigger>
                <SelectContent className="max-w-[320px]">
                  {SKILLS.map((option) => {
                    const candidates = selectedIds.filter(
                      (id) => skillOf.get(id) !== option,
                    );
                    const blocked = candidates.filter(
                      (id) =>
                        skillConflict(
                          rowsById.get(id)!,
                          option,
                          props.itemRules,
                        ) !== null,
                    ).length;
                    return (
                      <SelectItem
                        key={option}
                        value={option}
                        disabled={
                          candidates.length === 0 ||
                          blocked === candidates.length
                        }
                      >
                        {option}
                        {candidates.length === 0 ? (
                          <span className="block text-[11px] text-white/50">
                            Already here
                          </span>
                        ) : blocked > 0 ? (
                          <span className="block text-[11px] text-white/50">
                            {blocked === candidates.length
                              ? "None of the selected fit this skill"
                              : `${blocked} of ${candidates.length} don't fit and stay put`}
                          </span>
                        ) : null}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
                disabled={busy}
              >
                Clear
              </Button>
            </div>
          ) : (
            <div />
          )}

          {isDirty ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-white/70">
                {movedCount > 0 ? `${movedCount} moved · ` : ""}
                Unsaved changes in {changedSkills.join(", ")}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={discard}
                disabled={busy}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Discard
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={busy}>
                <Save className="h-3.5 w-3.5" />
                {busy ? "Saving..." : "Save changes"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SortableResourceRow(props: {
  row: VocationResourceRow;
  skill: string;
  index: number;
  count: number;
  isSelected: boolean;
  isFlashing: boolean;
  busy: boolean;
  locationCount: number;
  itemRules: SkillItemRules;
  pendingLocationsId: number | null;
  onToggle: (on: boolean) => void;
  onShift: (direction: -1 | 1) => void;
  onMove: (target: string) => void;
  onAvailability: (on: boolean) => void;
  onOpen: (event: React.MouseEvent) => void;
}) {
  const { row: r, skill, index } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: r.id, disabled: props.busy });

  const movedFrom = r.actionType !== skill ? r.actionType : null;
  const everywhere =
    props.locationCount > 0 &&
    r.enabledLocationIds.length >= props.locationCount;

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row border-t border-gray-800/60 transition-colors duration-700",
        props.isSelected && "bg-white/[0.04]",
        props.isFlashing && "bg-amber-400/15 duration-0",
        isDragging &&
          "relative z-10 bg-gray-800 shadow-2xl shadow-black/60 ring-1 ring-white/15",
      )}
    >
      <td className="p-3 align-middle">
        <input
          type="checkbox"
          aria-label={`Select ${r.name}`}
          className="h-4 w-4 accent-white"
          checked={props.isSelected}
          disabled={props.busy}
          onChange={(event) => props.onToggle(event.target.checked)}
        />
      </td>
      <td className="py-2 pl-1 pr-2 align-middle">
        <div className="flex items-center gap-1">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder ${r.name}`}
            title="Drag to reorder. With the keyboard: Space, then ↑ ↓, then Space."
            className={cn(
              "flex h-10 w-6 touch-none items-center justify-center rounded text-white/35 hover:bg-gray-800/60 hover:text-white focus-visible:text-white disabled:pointer-events-none disabled:opacity-25 group-hover/row:text-white/70",
              isDragging ? "cursor-grabbing text-white" : "cursor-grab",
            )}
            disabled={props.busy}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex flex-col items-center">
            <button
              type="button"
              aria-label={`Move ${r.name} up`}
              className="rounded p-0.5 text-white/60 hover:bg-gray-800/60 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
              onClick={() => props.onShift(-1)}
              disabled={index === 0 || props.busy}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="font-mono text-[11px] text-white/40">
              {index + 1}
            </span>
            <button
              type="button"
              aria-label={`Move ${r.name} down`}
              className="rounded p-0.5 text-white/60 hover:bg-gray-800/60 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
              onClick={() => props.onShift(1)}
              disabled={index === props.count - 1 || props.busy}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </td>
      <td className="w-[56px]">
        {r.itemSprite ? (
          <Image
            src={r.itemSprite}
            alt={r.itemName ?? r.name}
            width={48}
            height={48}
            draggable={false}
            className="ml-2 h-12 w-12 rounded-md object-contain"
          />
        ) : (
          <div className="h-10 w-10 rounded-md bg-gray-800/60" />
        )}
      </td>
      <td className="p-3">
        <Link
          href={`/admin/vocations/${r.id}`}
          onClick={props.onOpen}
          className="font-semibold text-white hover:underline"
        >
          {r.name}
        </Link>
      </td>
      <td className="p-3">
        <div className="flex flex-col items-start gap-1">
          <Select
            value={skill}
            onValueChange={props.onMove}
            disabled={props.busy}
          >
            <SelectTrigger
              aria-label={`Skill for ${r.name}`}
              className="h-8 w-[150px] text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-w-[320px]">
              {SKILLS.map((option) => {
                const conflict = skillConflict(r, option, props.itemRules);
                return (
                  <SelectItem
                    key={option}
                    value={option}
                    disabled={conflict !== null}
                  >
                    {option}
                    {conflict ? (
                      <span className="block text-[11px] leading-snug text-white/50">
                        {conflict}
                      </span>
                    ) : null}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {movedFrom ? (
            <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] text-amber-200">
              from {movedFrom}
            </span>
          ) : null}
        </div>
      </td>
      <td className="p-3 text-white/80">
        {r.itemName ?? "—"}{" "}
        <span className="font-mono text-white/50">#{r.itemId}</span>
      </td>
      <td className="p-3 text-right text-white/80">{r.requiredSkillLevel}</td>
      <td className="p-3 text-right text-white/80">{r.defaultSeconds}</td>
      <td className="p-3 text-right text-white/80">{r.yieldPerUnit}</td>
      <td className="p-3 text-right text-white/80">{r.xpPerUnit}</td>
      <td className="p-3 text-left text-white/80">{r.recipeName ?? "—"}</td>
      <td className="p-3 text-right text-white/80">
        {r.requirementItemTypes.length}
      </td>
      <td className="p-3">
        <label className="flex cursor-pointer items-center justify-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-white"
            checked={everywhere}
            disabled={
              props.pendingLocationsId !== null || props.locationCount === 0
            }
            onChange={(event) => props.onAvailability(event.target.checked)}
          />
          <span className="w-10 text-left text-xs text-white/60">
            {props.pendingLocationsId === r.id
              ? "..."
              : `${r.enabledLocationIds.length}/${props.locationCount}`}
          </span>
        </label>
      </td>
      <td className="p-3 text-right font-mono text-white/60">{r.id}</td>
    </tr>
  );
}
