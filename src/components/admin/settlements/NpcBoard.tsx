"use client";

import Link from "next/link";
import React, { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { adminRequest } from "~/components/admin/fields";
import {
  NpcSummary,
  type NpcSummaryData,
} from "~/components/admin/settlements/NpcSummary";
import type { SettlementKind } from "~/generated/prisma/enums";
import { SETTLEMENT_KIND_LABELS } from "~/game/settlements";
import { cn } from "~/lib/utils";

type BoardNpc = NpcSummaryData & { id: number; settlementId: number | null };

type BoardLocation = {
  id: number;
  name: string;
  settlements: Array<{
    id: number;
    name: string;
    kind: SettlementKind;
    enabled: boolean;
  }>;
};

/** A drop zone: one settlement, or no location when null. */
function DropZone(props: {
  settlementId: number | null;
  header: React.ReactNode;
  empty: string;
  children: React.ReactNode[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: props.settlementId === null ? "none" : `settlement-${props.settlementId}`,
    data: { settlementId: props.settlementId },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg bg-black/20 p-3 transition-colors",
        isOver && "bg-amber-300/10",
      )}
    >
      {props.header}
      {props.children.length === 0 ? (
        <p className="py-5 text-center text-xs text-white/30">{props.empty}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-2">
          {props.children}
        </ul>
      )}
    </div>
  );
}

function NpcCard(props: {
  npc: BoardNpc;
  onDelete: () => void;
  // True right after a drag, so dropping a card on itself doesn't open it.
  suppressClick: React.MutableRefObject<boolean>;
}) {
  const { npc } = props;
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: npc.id });
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      className={cn(
        "relative cursor-grab rounded-lg bg-white/[0.04] transition-colors hover:bg-white/[0.08]",
        isDragging && "opacity-30",
      )}
    >
      <Link
        href={`/admin/npcs/${npc.id}`}
        draggable={false}
        onClick={(event) => {
          if (props.suppressClick.current) event.preventDefault();
        }}
        className="flex items-center gap-3 p-2.5 pr-9"
      >
        <NpcSummary npc={npc} />
      </Link>
      <button
        type="button"
        onClick={props.onDelete}
        aria-label={`Delete ${npc.name}`}
        title="Delete NPC"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-white/25 hover:bg-red-500/15 hover:text-red-300 focus-visible:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function ZoneHeader(props: {
  title: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="min-w-0 truncate text-sm font-medium">{props.title}</span>
      <span className="text-xs text-white/40">{props.detail}</span>
    </div>
  );
}

const npcCount = (count: number) => `${count} NPC${count === 1 ? "" : "s"}`;

/** Every NPC by location; drag one onto a settlement or No location to move it. */
export function NpcBoard(props: {
  locations: BoardLocation[];
  npcs: BoardNpc[];
}) {
  // Moves and deletions made here, on top of the NPCs as last loaded, so a
  // refresh (e.g. after renaming a profession) keeps them.
  const [moved, setMoved] = useState(() => new Map<number, number | null>());
  const [deleted, setDeleted] = useState(() => new Set<number>());
  const npcs = props.npcs
    .filter((npc) => !deleted.has(npc.id))
    .map((npc) =>
      moved.has(npc.id)
        ? { ...npc, settlementId: moved.get(npc.id) ?? null }
        : npc,
    );
  const [activeId, setActiveId] = useState<number | null>(null);
  const suppressClick = useRef(false);
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click opens the NPC.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch drags start on a long press, so the page still scrolls.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 6 },
    }),
  );

  const settlementNames = new Map(
    props.locations.flatMap((location) =>
      location.settlements.map((settlement) => [settlement.id, settlement.name]),
    ),
  );
  const inZone = (settlementId: number | null) =>
    npcs.filter((npc) => npc.settlementId === settlementId);
  const active = npcs.find((npc) => npc.id === activeId) ?? null;

  const setSettlement = (npcId: number, settlementId: number | null) =>
    setMoved((current) => new Map(current).set(npcId, settlementId));

  const move = async (npc: BoardNpc, settlementId: number | null) => {
    if (npc.settlementId === settlementId) return;
    setSettlement(npc.id, settlementId);
    try {
      await adminRequest(`/api/admin/npcs/${npc.id}/settlement`, "PATCH", {
        settlementId,
      });
      toast.success(
        settlementId === null
          ? `${npc.name} has no location now`
          : `${npc.name} moved to ${settlementNames.get(settlementId)}`,
      );
    } catch (error) {
      setSettlement(npc.id, npc.settlementId);
      toast.error(error instanceof Error ? error.message : "Unable to move");
    }
  };

  const remove = async (npc: BoardNpc) => {
    if (
      !window.confirm(
        `Delete ${npc.name}? Its shop and quests are deleted too, including every player's progress on those quests.`,
      )
    ) {
      return;
    }
    try {
      await adminRequest(`/api/admin/npcs/${npc.id}`, "DELETE");
      setDeleted((current) => new Set(current).add(npc.id));
      toast.success(`${npc.name} deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete");
    }
  };

  const cards = (settlementId: number | null) =>
    inZone(settlementId).map((npc) => (
      <NpcCard
        key={npc.id}
        npc={npc}
        onDelete={() => void remove(npc)}
        suppressClick={suppressClick}
      />
    ));
  const unassigned = cards(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active: dragged }) => {
        suppressClick.current = true;
        setActiveId(Number(dragged.id));
      }}
      onDragEnd={({ active: dragged, over }) => {
        setActiveId(null);
        // The click that ends a drag fires before this resets.
        window.setTimeout(() => (suppressClick.current = false));
        const npc = npcs.find((row) => row.id === Number(dragged.id));
        const target = over?.data.current as
          | { settlementId: number | null }
          | undefined;
        if (npc && target) void move(npc, target.settlementId);
      }}
      onDragCancel={() => {
        setActiveId(null);
        window.setTimeout(() => (suppressClick.current = false));
      }}
    >
      <div className="space-y-4">
        <section className="rounded-xl bg-gray-950/45 p-4">
          <DropZone
            settlementId={null}
            empty="Every NPC has a location."
            header={
              <ZoneHeader
                title="No location"
                detail={`${npcCount(unassigned.length)} · hidden from players`}
              />
            }
          >
            {unassigned}
          </DropZone>
        </section>

        {props.locations.map((location) => (
          <section
            key={location.id}
            className="space-y-3 rounded-xl bg-gray-950/45 p-4"
          >
            <h2 className="flex items-baseline gap-2 text-sm font-semibold text-white/80">
              {location.name}
              <span className="text-xs font-normal text-white/40">
                {npcCount(
                  location.settlements.reduce(
                    (sum, settlement) => sum + inZone(settlement.id).length,
                    0,
                  ),
                )}
              </span>
            </h2>
            {location.settlements.length === 0 ? (
              <p className="text-sm text-white/40">
                No settlements yet.{" "}
                <Link href="/admin/settlements" className="underline hover:text-white">
                  Add one
                </Link>{" "}
                to place NPCs here.
              </p>
            ) : (
              location.settlements.map((settlement) => {
                const settlementCards = cards(settlement.id);
                return (
                  <DropZone
                    key={settlement.id}
                    settlementId={settlement.id}
                    empty="No NPCs here yet."
                    header={
                      <ZoneHeader
                        title={
                          <Link
                            href={`/admin/settlements/${settlement.id}`}
                            className="hover:text-amber-200"
                          >
                            {settlement.name}
                          </Link>
                        }
                        detail={[
                          SETTLEMENT_KIND_LABELS[settlement.kind],
                          npcCount(settlementCards.length),
                          ...(settlement.enabled ? [] : ["Disabled"]),
                        ].join(" · ")}
                      />
                    }
                  >
                    {settlementCards}
                  </DropZone>
                );
              })
            )}
          </section>
        ))}
      </div>

      <DragOverlay>
        {active ? (
          <div className="flex cursor-grabbing items-center gap-3 rounded-lg bg-gray-800 p-2.5 pr-9 shadow-2xl shadow-black/60">
            <NpcSummary npc={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
