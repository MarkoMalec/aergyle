"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import toast from "react-hot-toast";
import { dispatchActiveActionEvent } from "~/components/game/actions/activeActionEvents";
import { useEquipmentContext } from "~/context/equipmentContext";
import { useOptionalDndContext } from "~/components/dnd/DnDContext";
import { VocationalActionType } from "~/generated/prisma/enums";
import { useUserContext } from "~/context/userContext";
import { useQuery } from "@tanstack/react-query";
import { inventoryQueryKeys } from "~/lib/query-keys";
import { InventorySlotWithItem } from "~/types/inventory";
import { cn } from "~/lib/utils";
import { Info } from "lucide-react";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type ResourceStartDialogProps = {
  resource: {
    id: number;
    actionType: VocationalActionType;
    name: string;
    requiredSkillLevel: number;
    defaultSeconds: number;
    yieldPerUnit: number;
    xpPerUnit: number;
    item: { sprite: string };
    requirements: {
      quantityPerUnit: number;
      item: { id: number; name: string; sprite: string };
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

  const needsBait = resource?.actionType === VocationalActionType.FISHING;
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

  const baitOptions = inventory
    .map((slot) => slot.item)
    .filter((item): item is NonNullable<typeof item> =>
      Boolean(
        item &&
          item.itemType === "BAIT" &&
          (item.quantity ?? 0) > 0 &&
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

  const handleStart = async () => {
    if (!resource) return;

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

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error ?? "Failed to start");
        return;
      }

      toast.success(`Vocation started: ${resource.name}`);
      dispatchActiveActionEvent({ kind: "changed" });
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
          <DialogTitle className="sr-only">Start Resource Action</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Resource Image and Name */}
          <div className="flex flex-col items-center gap-4">
            <Image
              src={resource.item.sprite}
              alt={resource.name}
              width={1080}
              height={1080}
              className="h-24 w-24"
            />
            <h3 className="text-2xl font-semibold text-white">
              {resource.name}
            </h3>
          </div>

          {/* Information Badges */}
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary" className="bg-gray-700/60 text-white">
              Lv. {Math.max(1, resource.requiredSkillLevel ?? 1)} Required
            </Badge>
            <Badge variant="secondary" className="bg-gray-700/60 text-white">
              {resource.defaultSeconds}s per resource
            </Badge>
            <Badge variant="secondary" className="bg-gray-700/60 text-white">
              +{resource.xpPerUnit} XP per resource
            </Badge>
          </div>

          {needsBait || requirements.length > 0 ? (
            <div className="space-y-3">
              <Separator>REQUIREMENTS</Separator>

              {needsBait ? (
                <div className="space-y-2">
                  <h4 className="font-semibold text-white">Bait</h4>
                  <small className="text-xs text-white/70">
                    <Info size={14} className="mb-0.5 mr-1 inline-block" />
                    This action requires bait. Select the bait you wish to use
                    from your inventory.
                  </small>
                  {baitOptions.length === 0 ? (
                    <div className="text-sm text-white/70">
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
                                "relative flex h-[62px] w-[62px] items-center justify-center rounded border bg-gray-700/40",
                                isSelected
                                  ? "ring-1 ring-ring"
                                  : "border-gray-700/40",
                              )}
                            >
                              <Image
                                alt={item.name}
                                src={item.sprite}
                                width={62}
                                height={62}
                                className="rounded"
                              />
                              <Badge className="absolute -right-1 -top-2 px-2 py-0 text-[10px] font-light text-white">
                                {item.quantity ?? 0}
                              </Badge>
                            </div>
                            <div className="max-w-[72px] truncate text-xs text-white/80">
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
                      <Tooltip key={req.item.id}>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className={cn(
                                "relative flex h-[62px] w-[62px] items-center justify-center rounded border border-gray-700/40 bg-gray-800/90",
                                getTemplateQuantityInInventory(req.item.id) === 0 &&
                                  "border-2 border-red-600/80",
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
                                  "absolute -right-1 -top-2 bg-gray-900 px-2 py-0 text-[12px] font-bold text-white",
                                  getTemplateQuantityInInventory(req.item.id) === 0 && "text-red-600",
                                )}
                              >
                                x{req.quantityPerUnit}
                              </Badge>
                            </div>
                            <div className="max-w-[72px] text-xs text-white/80">
                              {req.item.name}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          You have:{" "}
                          <span
                            className={
                              getTemplateQuantityInInventory(req.item.id) > 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"
                            }
                          >
                            {getTemplateQuantityInInventory(req.item.id)}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </TooltipProvider>
              )}
            </div>
          ) : null}

          {/* Start Button */}
          <Button
            onClick={handleStart}
            disabled={isStarting}
            className="w-full"
            size="lg"
          >
            {isStarting ? "Starting..." : "Start"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
