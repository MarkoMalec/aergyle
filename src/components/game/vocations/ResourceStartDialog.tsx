"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import toast from "react-hot-toast";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import type { StatusResponse } from "~/components/game/actions/useVocationalActiveAction";
import { formatDuration } from "~/components/game/actions/format";
import { useEquipmentContext } from "~/context/equipmentContext";
import { useOptionalDndContext } from "~/components/dnd/DnDContext";
import {
  VocationalActionType,
  type ItemRarity,
} from "~/generated/prisma/enums";
import { ItemArtwork } from "~/components/game/items/ItemArtwork";
import { useSkillProgress } from "~/components/game/skills/SkillProgressContext";
import { useUserContext } from "~/context/userContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { refreshProgress } from "~/lib/player-sync";
import { inventoryQueryKeys } from "~/lib/query-keys";
import type { InventorySlotWithItem } from "~/types/inventory";
import { cn } from "~/lib/utils";
import { Clock, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { getCraftingRule } from "~/game/crafting";
import { MAX_VOCATION_DURATION_SECONDS } from "~/server/vocations/constants";

type ResourceStartDialogProps = {
  resource: {
    id: number;
    actionType: VocationalActionType;
    name: string;
    requiredSkillLevel: number;
    defaultSeconds: number;
    effectiveSeconds?: number;
    yieldPerUnit: number;
    xpPerUnit: number;
    rarity: ItemRarity;
    item: { id: number; sprite: string };
    requirements: {
      quantityPerUnit: number;
      item: { id: number; name: string; sprite: string; rarity: ItemRarity };
    }[];
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const sectionLabelClass = "game-eyebrow text-muted-foreground";
const stepperButtonClass =
  "grid w-10 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

export default function ResourceStartDialog({
  resource,
  open,
  onOpenChange,
}: ResourceStartDialogProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [baitUserItemId, setBaitUserItemId] = useState<number | null>(null);
  // Raw text of the quantity field; null means the default of 1.
  const [quantityInput, setQuantityInput] = useState<string | null>(null);
  const { equipment } = useEquipmentContext();
  const dnd = useOptionalDndContext();
  const { user } = useUserContext();
  const skillProgressState = useSkillProgress();
  const queryClient = useQueryClient();
  const { applyVocationStatus, active: hadActiveAction } =
    useVocationalActiveActionContext();

  useEffect(() => {
    if (open) setQuantityInput(null);
  }, [open, resource?.id]);

  const needsBait = resource?.actionType === VocationalActionType.FISHING;
  const isCrafting = resource
    ? Boolean(getCraftingRule(resource.actionType))
    : false;
  const requirements = resource?.requirements ?? [];
  const hasInputs = needsBait || requirements.length > 0;
  const needsInventory = hasInputs && !dnd;

  const fallbackInventoryQuery = useQuery({
    queryKey: inventoryQueryKeys.byUser(user?.id),
    enabled: needsInventory && Boolean(user?.id),
    queryFn: async (): Promise<{ slots: InventorySlotWithItem[] }> => {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Error fetching inventory");
      }
      const data = await response.json();
      return { slots: (data.slots ?? []) as InventorySlotWithItem[] };
    },
    staleTime: 0,
  });

  const inventory = dnd?.inventory ?? fallbackInventoryQuery.data?.slots ?? [];

  const requiredBaitTemplateId =
    requirements.length === 1 ? requirements[0]!.item.id : null;
  const requiredBaitQuantity = Math.max(
    1,
    requirements.length === 1 ? requirements[0]!.quantityPerUnit : 1,
  );

  const baitOptions = inventory
    .map((slot) => slot.item)
    .filter((item): item is NonNullable<typeof item> =>
      Boolean(
        item &&
          item.itemType === "BAIT" &&
          (item.quantity ?? 0) >= requiredBaitQuantity &&
          (requiredBaitTemplateId
            ? item.itemId === requiredBaitTemplateId
            : true),
      ),
    );
  const selectedBait =
    baitOptions.find((item) => item.id === baitUserItemId) ??
    baitOptions[0] ??
    null;

  const getTemplateQuantityInInventory = (templateItemId: number) => {
    // `templateItemId` is the Item template id; inventory slot items are UserItems.
    // Match on `item.itemId` and sum across stacks.
    return inventory.reduce((sum, slot) => {
      const item = slot.item;
      if (!item) return sum;
      if (item.itemId !== templateItemId) return sum;
      return sum + (item.quantity ?? 0);
    }, 0);
  };

  // How many units the inputs cover, and how many fit in one activity.
  const maxByInputs = needsBait
    ? selectedBait
      ? Math.floor((selectedBait.quantity ?? 0) / requiredBaitQuantity)
      : 0
    : requirements.reduce(
        (max, req) =>
          Math.min(
            max,
            Math.floor(
              getTemplateQuantityInInventory(req.item.id) /
                Math.max(1, req.quantityPerUnit),
            ),
          ),
        Infinity,
      );
  const unitSeconds = Math.max(
    1,
    resource?.effectiveSeconds ?? resource?.defaultSeconds ?? 1,
  );
  const maxByTime = Math.max(
    1,
    Math.floor(MAX_VOCATION_DURATION_SECONDS / unitSeconds),
  );
  const maxQuantity = Math.min(maxByInputs, maxByTime);
  const userHasResource = maxByInputs >= 1;

  const parsedQuantity =
    quantityInput === null ? 1 : Number.parseInt(quantityInput, 10);
  const quantity = Math.min(
    Math.max(1, maxQuantity),
    Math.max(1, Number.isNaN(parsedQuantity) ? 1 : parsedQuantity),
  );
  const setQuantity = (value: number) => {
    setQuantityInput(String(Math.min(maxQuantity, Math.max(1, value))));
  };

  const userLevel = skillProgressState?.skillProgress?.level ?? null;
  const requiredLevel = Math.max(1, resource?.requiredSkillLevel ?? 1);
  const isLockedByLevel =
    !(skillProgressState?.progressLoading ?? false) &&
    userLevel !== null &&
    userLevel < requiredLevel;

  const inventoryIsLoading = !dnd && fallbackInventoryQuery.isLoading;

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resource || isStarting) return;

    if (!userHasResource) {
      toast.error(
        needsBait
          ? `You need ${requiredBaitQuantity} matching bait per catch.`
          : "You do not have the required materials.",
      );
      return;
    }

    if (resource.actionType === VocationalActionType.WOODCUTTING) {
      if (equipment.fellingAxe === null) {
        toast.error(`You need to equip an Axe to start woodcutting.`);
        return;
      }
    }

    setIsStarting(true);

    try {
      const res = await fetch("/api/vocations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id,
          replace: true,
          baitUserItemId: needsBait ? (selectedBait?.id ?? null) : null,
          // Without inputs the activity simply runs until the time limit.
          quantity: hasInputs ? quantity : null,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | (StatusResponse & { error?: string })
        | null;
      if (!res.ok || !json) {
        toast.error(json?.error ?? "Failed to start");
        return;
      }

      toast.success(`Activity started: ${resource.name}`);
      // The response is the new activity status; the header shows it right away.
      applyVocationStatus(json);
      // Replacing a running vocation paid out what it had earned.
      if (hadActiveAction) {
        void queryClient.invalidateQueries({
          queryKey: inventoryQueryKeys.byUser(user?.id),
        });
        refreshProgress(queryClient, user?.id);
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to start");
    } finally {
      setIsStarting(false);
    }
  };

  if (!resource) return null;

  const startLabel = isStarting
    ? "Starting…"
    : isLockedByLevel
      ? `Requires Lv. ${requiredLevel}`
      : inventoryIsLoading
        ? "Checking inventory…"
        : !userHasResource
          ? needsBait
            ? "No bait"
            : "Not enough materials"
          : isCrafting
            ? "Craft"
            : "Start";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[400px]">
        <form onSubmit={handleStart} className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-4 pr-8">
            <ItemArtwork
              src={resource.item.sprite}
              name={resource.name}
              rarity={resource.rarity}
              itemId={resource.item.id}
              size={72}
            />
            <div className="min-w-0 space-y-2">
              <DialogTitle className="pr-0 text-lg">{resource.name}</DialogTitle>
              <DialogDescription className="sr-only">
                Review the requirements, then start the activity.
              </DialogDescription>
              <div className="flex flex-wrap gap-1">
                <Badge
                  className={cn(
                    "text-xs",
                    isLockedByLevel ? "text-warning" : "text-muted-foreground",
                  )}
                >
                  Lv. {requiredLevel}
                </Badge>
                <Badge className="gap-1 text-xs text-muted-foreground">
                  <Clock size={12} aria-hidden="true" />
                  {unitSeconds}s
                </Badge>
                <Badge className="text-xs text-xp">
                  +{resource.xpPerUnit} XP
                </Badge>
              </div>
            </div>
          </div>

          {hasInputs ? (
            <div className="-mx-5 space-y-4 bg-background/40 px-5 py-4">
              {needsBait ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={sectionLabelClass}>Bait</span>
                    <span className="text-xs text-muted-foreground">
                      {requiredBaitQuantity} per catch
                    </span>
                  </div>
                  {baitOptions.length === 0 ? (
                    <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-danger">
                      No {requirements[0]?.item.name ?? "bait"} in your
                      inventory. Buy some on the{" "}
                      <Link href="/marketplace" className="underline">
                        marketplace
                      </Link>
                      .
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {baitOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={`${item.name}, ${item.quantity ?? 0} in stack`}
                          aria-pressed={selectedBait?.id === item.id}
                          onClick={() => setBaitUserItemId(item.id)}
                          className={cn(
                            "rounded-xl ring-offset-2 ring-offset-popover transition-shadow",
                            selectedBait?.id === item.id
                              ? "ring-2 ring-primary"
                              : "opacity-70 hover:opacity-100",
                          )}
                        >
                          <ItemArtwork
                            src={item.sprite}
                            name={item.name}
                            rarity={item.rarity}
                            size={52}
                            quantity={item.quantity ?? 0}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <span className={sectionLabelClass}>Requirements</span>
                  <div className="grid grid-cols-2 gap-2">
                    {requirements.map((req) => {
                      const have = getTemplateQuantityInInventory(req.item.id);
                      const need =
                        Math.max(1, req.quantityPerUnit) * Math.max(1, quantity);
                      const isShort = have < need;
                      return (
                        <div
                          key={req.item.id}
                          className={cn(
                            "flex min-w-0 items-center gap-3 rounded-lg p-2",
                            isShort ? "bg-destructive/15" : "bg-popover",
                          )}
                        >
                          <ItemArtwork
                            src={req.item.sprite}
                            name={req.item.name}
                            rarity={req.item.rarity}
                            itemId={req.item.id}
                            size={44}
                          />
                          <div className="min-w-0 text-sm">
                            <div className="truncate text-foreground">
                              {req.item.name}
                            </div>
                            <div className="text-xs tabular-nums text-muted-foreground">
                              <span
                                className={cn(
                                  "font-semibold",
                                  isShort ? "text-danger" : "text-foreground",
                                )}
                              >
                                {need}
                              </span>{" "}
                              / {have} owned
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {userHasResource ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <label
                      htmlFor="resource-start-quantity"
                      className={sectionLabelClass}
                    >
                      Quantity
                    </label>
                    {maxByTime < maxByInputs ? (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(MAX_VOCATION_DURATION_SECONDS / 3600)}h
                        limit
                      </span>
                    ) : null}
                  </div>
                  <div className="flex h-10 divide-x divide-border/60 overflow-hidden rounded-[8px] bg-surface-inset focus-within:ring-2 focus-within:ring-ring">
                    <input
                      id="resource-start-quantity"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={quantityInput ?? String(quantity)}
                      onChange={(event) =>
                        setQuantityInput(event.target.value.replace(/\D/g, ""))
                      }
                      onBlur={() => setQuantity(quantity)}
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums text-foreground outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(maxQuantity)}
                      disabled={quantity >= maxQuantity}
                      className={cn(
                        stepperButtonClass,
                        "w-auto px-3 text-xs font-semibold text-primary",
                      )}
                    >
                      Max
                    </button>
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity(quantity - 1)}
                      disabled={quantity <= 1}
                      className={stepperButtonClass}
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity(quantity + 1)}
                      disabled={quantity >= maxQuantity}
                      className={stepperButtonClass}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} aria-hidden="true" />
                      {formatDuration(quantity * unitSeconds)}
                    </span>
                    <span className="text-xp">
                      +{quantity * resource.xpPerUnit} XP
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={
              isStarting ||
              inventoryIsLoading ||
              isLockedByLevel ||
              !userHasResource
            }
            className="w-full"
          >
            {startLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
