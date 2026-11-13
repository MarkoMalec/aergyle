"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Gem, Plus } from "lucide-react";
import coinIcon from "assets/ui/coins-icon.png";
import { useDndContext } from "~/components/dnd/DnDContext";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import {
  EnchantKind,
  enchantBadge,
  enchantedItemName,
  enchantKindOf,
} from "~/game/enchanting";
import type { ItemEquipTo, ItemRarity } from "~/generated/prisma/enums";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import {
  enchantQueryKeys,
  equipmentQueryKeys,
  inventoryQueryKeys,
  userQueryKeys,
} from "~/lib/query-keys";
import { cn } from "~/lib/utils";
import type { InventorySlotWithItem } from "~/types/inventory";
import type { ItemWithStats } from "~/types/stats";
import { rarityStyle } from "~/utils/rarity-colors";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";
import { EnchantBadge } from "./EnchantBadge";

type Preview = {
  userItemId: number;
  kind: EnchantKind;
  level: number;
  label: string;
  target: number | null;
  targetLabel: string | null;
  chance: number;
  pityFailures: number;
  goldCost: number;
  gold: number;
  failure: "keep" | "drop" | "break";
  materials: Array<{
    itemId: number;
    name: string;
    sprite: string | null;
    rarity: ItemRarity | null;
    quantity: number;
    owned: number;
  }>;
  copyCandidateIds: number[];
};

type Outcome = {
  outcome: "success" | "failed" | "dropped" | "broken";
  level: number;
  label: string;
};

export type EnchantPhase = "idle" | "charging" | Outcome["outcome"];

/** One thing an attempt spends; the player puts it in its slot on the left. */
type Requirement = {
  key: string;
  name: string;
  sprite: string | null;
  quantity: number;
  owned: number;
  accepts: (item: ItemWithStats) => boolean;
};

const SKIP_KEY = "aergyle:enchant-skip-animation";

const FAILURE_TEXT = {
  keep: "On failure you keep the item at its current level.",
  drop: "On failure the item drops one level.",
  break: "On failure both accessories are destroyed.",
} as const;

/** A sure thing charges quickly; a long shot is drawn out. */
export function enchantChargeMs(chance: number) {
  return 2400 + Math.round((1 - Math.min(1, Math.max(0, chance))) * 1600);
}

function resultText(result: Outcome) {
  if (result.outcome === "success") return `Success! Now ${result.label}.`;
  if (result.outcome === "failed") {
    return `The enchant failed. ${result.label ? `Still ${result.label}.` : "The item is unchanged."}`;
  }
  if (result.outcome === "dropped") {
    return `The enchant failed and the item dropped to ${result.label || "unenchanted"}.`;
  }
  return "The enchant failed. Both accessories were destroyed.";
}

async function readError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

const kindOf = (item: ItemWithStats) =>
  enchantKindOf({
    equipTo: item.equipTo as ItemEquipTo | null,
    stackable: item.stackable ?? false,
  });

/** The Enchant button above the bag, and the bench it opens along the bottom of the screen. */
export function EnchantPanel() {
  const [open, setOpen] = useState(false);
  const { inventory, equipment } = useDndContext();
  const { active: isActionActive } = useVocationalActiveActionContext();

  // Gear can be enchanted worn; accessories only from the bag (the server enforces it).
  const worn = new Map<number, ItemWithStats>();
  let wornAccessory = false;
  for (const item of Object.values(equipment)) {
    if (!item) continue;
    const kind = kindOf(item);
    if (kind === EnchantKind.GEAR) worn.set(item.id, item);
    if (kind === EnchantKind.ACCESSORY) wornAccessory = true;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="soft" size="sm">
          <Gem className="h-3.5 w-3.5" aria-hidden />
          Enchant
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-h-dvh max-w-3xl flex-col gap-3 overflow-y-auto border-0 bg-transparent p-0 shadow-none"
      >
        {/* Mounted per opening, so the bench always starts empty. */}
        <EnchantBench
          inventory={inventory}
          worn={[...worn.values()]}
          wornAccessory={wornAccessory}
          isActionActive={isActionActive}
        />
      </SheetContent>
    </Sheet>
  );
}

export function EnchantBench({
  inventory,
  worn,
  wornAccessory,
  isActionActive,
}: {
  inventory: InventorySlotWithItem[];
  /** Worn weapons and armor: they can be enchanted where they are. */
  worn: ItemWithStats[];
  /** A worn accessory exists: say why it isn't offered. */
  wornAccessory: boolean;
  isActionActive: boolean;
}) {
  const { colors } = useRarityColors();
  const queryClient = useQueryClient();
  const router = useRouter();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  );

  // Name, art and rarity never change, so the bench keeps showing an
  // accessory while it breaks. The level comes from the preview or the result.
  const [target, setTarget] = useState<ItemWithStats | null>(null);
  /** Requirement key → the bag item the player put in its slot. */
  const [placed, setPlaced] = useState<Record<string, number>>({});
  const [dragged, setDragged] = useState<ItemWithStats | null>(null);
  const [phase, setPhase] = useState<EnchantPhase>("idle");
  const [chargeMs, setChargeMs] = useState(0);
  // Off only for players who asked their system for less motion.
  const [fx, setFx] = useState(true);
  const [attemptNo, setAttemptNo] = useState(0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Outcome | null>(null);
  const [skip, setSkip] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    try {
      setSkip(window.localStorage.getItem(SKIP_KEY) === "1");
    } catch {
      // A blocked store only costs the player their preference.
    }
    return () => {
      mounted.current = false;
    };
  }, []);

  // A broken accessory is gone: the bench is free for the next item.
  const gone = phase === "broken";
  const hasTarget = target !== null && !gone;
  const preview = useQuery({
    queryKey: enchantQueryKeys.preview(target?.id ?? 0),
    enabled: hasTarget,
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<Preview> => {
      const response = await fetch(`/api/enchanting?userItemId=${target!.id}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await readError(response, "Couldn't load enchanting"));
      }
      return (await response.json()) as Preview;
    },
  });
  const data = hasTarget ? preview.data : undefined;
  const isAccessory = data?.kind === EnchantKind.ACCESSORY;

  const requirements: Requirement[] =
    data && target && data.target !== null
      ? [
          ...(isAccessory
            ? [
                {
                  key: "copy",
                  name: `Spare ${enchantedItemName(target.name, data.level)}`,
                  sprite: target.sprite,
                  quantity: 1,
                  owned: data.copyCandidateIds.length,
                  accepts: (item: ItemWithStats) =>
                    data.copyCandidateIds.includes(item.id),
                },
              ]
            : []),
          ...data.materials.map((m) => ({
            key: `material-${m.itemId}`,
            name: m.name,
            sprite: m.sprite,
            quantity: m.quantity,
            owned: m.owned,
            accepts: (item: ItemWithStats) => item.itemId === m.itemId,
          })),
        ]
      : [];
  const bagItems = inventory.flatMap((slot) => (slot.item ? [slot.item] : []));
  // What sits in each slot: only while that exact stack is still in the bag.
  const placedItems = requirements.map(
    (req) =>
      bagItems.find((item) => item.id === placed[req.key] && req.accepts(item)) ??
      null,
  );
  const inUse = new Set(placedItems.flatMap((item) => (item ? [item.id] : [])));
  if (hasTarget) inUse.add(target.id);

  const cantAfford = data ? data.gold < data.goldCost : false;
  const ready = requirements.every(
    (req, i) => placedItems[i] && req.owned >= req.quantity,
  );
  const canAttempt =
    !!data &&
    data.target !== null &&
    !cantAfford &&
    ready &&
    !pending &&
    !isActionActive;

  const revealed = result !== null && phase !== "idle" && phase !== "charging";
  const shownLevel = revealed
    ? result.level
    : data?.level ?? target?.enchantLevel ?? 0;

  /** Whether the player can pick this bag or worn item up right now. */
  const usable = (item: ItemWithStats, isWorn: boolean) => {
    if (pending || inUse.has(item.id)) return false;
    if (!hasTarget) return isWorn || kindOf(item) !== null;
    return !isWorn && requirements.some((req) => req.accepts(item));
  };

  const place = (item: ItemWithStats, isWorn: boolean) => {
    if (!usable(item, isWorn)) return;
    if (!hasTarget) {
      setTarget(item);
      setPlaced({});
      setResult(null);
      setPhase("idle");
      return;
    }
    const req = requirements.find((r) => r.accepts(item));
    if (req) setPlaced((p) => ({ ...p, [req.key]: item.id }));
  };
  const clearTarget = () => {
    if (pending) return;
    setTarget(null);
    setPlaced({});
    setResult(null);
    setPhase("idle");
  };
  const unplace = (key: string) => {
    if (pending) return;
    setPlaced((p) =>
      Object.fromEntries(Object.entries(p).filter(([k]) => k !== key)),
    );
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    const from = active.data.current?.from as string | undefined;
    const item = active.data.current?.item as ItemWithStats | undefined;
    if (!over || !from || !item) return;
    if (from === "bag" || from === "worn") {
      // The item goes on the right; what it costs goes on the left.
      const onTarget = over.id === "drop-target";
      if (over.id !== "drop-bag" && onTarget === !hasTarget) {
        place(item, from === "worn");
      }
    } else if (over.id === "drop-bag") {
      if (from === "target") clearTarget();
      else unplace(from);
    }
  };

  const attempt = async () => {
    if (!target || !data || !canAttempt) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // "Skip animation" skips the charge filling the lines, not the result.
    const ms = skip || calm ? 0 : enchantChargeMs(data.chance);
    const previewKey = enchantQueryKeys.preview(target.id);
    const copyId = placed.copy;

    setPending(true);
    setResult(null);
    setChargeMs(ms);
    setFx(!calm);
    setAttemptNo((n) => n + 1);
    setPhase(ms > 0 ? "charging" : "idle");
    try {
      // The roll is settled long before the charge ends; the bag and the
      // preview refresh only at the reveal, so nothing gives it away.
      const [outcome] = await Promise.all([
        (async () => {
          const response = await fetch("/api/enchanting", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userItemId: target.id,
              ...(isAccessory && copyId ? { copyUserItemId: copyId } : {}),
            }),
          });
          if (!response.ok) {
            throw new Error(await readError(response, "Enchanting failed"));
          }
          return (await response.json()) as Outcome;
        })(),
        new Promise((resolve) => setTimeout(resolve, ms)),
      ]);

      setResult(outcome);
      setPhase(outcome.outcome);
      // Closed mid-charge: the roll still happened, so say how it went.
      if (!mounted.current) {
        const say = outcome.outcome === "success" ? toast.success : toast.error;
        say(`${target.name}: ${resultText(outcome)}`);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
        queryClient.invalidateQueries({ queryKey: equipmentQueryKeys.all() }),
        queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() }),
        outcome.outcome === "broken"
          ? Promise.resolve()
          : queryClient.invalidateQueries({ queryKey: previewKey }),
      ]);
      router.refresh();
    } catch (error) {
      setPhase("idle");
      // Gold or materials may have moved since the preview.
      void queryClient.invalidateQueries({ queryKey: previewKey });
      toast.error(error instanceof Error ? error.message : "Enchanting failed");
    } finally {
      setPending(false);
    }
  };

  const chanceText = !hasTarget
    ? "—"
    : !data
      ? "…"
      : data.target === null
        ? "MAX"
        : `${Math.round(data.chance * 1000) / 10}%`;
  const goalText =
    revealed && phase === "success"
      ? enchantBadge(result.level)
      : !data
        ? ""
        : data.target === null
          ? "MAX"
          : enchantBadge(data.target);
  const failed = revealed && phase !== "success";
  const boxes = enchantSlotBoxes(requirements.length).boxes;
  const lastUsed = inventory.reduce(
    (last, slot, index) => (slot.item ? index : last),
    -1,
  );
  const hint = !hasTarget
    ? "Drag or tap the item you want to enchant"
    : !data
      ? "Loading…"
      : data.target === null
        ? "Take the item back to enchant another"
        : requirements.length === 0
          ? "No materials needed for this attempt"
          : ready
            ? "Everything is in place"
            : "Drag or tap what the attempt needs";

  return (
    <DndContext
      id="enchant-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) =>
        setDragged((active.data.current?.item as ItemWithStats | undefined) ?? null)
      }
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragged(null)}
    >
      <BagDrop>
        <div className="mb-2 flex items-baseline justify-between gap-3 pr-10">
          <h3 className="game-section-title">Inventory</h3>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <div className="max-h-[36dvh] overflow-y-auto p-1.5">
          {worn.length > 0 && (
            <>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Worn
              </p>
              <div className="game-inventory-grid mb-3">
                {worn.map((item) => (
                  <BagTile
                    key={item.id}
                    item={item}
                    from="worn"
                    state={
                      inUse.has(item.id)
                        ? "placed"
                        : usable(item, true)
                          ? "usable"
                          : "off"
                    }
                    onPlace={() => place(item, true)}
                  />
                ))}
              </div>
            </>
          )}
          <div className="game-inventory-grid">
            {inventory.slice(0, Math.max(lastUsed + 1, 1)).map((slot, index) =>
              slot.item ? (
                <BagTile
                  key={slot.item.id}
                  item={slot.item}
                  from="bag"
                  state={
                    inUse.has(slot.item.id)
                      ? "placed"
                      : usable(slot.item, false)
                        ? "usable"
                        : "off"
                  }
                  onPlace={() => place(slot.item!, false)}
                />
              ) : (
                <div key={`empty-${index}`} className="game-slot" aria-hidden />
              ),
            )}
          </div>
        </div>
        {wornAccessory && (
          <p className="mt-2 text-xs text-muted-foreground">
            Worn rings, necklaces and amulets must be taken off first.
          </p>
        )}
      </BagDrop>

      <section
        className="rounded-t-xl bg-popover bg-[image:radial-gradient(ellipse_at_50%_125%,hsl(var(--primary)/0.2),transparent_65%)] px-3 pb-4 pt-3 shadow-[var(--shadow-overlay)] sm:px-5"
        style={target ? rarityStyle(target.rarity, colors[target.rarity]) : undefined}
      >
        <SheetTitle className="game-eyebrow">Enchanting</SheetTitle>
        <SheetDescription className="text-sm">
          {target ? (
            <>
              <span className="game-item-name font-semibold">
                {enchantedItemName(target.name, shownLevel)}
              </span>
              {data?.targetLabel && (
                <span className="text-muted-foreground">
                  {" "}
                  → {data.targetLabel}
                </span>
              )}
            </>
          ) : (
            "Put a weapon, armor piece or accessory on the right."
          )}
        </SheetDescription>

        <div
          className={cn(
            "relative mx-auto w-full max-w-2xl",
            failed && fx && "animate-enchant-shake",
          )}
        >
          {/* A success: the rarity showcase's rays, turning slowly behind the item. */}
          {fx && revealed && phase === "success" && target && (
            <div
              key={`rays-${attemptNo}`}
              aria-hidden
              className="pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 duration-500 animate-in fade-in"
              style={{
                left: `${(TARGET_X / VIEW.w) * 100}%`,
                top: `${((MID - VIEW.y) / VIEW.h) * 100}%`,
                width: `${((ITEM * 3.2) / VIEW.w) * 100}%`,
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `radial-gradient(circle, ${colors[target.rarity]}2e 0%, ${colors[target.rarity]}10 38%, transparent 68%)`,
                }}
              />
              <div className="absolute inset-0 opacity-60 [mask-image:radial-gradient(circle,#000_18%,transparent_66%)]">
                <div
                  className="h-full w-full animate-[spin_40s_linear_infinite]"
                  style={{
                    background: `repeating-conic-gradient(${colors[target.rarity]} 0deg 5deg, transparent 5deg 20deg)`,
                  }}
                />
              </div>
            </div>
          )}
          <EnchantBenchArt
            key={attemptNo}
            label={
              target
                ? `${enchantedItemName(target.name, shownLevel)}. ${data && data.target !== null ? `Chance to reach ${data.targetLabel}: ${chanceText}.` : ""}`
                : "Empty enchanting bench"
            }
            slotCount={requirements.length}
            goalText={goalText}
            chanceText={chanceText}
            phase={fx ? phase : "idle"}
            won={revealed && phase === "success"}
            broken={phase === "broken"}
            chargeMs={chargeMs}
          />

          {requirements.length === 0 && (
            <BenchSlot id="none" box={boxes[0]!} highlight={false} />
          )}
          {requirements.map((req, i) => (
            <BenchSlot
              key={req.key}
              id={req.key}
              box={boxes[i]!}
              item={placedItems[i]}
              quantity={req.quantity}
              short={req.owned < req.quantity}
              ghost={req}
              dimmed={phase === "charging"}
              locked={pending}
              highlight={!!dragged && dragged.id !== target?.id && req.accepts(dragged)}
              onClear={() => unplace(req.key)}
            />
          ))}
          <BenchSlot
            key={`target-${attemptNo}`}
            id="target"
            box={TARGET_BOX}
            item={hasTarget ? { ...target, enchantLevel: shownLevel } : null}
            // A broken accessory stays just long enough to fall apart.
            leaving={gone && fx ? target : null}
            locked={pending}
            highlight={!!dragged && !hasTarget}
            onClear={clearTarget}
            className={cn(
              phase === "charging" && "animate-enchant-tremble",
              revealed && phase === "success" && "animate-drop-pop",
              (phase === "failed" || phase === "dropped") && "animate-enchant-shake",
            )}
            style={
              phase === "charging"
                ? { animationDelay: `${FLOW.rings[0] * chargeMs}ms` }
                : undefined
            }
          />
        </div>

        <div className="min-h-10 text-center text-sm" role="status">
          {revealed && (
            <p
              className={cn(
                "animate-rise-in font-semibold [animation-duration:0.4s]",
                phase === "success" ? "text-success" : "text-danger",
              )}
            >
              {resultText(result)}
            </p>
          )}
          {/* The risk of the next attempt stays in view under the last result. */}
          {!hasTarget ? null : preview.isError ? (
            <p className="text-danger">{preview.error.message}</p>
          ) : isActionActive ? (
            <p className="text-warning">
              Finish or stop your active action to enchant.
            </p>
          ) : data && data.target === null ? (
            <p className="text-primary">This item is fully enchanted.</p>
          ) : data ? (
            <>
              <p
                className={cn(
                  revealed && "text-xs",
                  data.failure === "break"
                    ? "text-danger"
                    : data.failure === "drop"
                      ? "text-warning"
                      : "text-muted-foreground",
                )}
              >
                {FAILURE_TEXT[data.failure]}
              </p>
              {data.pityFailures > 0 && !revealed && (
                <p className="text-xs text-muted-foreground">
                  Earlier failed attempts have slightly raised your chance.
                </p>
              )}
            </>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            {data && data.target !== null && (
              <>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Cost per attempt
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-base font-semibold tabular-nums",
                      cantAfford ? "text-danger" : "text-currency",
                    )}
                  >
                    <Image src={coinIcon} alt="" width={18} height={18} />
                    {data.goldCost.toLocaleString()} gold
                    {cantAfford && (
                      <span className="text-xs font-normal">
                        (you have {data.gold.toLocaleString()})
                      </span>
                    )}
                  </p>
                  <ul className="flex flex-wrap gap-1.5 text-xs">
                    {requirements.map((req) => (
                      <li
                        key={req.key}
                        className={cn(
                          "flex h-7 items-center gap-1.5 rounded-md bg-surface-inset/60 px-2 font-semibold tabular-nums",
                          req.owned < req.quantity && "text-danger",
                        )}
                      >
                        <span className="font-normal text-muted-foreground">
                          {req.name}
                        </span>
                        {req.owned.toLocaleString()} / {req.quantity.toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={skip}
                onChange={(event) => {
                  setSkip(event.target.checked);
                  try {
                    window.localStorage.setItem(
                      SKIP_KEY,
                      event.target.checked ? "1" : "0",
                    );
                  } catch {
                    // A blocked store only costs the player their preference.
                  }
                }}
              />
              Skip animation
            </label>
            <Button
              type="button"
              className="h-9 min-w-28 border-0"
              disabled={!canAttempt}
              onClick={() => void attempt()}
            >
              <Gem className="h-4 w-4" aria-hidden />
              {pending ? "Enchanting..." : "Enchant"}
            </Button>
          </div>
        </div>
      </section>

      <DragOverlay dropAnimation={null}>
        {dragged ? (
          <div className="game-item-trigger game-drag-overlay">
            <ItemFace item={dragged} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** The item as the bag draws it: art, rarity mark, enchant badge, stack size. */
function ItemFace({
  item,
  quantity = item.quantity,
}: {
  item: ItemWithStats;
  quantity?: number;
}) {
  return (
    <>
      <Image
        alt=""
        src={item.sprite}
        width={102}
        height={102}
        className="object-contain"
      />
      <ItemRarityMark rarity={item.rarity} />
      <EnchantBadge level={item.enchantLevel} />
      {quantity !== undefined && quantity > 1 && (
        <div className="game-item-quantity">{quantity}</div>
      )}
    </>
  );
}

/** The inventory above the bench; dropping a bench item on it takes it back. */
function BagDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "drop-bag" });
  return (
    <section
      ref={setNodeRef}
      aria-label="Inventory"
      className="mx-2 rounded-xl bg-popover p-3 shadow-[var(--shadow-overlay)] sm:mx-0"
    >
      {children}
    </section>
  );
}

function BagTile({
  item,
  from,
  state,
  onPlace,
}: {
  item: ItemWithStats;
  from: "bag" | "worn";
  /** usable: can go on the bench now. placed: already there. off: not for this step. */
  state: "usable" | "placed" | "off";
  onPlace: () => void;
}) {
  const { colors } = useRarityColors();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${from}-${item.id}`,
    data: { item, from },
    disabled: state !== "usable",
  });
  const name = enchantedItemName(item.name, item.enchantLevel ?? 0);

  return (
    <div
      className={cn(
        "game-slot rarity-frame transition-[opacity,filter]",
        state === "off" && "opacity-30 grayscale",
        state === "placed" && "border-dashed opacity-40",
      )}
      style={rarityStyle(item.rarity, colors[item.rarity])}
      data-rarity={item.rarity}
    >
      <button
        ref={setNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        disabled={state !== "usable"}
        onClick={onPlace}
        title={name}
        aria-label={`${name}, ${item.rarity.toLowerCase()}${from === "worn" ? ", worn" : ""}${state === "placed" ? ", on the bench" : ""}`}
        className={cn("game-item-trigger", state !== "usable" && "cursor-default")}
        style={{ opacity: isDragging ? 0 : undefined }}
      >
        <ItemFace item={item} />
      </button>
    </div>
  );
}

type Box = { x: number; y: number; size: number };

/** A slot on the bench, laid over the drawing at `box` (viewBox units). */
function BenchSlot({
  id,
  box,
  item,
  quantity,
  short,
  ghost,
  leaving,
  dimmed,
  locked,
  highlight,
  onClear,
  className,
  style,
}: {
  id: string;
  box: Box;
  item?: ItemWithStats | null;
  /** Shown on the item instead of its stack size: what the attempt takes. */
  quantity?: number;
  short?: boolean;
  /** What belongs here, drawn faintly until the player puts it in. */
  ghost?: { name: string; sprite: string | null; quantity: number };
  /** An item that was just destroyed in this slot. */
  leaving?: ItemWithStats | null;
  dimmed?: boolean;
  locked?: boolean;
  /** The item being dragged belongs here. */
  highlight: boolean;
  onClear?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { colors } = useRarityColors();
  const drop = useDroppable({ id: `drop-${id}` });
  const drag = useDraggable({
    id: `slot-${id}`,
    data: { item, from: id },
    disabled: !item || locked,
  });
  const shown = item ?? leaving;

  return (
    <div
      ref={drop.setNodeRef}
      className={cn("absolute aspect-square", className)}
      style={{
        left: `${(box.x / VIEW.w) * 100}%`,
        top: `${((box.y - VIEW.y) / VIEW.h) * 100}%`,
        width: `${(box.size / VIEW.w) * 100}%`,
        ...style,
      }}
    >
      <div
        className={cn(
          "game-slot h-full w-full",
          shown && "rarity-frame",
          short && "border-danger",
        )}
        style={shown ? rarityStyle(shown.rarity, colors[shown.rarity]) : undefined}
        data-rarity={shown?.rarity}
        data-over={highlight && drop.isOver}
        data-highlight={highlight}
      >
        {item ? (
          <button
            ref={drag.setNodeRef}
            type="button"
            {...drag.attributes}
            {...drag.listeners}
            disabled={locked}
            onClick={onClear}
            title="Take it back"
            aria-label={`${enchantedItemName(item.name, item.enchantLevel ?? 0)}. Take it back`}
            className={cn(
              "game-item-trigger transition-opacity duration-500",
              dimmed && "opacity-30",
            )}
            style={{ opacity: drag.isDragging ? 0 : undefined }}
          >
            <ItemFace item={item} quantity={quantity} />
          </button>
        ) : leaving ? (
          <span className="game-item-trigger animate-enchant-shatter" aria-hidden>
            <ItemFace item={leaving} />
          </span>
        ) : ghost ? (
          <span
            className="game-item-trigger opacity-35 grayscale"
            title={ghost.name}
            aria-label={`${ghost.name} needed`}
          >
            {ghost.sprite && (
              <Image
                alt=""
                src={ghost.sprite}
                width={102}
                height={102}
                className="object-contain"
              />
            )}
            <div className="game-item-quantity">{ghost.quantity}</div>
          </span>
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground/50" aria-hidden />
        )}
      </div>
    </div>
  );
}

// Bench geometry, in viewBox units. Everything sits on the line y = MID:
// cost slots → junction → chance diamond → the rings around the item.
const VIEW = { y: 24, w: 616, h: 240 };
const MID = 150;
const JUNCTION_X = 176;
const CORE_X = 296;
const CORE_R = 58;
const TARGET_X = 496;
const RINGS = [92, 78, 64];
const ITEM = 84;
const TARGET_BOX: Box = { x: TARGET_X - ITEM / 2, y: MID - ITEM / 2, size: ITEM };
const GOAL = { x: 582, y: 64, r: 26 };
/** The charge fills the lines over this share of its time, then holds. */
const FILL_END = 0.8;
// The charge runs the main line at one steady speed: each stretch gets time in
// proportion to its length (conduit 108, junction to chance 62, round the
// chance diamond 164, link 50, round the item 260).
const FLOW = {
  conduit: [0.04, 0.167],
  main: [0.167, 0.24],
  core: [0.24, 0.434],
  link: [0.434, 0.493],
  rings: [0.493, FILL_END],
} as const;
/** A failure holds the lit lines for a beat, then runs them back out. */
const DRAIN_HOLD_MS = 350;
const DRAIN_MS = 1100;

/**
 * Where the cost slots go: one column of up to three, then two or three
 * narrower columns (nine slots at most). Each row feeds one conduit.
 */
export function enchantSlotBoxes(count: number) {
  const n = Math.max(1, count);
  const cols = Math.min(3, Math.ceil(n / 3));
  const size = cols === 1 ? 64 : cols === 2 ? 48 : 32;
  const rows = Math.ceil(n / cols);
  const right = 4 + cols * size + (cols - 1) * 6;
  const rowY = (row: number) => MID + (row - (rows - 1) / 2) * (size + 10);
  return {
    right,
    rowYs: Array.from({ length: rows }, (_, row) => rowY(row)),
    // Each row fills from the right, so a short last row still meets its conduit.
    boxes: Array.from({ length: n }, (_, i): Box => ({
      x: right - size - (i % cols) * (size + 6),
      y: rowY(Math.floor(i / cols)) - size / 2,
      size,
    })),
  };
}

// Closed shapes end with a line back to their start, not Z: a dashed stroke
// leaves a speck on a closed path's join while it is still undrawn.
const diamond = (cx: number, cy: number, r: number) =>
  `M${cx - r},${cy} L${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy}`;
/** Half a diamond, left corner to right corner, over the top (-1) or under (1). */
const arc = (cx: number, cy: number, r: number, side: 1 | -1) =>
  `M${cx - r},${cy} L${cx},${cy + side * r} L${cx + r},${cy}`;
const roundRect = ({ x, y, size }: Box, r: number) =>
  `M${x + r},${y} h${size - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${size - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${2 * r - size} a${r},${r} 0 0 1 ${-r},${-r} v${2 * r - size} a${r},${r} 0 0 1 ${r},${-r}`;
const polar = (cx: number, cy: number, r: number, degrees: number) => {
  const a = (degrees * Math.PI) / 180;
  return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
};
/** The fan over the chance diamond. */
const RAYS = Array.from({ length: 11 }, (_, i) => {
  const angle = -150 + i * 12;
  return `M${polar(CORE_X, MID, 84, angle)} L${polar(CORE_X, MID, i % 2 === 0 ? 112 : 100, angle)}`;
});
/** Where the sparks start and how far they fly. */
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const a = ((i * 360) / 18 + (i % 2) * 9) * (Math.PI / 180);
  const reach = 70 + ((i * 37) % 70);
  return {
    x: TARGET_X + Math.cos(a) * 46,
    y: MID + Math.sin(a) * 46,
    dx: Math.cos(a) * reach,
    dy: Math.sin(a) * reach,
    delay: (i * 53) % 220,
  };
});

// A dash a hair short of the whole path with a gap a hair longer: at offset 1
// no dash touches either end, so an undrawn stroke leaves no sliver.
const HIDDEN_DASH = "0.999 1.01";
/** Length of the bright head at the front of a filling line. */
const HEAD = 9;

/**
 * One stroke of the charge. Charging, it is drawn over `at` (fractions of the
 * charge) at a steady pace, led by a bright head when `head` is set. A success
 * leaves it lit; a failure runs it back out the way it came.
 */
function Lit({
  d,
  at,
  phase,
  ms,
  head,
}: {
  d: string;
  at: readonly [number, number];
  phase: EnchantPhase;
  ms: number;
  /** The path's length: gives it a bright head of the same size on every line. */
  head?: number;
}) {
  if (phase === "charging") {
    const timing = {
      animationDelay: `${at[0] * ms}ms`,
      animationDuration: `${(at[1] - at[0]) * ms}ms`,
      animationTimingFunction: "linear",
    };
    return (
      <>
        <path
          d={d}
          pathLength={1}
          strokeDasharray={HIDDEN_DASH}
          className="animate-route-draw"
          style={timing}
        />
        {head && (
          <path
            d={d}
            pathLength={1}
            strokeDasharray={`${HEAD / head} 2`}
            strokeWidth={3}
            className="animate-enchant-head stroke-white"
            style={
              { ...timing, "--head": HEAD / head + 0.005 } as React.CSSProperties
            }
          />
        )}
      </>
    );
  }
  if (phase === "success") return <path d={d} />;
  return (
    <path
      d={d}
      pathLength={1}
      strokeDasharray={HIDDEN_DASH}
      className="animate-enchant-drain"
      style={{
        animationDelay: `${DRAIN_HOLD_MS + ((FILL_END - at[1]) / FILL_END) * DRAIN_MS}ms`,
        animationDuration: `${((at[1] - at[0]) / FILL_END) * DRAIN_MS}ms`,
        animationTimingFunction: "linear",
      }}
    />
  );
}

/**
 * The bench drawing: metalwork, the charge and the fireworks. Slots and items
 * are laid over it as real tiles. Remount it (key) per attempt; pass
 * phase "idle" to show no charge at all.
 */
export function EnchantBenchArt({
  label,
  slotCount,
  goalText,
  chanceText,
  phase,
  won,
  broken,
  chargeMs,
}: {
  label: string;
  /** How many cost slots are laid over the left side. */
  slotCount: number;
  /** The small diamond: the level being attempted, or the one just reached. */
  goalText: string;
  chanceText: string;
  phase: EnchantPhase;
  /** The goal was reached: fill its diamond (also when the charge was skipped). */
  won: boolean;
  /** An accessory just broke: throw shards. */
  broken: boolean;
  chargeMs: number;
}) {
  const glowId = useId();
  const charging = phase === "charging";
  const success = phase === "success";
  const failed = phase !== "idle" && !charging && !success;
  const lit = { phase, ms: chargeMs };

  const { boxes, rowYs, right } = enchantSlotBoxes(slotCount);
  const reach = Math.max(...rowYs.map((y) => Math.abs(MID - y)));
  const turnX = Math.max(right + 8, JUNCTION_X - 6 - reach);
  const conduit = (y: number) =>
    y === MID
      ? `M${right},${MID} H${JUNCTION_X}`
      : `M${right},${y} H${turnX} L${turnX + Math.abs(MID - y)},${MID} H${JUNCTION_X}`;
  // A small diamond on each conduit, where there is room for one.
  const nodes = rowYs.flatMap((y) =>
    y === MID
      ? [{ x: right + 18, y }]
      : turnX - right >= 20
        ? [{ x: (right + turnX) / 2, y }]
        : [],
  );
  const bar = JUNCTION_X + 10;
  const coreLeft = CORE_X - CORE_R;
  const coreRight = CORE_X + CORE_R;
  const ringLeft = TARGET_X - RINGS[0]!;
  const centered = "origin-center [transform-box:fill-box]";

  return (
    <svg
      viewBox={`0 ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      role="img"
      aria-label={label}
      className="block h-auto w-full select-none overflow-visible"
    >
      <defs>
        <radialGradient id={glowId}>
          <stop offset="0" stopColor="currentColor" stopOpacity="0.6" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The cold metalwork. */}
      <g className="fill-none stroke-primary/40" strokeWidth={1.25}>
        {rowYs.map((y) => (
          <path key={y} d={conduit(y)} />
        ))}
        <path d={`M${JUNCTION_X},${MID} H${coreLeft}`} />
        <path d={`M${bar},${MID - 24} V${MID + 24}`} />
        <path d={`M${bar},${MID - 18} A18,18 0 0 1 ${bar},${MID + 18}`} />
        <path d={diamond(CORE_X, MID, CORE_R)} strokeLinecap="square" />
        <path d={diamond(CORE_X, MID, CORE_R - 9)} className="stroke-primary/20" />
        <path d={`M${coreLeft + 14.8},${MID - 28.8} L${coreLeft - 14},${MID} L${coreLeft + 14.8},${MID + 28.8}`} />
        <path d={`M${coreRight - 14.8},${MID - 28.8} L${coreRight + 14},${MID} L${coreRight - 14.8},${MID + 28.8}`} />
        {RAYS.map((d) => (
          <path key={d} d={d} className="stroke-primary/25" />
        ))}
        <path d={`M${coreRight},${MID} H${ringLeft}`} />
        {RINGS.map((r) => (
          <path key={r} d={diamond(TARGET_X, MID, r)} strokeLinecap="square" />
        ))}
        <path d="M542,104 L569,77" />
      </g>
      <g className="fill-popover stroke-primary/60" strokeWidth={1.25}>
        {nodes.map((node) => (
          <path key={node.y} d={diamond(node.x, node.y, 4)} />
        ))}
        <circle cx={bar} cy={MID - 24} r={2.5} />
        <circle cx={bar} cy={MID + 24} r={2.5} />
        <path d={diamond(JUNCTION_X + 38, MID, 4)} />
        <path d={diamond(JUNCTION_X + 50, MID, 4)} />
      </g>

      {/* The charge: slots → junction → chance → around the item → the level. */}
      {phase !== "idle" && (
        <g
          strokeWidth={2}
          className={cn(
            "fill-none stroke-current [filter:drop-shadow(0_0_3px_currentColor)]",
            failed ? "animate-enchant-fizzle text-danger" : "text-primary",
            charging && "animate-enchant-throb",
            success && "animate-enchant-afterglow",
          )}
          style={
            charging
              ? {
                  animationDelay: `${FILL_END * chargeMs}ms`,
                  animationDuration: `${(1 - FILL_END) * chargeMs}ms`,
                }
              : undefined
          }
        >
          <circle
            cx={TARGET_X}
            cy={MID}
            r={120}
            fill={`url(#${glowId})`}
            stroke="none"
            className={cn(
              charging && "animate-in fade-in fill-mode-both",
              failed && "animate-out fade-out fill-mode-forwards duration-700",
            )}
            style={
              charging
                ? {
                    animationDelay: `${FLOW.rings[0] * chargeMs}ms`,
                    animationDuration: `${(FILL_END - FLOW.rings[0]) * chargeMs}ms`,
                  }
                : undefined
            }
          />
          {boxes.map((box) => (
            <Lit
              key={`${box.x}-${box.y}`}
              d={roundRect({ x: box.x - 2, y: box.y - 2, size: box.size + 4 }, 13)}
              at={[0, 0.05]}
              {...lit}
            />
          ))}
          {rowYs.map((y) => (
            <Lit
              key={y}
              d={conduit(y)}
              at={FLOW.conduit}
              // The slanted stretch is the only part longer than it is wide.
              head={JUNCTION_X - right + Math.abs(MID - y) * (Math.SQRT2 - 1)}
              {...lit}
            />
          ))}
          {nodes.map((node) => (
            <Lit key={node.y} d={diamond(node.x, node.y, 4)} at={[0.06, 0.09]} {...lit} />
          ))}
          <Lit d={`M${JUNCTION_X},${MID} H${coreLeft}`} at={FLOW.main} head={coreLeft - JUNCTION_X} {...lit} />
          {/* Side strokes light as the head passes them. */}
          <Lit d={`M${bar},${MID} V${MID - 24}`} at={[0.18, 0.21]} {...lit} />
          <Lit d={`M${bar},${MID} V${MID + 24}`} at={[0.18, 0.21]} {...lit} />
          <Lit
            d={`M${bar},${MID - 18} A18,18 0 0 1 ${bar},${MID + 18}`}
            at={[0.18, 0.23]}
            {...lit}
          />
          <Lit d={diamond(JUNCTION_X + 38, MID, 4)} at={[0.21, 0.235]} {...lit} />
          <Lit d={diamond(JUNCTION_X + 50, MID, 4)} at={[0.225, 0.25]} {...lit} />
          {([-1, 1] as const).map((side) => (
            <g key={side}>
              <Lit
                d={`M${coreLeft - 14},${MID} L${coreLeft + 14.8},${MID + side * 28.8}`}
                at={[0.224, 0.27]}
                {...lit}
              />
              <Lit
                d={arc(CORE_X, MID, CORE_R, side)}
                at={FLOW.core}
                head={2 * CORE_R * Math.SQRT2}
                {...lit}
              />
              <Lit d={arc(CORE_X, MID, CORE_R - 9, side)} at={FLOW.core} {...lit} />
              <Lit
                d={`M${coreRight - 14.8},${MID + side * 28.8} L${coreRight + 14},${MID}`}
                at={[0.4, 0.434]}
                {...lit}
              />
            </g>
          ))}
          {RAYS.map((d, i) => (
            <Lit key={d} d={d} at={[0.25 + i * 0.016, 0.29 + i * 0.016]} {...lit} />
          ))}
          <Lit d={`M${coreRight},${MID} H${ringLeft}`} at={FLOW.link} head={ringLeft - coreRight} {...lit} />
          {/* All three rings close on the far corner together. */}
          {RINGS.map((r) =>
            ([-1, 1] as const).map((side) => (
              <Lit
                key={`${r}${side}`}
                d={arc(TARGET_X, MID, r, side)}
                at={FLOW.rings}
                head={2 * r * Math.SQRT2}
                {...lit}
              />
            )),
          )}
          <Lit d="M542,104 L569,77" at={[0.723, 0.745]} {...lit} />
          <Lit d={arc(GOAL.x, GOAL.y, GOAL.r, -1)} at={[0.745, FILL_END]} {...lit} />
          <Lit d={arc(GOAL.x, GOAL.y, GOAL.r, 1)} at={[0.745, FILL_END]} {...lit} />
          <Lit
            d={roundRect({ x: TARGET_BOX.x - 2, y: TARGET_BOX.y - 2, size: ITEM + 4 }, 13)}
            at={[0.76, FILL_END]}
            {...lit}
          />
        </g>
      )}

      {/* The moment it lands: a flash, three rings and a spray of sparks (the
          rays are laid under this drawing by the bench). */}
      {success && (
        <>
          <circle
            cx={TARGET_X}
            cy={MID}
            r={90}
            fill={`url(#${glowId})`}
            className={cn(centered, "animate-enchant-burst text-white")}
          />
          <g className="fill-none stroke-primary" strokeWidth={2.5}>
            {[0, 130, 260].map((delay) => (
              <path
                key={delay}
                d={diamond(TARGET_X, MID, RINGS[2]!)}
                className={cn(centered, "animate-enchant-burst")}
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </g>
        </>
      )}
      {failed && (
        <circle
          cx={TARGET_X}
          cy={MID}
          r={90}
          fill={`url(#${glowId})`}
          className={cn(centered, "animate-enchant-burst text-danger")}
        />
      )}
      {(success || (failed && broken)) && (
        <g
          className={cn(
            "[filter:drop-shadow(0_0_3px_currentColor)]",
            success ? "fill-white text-primary" : "fill-danger text-danger",
          )}
        >
          {SPARKS.map((spark, i) => (
            <path
              key={i}
              d={diamond(spark.x, spark.y, i % 3 === 0 ? 5 : 3.5)}
              className={cn(centered, "animate-enchant-spark")}
              style={
                {
                  "--dx": `${spark.dx.toFixed(1)}px`,
                  // Shards of a broken accessory fall; sparks just fly.
                  "--dy": `${(spark.dy + (success ? 0 : 50)).toFixed(1)}px`,
                  animationDelay: `${spark.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      )}

      <text
        x={CORE_X}
        y={MID}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[22px] font-semibold tabular-nums"
      >
        {chanceText}
      </text>

      {/* The level at stake. */}
      <g className={cn(centered, won && "animate-drop-pop")}>
        <path
          d={diamond(GOAL.x, GOAL.y, GOAL.r)}
          strokeWidth={1.25}
          className={cn(
            won ? "fill-primary stroke-primary" : "fill-popover stroke-primary/60",
          )}
        />
        <text
          x={GOAL.x}
          y={GOAL.y}
          textAnchor="middle"
          dominantBaseline="central"
          className={cn(
            "text-[13px] font-semibold tabular-nums",
            won ? "fill-primary-foreground" : "fill-primary",
          )}
        >
          {goalText}
        </text>
      </g>
    </svg>
  );
}
