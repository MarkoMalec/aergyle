"use client";

import Image from "next/image";
import { useState } from "react";
import {
  closestCenter,
  DndContext as DndKitContext,
  pointerWithin,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ItemDetailsPopoverContent } from "~/components/game/items/ItemDetails";
import { LoadedItemDetails } from "~/components/game/items/ItemInfoPopover";
import { StorageFace } from "~/components/game/map/StorageFace";
import { CoinsIcon } from "~/components/game/ui/coins-icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { formatGold } from "~/lib/marketplace";
import { cn } from "~/lib/utils";
import type {
  StorageSlot,
  StorageStack,
  StorageView,
} from "~/server/settlements";
import { rarityStyle } from "~/utils/rarity-colors";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";
import { PresenceNotice } from "./PresenceNotice";
import { useSettlementAction } from "./useSettlementAction";

type Side = "inventory" | "storage";

/** The slot under the pointer, or the nearest one when it is over a gap. */
const overSlot: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length > 0 ? under : closestCenter(args);
};

/** What a drag carries. */
type DragData = { side: Side; userItemId: number };

/**
 * A stack in its slot: dragged to the other side, clicked to choose it for
 * the arrows, and clicked to open its details card, like anywhere else.
 */
function StorageItem(props: {
  side: Side;
  stack: StorageStack;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { stack } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `${props.side}-${stack.userItemId}`,
      data: {
        side: props.side,
        userItemId: stack.userItemId,
      } satisfies DragData,
      disabled: props.disabled,
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          ref={setNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          // Translate only: dnd-kit also scales a drag to the size of what it
          // is over, which would blow the sprite up over a whole panel.
          style={{
            transform: CSS.Translate.toString(transform),
            zIndex: isDragging ? "var(--z-drag)" : undefined,
          }}
          data-dragging={isDragging}
          className="game-item-trigger"
          onClick={props.onSelect}
          aria-label={`${stack.item.name}, ${stack.rarity.toLowerCase()}${
            stack.quantity > 1 ? `, quantity ${stack.quantity}` : ""
          }. Item details`}
        >
          <Image
            alt={stack.item.name}
            src={stack.item.sprite}
            width={102}
            height={102}
            className="object-contain"
          />
          <ItemRarityMark rarity={stack.rarity} />
          {stack.quantity > 1 ? (
            <div className="game-item-quantity">{stack.quantity}</div>
          ) : null}
        </button>
      </PopoverTrigger>
      <ItemDetailsPopoverContent name={stack.item.name} rarity={stack.rarity}>
        <LoadedItemDetails itemId={stack.item.id} rarity={stack.rarity} />
      </ItemDetailsPopoverContent>
    </Popover>
  );
}

/** One slot on either side: what it holds, and where a drag can land. */
function StorageCell(props: {
  /** Unique among the window's slots; storage cells have no position to use. */
  id: string;
  side: Side;
  /** The inventory slot this is; storage keeps no positions. */
  slotIndex: number | null;
  stack: StorageStack | null;
  selected: boolean;
  receiving: boolean;
  busy: boolean;
  onSelect: (stack: StorageStack) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: props.id,
    data: { side: props.side, slotIndex: props.slotIndex },
  });
  const { colors } = useRarityColors();
  const { stack } = props;

  return (
    <div
      ref={setNodeRef}
      style={
        stack ? rarityStyle(stack.rarity, colors[stack.rarity]) : undefined
      }
      className={cn(
        "game-slot",
        stack && "rarity-frame",
        props.selected && "bg-primary/20",
      )}
      data-rarity={stack?.rarity}
      data-over={props.receiving && isOver}
      aria-label={stack ? undefined : `Empty ${props.side} slot`}
    >
      {stack ? (
        <StorageItem
          side={props.side}
          stack={stack}
          disabled={props.busy}
          onSelect={() => props.onSelect(stack)}
        />
      ) : null}
    </div>
  );
}

/** One side of the window, as a grid of slots. */
function StoragePanel(props: {
  title: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <section className="game-panel-flat min-w-0 p-3">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="game-section-title text-base">{props.title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {props.count}
        </span>
      </div>
      <div className="game-inventory-grid">{props.children}</div>
    </section>
  );
}

/**
 * The storage window: the player's inventory, slot for slot, on one side and
 * this settlement's storage on the other. Drag a stack across, or choose one
 * and use the arrows, which is also how a part of a stack is moved.
 */
export function StorageExchange({ data }: { data: StorageView }) {
  const { run, pending } = useSettlementAction();
  const [selected, setSelected] = useState<DragData | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [draggingFrom, setDraggingFrom] = useState<Side | null>(null);
  // Like the inventory: a small movement is a click, not a drag. Touch waits,
  // so a tap still opens an item and the window still scrolls.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
  );

  if (!data.present) {
    return (
      <PresenceNotice
        traveling={data.traveling}
        locationName={data.storage.settlement.location.name}
      />
    );
  }

  if (!data.unlocked) {
    const cost = data.storage.unlockCost;
    return (
      <div className="game-panel-flat flex flex-col items-center gap-3 p-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
          <StorageFace icon={data.icon} px={56} />
        </span>
        <div>
          <strong className="block">{data.storage.name}</strong>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {data.storage.description ??
              `Keep ${data.storage.slots} stacks here. What you leave stays in ${data.storage.settlement.name}; every settlement has its own storage.`}
          </p>
        </div>
        <Button
          disabled={pending !== null || data.gold < cost}
          onClick={() =>
            void run(
              "storage:unlock",
              "/api/settlements/storage/unlock",
              { settlementId: data.storage.settlement.id },
              () => `${data.storage.name} is yours`,
            )
          }
        >
          {pending ? (
            "Renting…"
          ) : (
            <span className="flex items-center gap-1">
              Rent for <CoinsIcon size={16} /> {formatGold(cost)}
            </span>
          )}
        </Button>
        {data.gold < cost ? (
          <p className="text-xs text-danger">
            You have {formatGold(data.gold)} gold.
          </p>
        ) : null}
      </div>
    );
  }

  const held: StorageSlot[] = data.inventory;
  const find = (where: DragData) =>
    (where.side === "inventory"
      ? held.flatMap((slot) => slot.stack ?? [])
      : data.stored
    ).find((entry) => entry.userItemId === where.userItemId) ?? null;
  const stack = selected ? find(selected) : null;
  // A stack shrinks while it is selected (a partial move), so never offer more.
  const amount = stack ? Math.min(Math.max(1, quantity), stack.quantity) : 1;
  const usedSlots = held.filter((slot) => slot.stack).length;
  const storageFree = Math.max(0, data.storage.slots - data.stored.length);
  const busy = pending !== null;

  const select = (side: Side) => (entry: StorageStack) => {
    setSelected({ side, userItemId: entry.userItemId });
    setQuantity(entry.quantity);
  };
  const move = (
    from: Side,
    moved: StorageStack,
    quantity: number,
    toSlot?: number | null,
  ) => {
    const direction = from === "inventory" ? "DEPOSIT" : "WITHDRAW";
    void run(
      `storage:${direction}`,
      "/api/settlements/storage/move",
      {
        settlementId: data.storage.settlement.id,
        userItemId: moved.userItemId,
        direction,
        quantity,
        toSlot: toSlot ?? null,
      },
      () =>
        direction === "DEPOSIT"
          ? `Stored ${moved.item.name} ×${quantity}`
          : `Took ${moved.item.name} ×${quantity}`,
    ).then((done) => {
      if (done) setSelected(null);
    });
  };
  /** The arrows move the chosen stack, in the amount beside them. */
  const moveSelected = (from: Side) => {
    if (stack) move(from, stack, amount);
  };
  const onDragEnd = (event: DragEndEvent) => {
    setDraggingFrom(null);
    const from = event.active.data.current as DragData | undefined;
    const onto = event.over?.data.current as
      | { side: Side; slotIndex: number | null }
      | undefined;
    // Rearranging a side is the character page's job; this window moves items
    // between the two.
    if (busy || !from || !onto || from.side === onto.side) return;
    const dragged = find(from);
    if (!dragged) return;
    // The amount box belongs to the chosen stack; any other stack moves whole.
    const whole =
      selected?.side !== from.side ||
      selected.userItemId !== dragged.userItemId;
    move(from.side, dragged, whole ? dragged.quantity : amount, onto.slotIndex);
  };

  const cellProps = (side: Side) => ({
    side,
    busy,
    receiving: draggingFrom !== null && draggingFrom !== side,
    onSelect: select(side),
  });

  return (
    <DndKitContext
      sensors={sensors}
      collisionDetection={overSlot}
      onDragStart={(event: DragStartEvent) =>
        setDraggingFrom((event.active.data.current as DragData).side)
      }
      onDragCancel={() => setDraggingFrom(null)}
      onDragEnd={onDragEnd}
      id="storage-exchange"
    >
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)]">
          <StoragePanel
            title="Inventory"
            count={`${usedSlots} / ${held.length} slots`}
          >
            {held.map((slot) => (
              <StorageCell
                key={slot.slotIndex}
                id={`inventory-slot-${slot.slotIndex}`}
                {...cellProps("inventory")}
                slotIndex={slot.slotIndex}
                stack={slot.stack}
                selected={
                  selected?.side === "inventory" &&
                  selected.userItemId === slot.stack?.userItemId
                }
              />
            ))}
          </StoragePanel>

          <div className="flex items-center justify-center gap-2 md:flex-col">
            <Button
              variant="secondary"
              size="icon"
              aria-label={`Store ${stack?.item.name ?? "the chosen item"}`}
              title="Move into the storage"
              disabled={busy || selected?.side !== "inventory"}
              onClick={() => moveSelected("inventory")}
            >
              <ArrowRight className="h-4 w-4 rotate-90 md:rotate-0" />
            </Button>
            {stack && stack.quantity > 1 ? (
              <Input
                type="number"
                aria-label={`How many ${stack.item.name} to move`}
                className="h-9 w-20 text-center"
                min={1}
                max={stack.quantity}
                value={amount}
                onChange={(event) => {
                  const value = Math.floor(Number(event.target.value));
                  setQuantity(Number.isFinite(value) ? value : 1);
                }}
              />
            ) : null}
            <Button
              variant="secondary"
              size="icon"
              aria-label={`Take ${stack?.item.name ?? "the chosen item"} out`}
              title="Move into your inventory"
              disabled={busy || selected?.side !== "storage"}
              onClick={() => moveSelected("storage")}
            >
              <ArrowLeft className="h-4 w-4 rotate-90 md:rotate-0" />
            </Button>
          </div>

          <StoragePanel
            title={data.storage.name}
            count={`${data.stored.length} / ${data.storage.slots} slots`}
          >
            {data.stored.map((stored) => (
              <StorageCell
                key={stored.userItemId}
                id={`storage-stack-${stored.userItemId}`}
                {...cellProps("storage")}
                slotIndex={null}
                stack={stored}
                selected={
                  selected?.side === "storage" &&
                  selected.userItemId === stored.userItemId
                }
              />
            ))}
            {Array.from({ length: storageFree }, (_, index) => (
              <StorageCell
                key={`free-${index}`}
                id={`storage-free-${index}`}
                {...cellProps("storage")}
                slotIndex={null}
                stack={null}
                selected={false}
              />
            ))}
          </StoragePanel>
        </div>

        <p className="text-xs text-muted-foreground">
          {stack
            ? `${stack.item.name}${stack.quantity > 1 ? ` · ${amount} of ${stack.quantity}` : ""} — drag it across, or use the arrows.`
            : "Drag a stack to the other side, or choose one and use the arrows. Click an item to see what it is."}
        </p>
      </div>
    </DndKitContext>
  );
}
