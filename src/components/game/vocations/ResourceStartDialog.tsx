"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import toast from "react-hot-toast";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import type { StatusResponse } from "~/components/game/actions/useVocationalActiveAction";
import { useEquipmentContext } from "~/context/equipmentContext";
import { useOptionalDndContext } from "~/components/dnd/DnDContext";
import {
  VocationalActionType,
  type ItemRarity,
} from "~/generated/prisma/enums";
import { ItemInfoPopover } from "~/components/game/items/ItemInfoPopover";
import { useUserContext } from "~/context/userContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { refreshProgress } from "~/lib/player-sync";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { InventorySlotWithItem } from "~/types/inventory";
import { cn } from "~/lib/utils";
import { Info } from "lucide-react";
import Link from "next/link";
import { TooltipProvider } from "~/components/ui/tooltip";
import { getCraftingRule } from "~/game/crafting";

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

export default function ResourceStartDialog({
  resource,
  open,
  onOpenChange,
}: ResourceStartDialogProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [baitUserItemId, setBaitUserItemId] = useState<number | null>(null);
  const { equipment } = useEquipmentContext();
  const dnd = useOptionalDndContext();
  const { user } = useUserContext();
  const queryClient = useQueryClient();
  const { applyVocationStatus, active: hadActiveAction } =
    useVocationalActiveActionContext();

  const needsBait = resource?.actionType === VocationalActionType.FISHING;
  const isCrafting = resource
    ? Boolean(getCraftingRule(resource.actionType))
    : false;
  const requirements = resource?.requirements ?? [];
  const needsInventory = (needsBait || requirements.length > 0) && !dnd;

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

  const getTemplateQuantityInInventory = (templateItemId: number) => {
    return inventory.reduce((sum, slot) => {
      const item = slot.item;
      if (!item) return sum;
      if (item.itemId !== templateItemId) return sum;
      return sum + (item.quantity ?? 0);
    }, 0);
  };

  const userHasRequiredResource = requirements.every((req) => {
    // `req.item.id` is the Item template id; inventory slot items are UserItems.
    // Use `item.itemId` to match template id, and sum across stacks.
    const haveQty = getTemplateQuantityInInventory(req.item.id);
    return haveQty >= req.quantityPerUnit;
  });
  const userHasResource = needsBait
    ? baitOptions.length > 0
    : userHasRequiredResource;

  const selectedBaitUserItemId = baitUserItemId ?? baitOptions[0]?.id ?? null;
  const inventoryIsLoading = !dnd && fallbackInventoryQuery.isLoading;

  const handleStart = async () => {
    if (!resource) return;

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

    if (needsBait) {
      const selected = selectedBaitUserItemId;
      if (!selected) {
        toast.error("You need bait in your inventory to fish.");
        return;
      }
      if (baitUserItemId === null) {
        setBaitUserItemId(selected);
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
          baitUserItemId: needsBait ? selectedBaitUserItemId : null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="sr-only">
            {isCrafting ? "Craft" : "Gather"} {resource.name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review the item and requirements, then start the activity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Resource Image and Name */}
          <div className="flex flex-col items-center gap-4">
            <ItemInfoPopover
              itemId={resource.item.id}
              rarity={resource.rarity}
              name={resource.name}
            >
              <Image
                src={resource.item.sprite}
                alt={resource.name}
                width={1080}
                height={1080}
                className="h-24 w-24"
              />
            </ItemInfoPopover>
            <h3 className="text-2xl font-semibold text-foreground">
              {resource.name}
            </h3>
          </div>

          {/* Information Badges */}
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary" className="bg-secondary text-foreground">
              Lv. {Math.max(1, resource.requiredSkillLevel ?? 1)} Required
            </Badge>
            <Badge variant="secondary" className="bg-secondary text-foreground">
              {resource.effectiveSeconds ?? resource.defaultSeconds}s per item
            </Badge>
            <Badge variant="secondary" className="bg-secondary text-foreground">
              +{resource.xpPerUnit} XP per item
            </Badge>
          </div>

          {needsBait || requirements.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-text-secondary">
                Requirements
              </h4>

              {needsBait ? (
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground">Bait</h4>
                  <small className="text-xs text-muted-foreground">
                    <Info size={14} className="mb-0.5 mr-1 inline-block" />
                    This action requires bait. Select the bait you wish to use
                    from your inventory.
                  </small>
                  <div className="text-sm text-text-secondary">
                    Consumes {requiredBaitQuantity}×{" "}
                    {requirements[0]?.item.name ?? "bait"} per catch.
                  </div>
                  {baitOptions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No bait available. You can purchase some from the{" "}
                      <Link href="/marketplace">marketplace</Link> or by doing
                      gathering activities.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      {baitOptions.map((item) => {
                        const isSelected = selectedBaitUserItemId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setBaitUserItemId(item.id)}
                            className="flex flex-col items-center gap-1"
                          >
                            <div
                              className={cn(
                                "relative flex h-[62px] w-[62px] items-center justify-center rounded border bg-secondary",
                                isSelected
                                  ? "ring-1 ring-ring"
                                  : "border-border",
                              )}
                            >
                              <Image
                                alt={item.name}
                                src={item.sprite}
                                width={62}
                                height={62}
                                className="rounded"
                              />
                              <Badge className="absolute -right-1 -top-2 px-2 py-0 text-[10px] font-light text-foreground">
                                {item.quantity ?? 0}
                              </Badge>
                            </div>
                            <div className="max-w-[72px] truncate text-xs text-text-secondary">
                              {item.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <TooltipProvider delayDuration={100}>
                  <div className="flex flex-wrap gap-3">
                    {requirements.map((req) => (
                      <ItemInfoPopover
                        key={req.item.id}
                        itemId={req.item.id}
                        rarity={req.item.rarity}
                        name={req.item.name}
                        tooltip={
                          <>
                            You have:{" "}
                            <span
                              className={
                                getTemplateQuantityInInventory(req.item.id) > 0
                                  ? "font-bold text-success"
                                  : "font-bold text-danger"
                              }
                            >
                              {getTemplateQuantityInInventory(req.item.id)}
                            </span>
                          </>
                        }
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={cn(
                              "relative flex h-[62px] w-[62px] items-center justify-center rounded border border-border bg-card",
                              getTemplateQuantityInInventory(req.item.id) <
                                req.quantityPerUnit &&
                                "border-2 border-danger/80",
                            )}
                          >
                            <Image
                              alt={req.item.name}
                              src={req.item.sprite}
                              width={62}
                              height={62}
                              className="rounded"
                            />
                            <Badge
                              className={cn(
                                "absolute -right-1 -top-2 bg-surface-inset px-2 py-0 text-[12px] font-bold text-foreground",
                                getTemplateQuantityInInventory(req.item.id) <
                                  req.quantityPerUnit && "text-danger",
                              )}
                            >
                              x{req.quantityPerUnit}
                            </Badge>
                          </div>
                          <div className="max-w-[72px] text-xs text-text-secondary">
                            {req.item.name}
                          </div>
                        </div>
                      </ItemInfoPopover>
                    ))}
                  </div>
                </TooltipProvider>
              )}
            </div>
          ) : null}

          {/* Start Button */}
          <Button
            onClick={handleStart}
            disabled={isStarting || inventoryIsLoading || !userHasResource}
            className="w-full"
            size="lg"
          >
            {isStarting
              ? "Starting..."
              : inventoryIsLoading
                ? "Checking inventory..."
                : !userHasResource
                  ? "Missing requirements"
                  : isCrafting
                    ? "Start crafting"
                    : "Start"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
