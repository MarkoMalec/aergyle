"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import Image from "next/image";
import ResourceStartDialog from "./ResourceStartDialog";
import { Clock, ChevronRight, Lock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import type {
  ItemRarity,
  ItemType,
  VocationalActionType,
} from "~/generated/prisma/enums";
import { ItemInfoPopover } from "~/components/game/items/ItemInfoPopover";
import { useSkillProgress } from "~/components/game/skills/SkillProgressContext";
import { TooltipProvider } from "~/components/ui/tooltip";
import { getCraftingRule } from "~/game/crafting";
import CraftingResourceCatalog from "./CraftingResourceCatalog";

const formatSeconds = (seconds: number) => {
  const rounded = seconds % 1 === 0 ? seconds.toFixed(0) : seconds.toFixed(2);
  return rounded.replace(/\.0+$/, "").replace(/(\.\d+?)0+$/, "$1");
};

export type SkillVocationalResource = {
  id: number;
  actionType: VocationalActionType;
  name: string;
  requiredSkillLevel: number;
  defaultSeconds: number;
  effectiveSeconds: number;
  appliedEfficiency: number;
  yieldPerUnit: number;
  xpPerUnit: number;
  rarity: ItemRarity;
  item: { id: number; sprite: string; itemType: ItemType | null };
  requirements: {
    quantityPerUnit: number;
    item: {
      id: number;
      name: string;
      sprite: string;
      itemType: ItemType | null;
      rarity: ItemRarity;
    };
  }[];
};

export default function SkillVocationalResources(props: {
  resources: SkillVocationalResource[];
  actionType: VocationalActionType;
}) {
  const { resources, actionType } = props;
  const skillProgressState = useSkillProgress();
  const { activeResourceId } = useVocationalActiveActionContext();
  const userLevel = skillProgressState?.skillProgress?.level ?? null;
  const progressLoading = skillProgressState?.progressLoading ?? false;
  const craftingRule = getCraftingRule(actionType);

  const [selectedResource, setSelectedResource] =
    useState<SkillVocationalResource | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const openResourceDialog = useCallback(
    (resource: SkillVocationalResource) => {
      setSelectedResource(resource);
      setDialogOpen(true);
    },
    [],
  );

  const cards = useMemo(() => {
    return resources.map((resource) => {
      const isActive = activeResourceId === resource.id;
      const isLockedByLevel =
        !progressLoading &&
        userLevel !== null &&
        userLevel < resource.requiredSkillLevel;

      return (
        <div
          key={resource.id}
          className="game-resource game-stretched-row"
          data-active={isActive}
          data-locked={isLockedByLevel}
        >
          <span className="flex w-full items-center justify-between gap-2">
            <span className="flex items-center gap-4">
              <ItemInfoPopover
                itemId={resource.item.id}
                rarity={resource.rarity}
                name={resource.name}
              >
                <span className="game-sprite-stage">
                  <Image
                    src={resource.item.sprite}
                    alt={resource.name}
                    width={1080}
                    height={1080}
                    className="h-12 w-12"
                  />
                </span>
              </ItemInfoPopover>
              <div>
                <button
                  type="button"
                  className="game-stretched-action mb-1 block text-base font-semibold text-foreground"
                  disabled={isActive}
                  aria-label={`${resource.name}, level ${resource.requiredSkillLevel}${isActive ? ", in progress" : isLockedByLevel ? ", level requirement not met" : ", view action"}`}
                  onClick={() => !isActive && openResourceDialog(resource)}
                >
                  {resource.name}
                </button>
                <span className="flex flex-wrap gap-1">
                  <Badge
                    className={
                      isLockedByLevel
                        ? "text-xs text-warning"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    Lv. {resource.requiredSkillLevel}
                  </Badge>
                  <Badge className="text-xs text-xp">
                    {resource.xpPerUnit} XP
                  </Badge>
                  <Badge className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={12} />{" "}
                    {formatSeconds(resource.effectiveSeconds)}s
                  </Badge>
                </span>
                {resource.requirements.length > 0 ? (
                  <span className="mt-4 flex items-center gap-2 text-xs text-text-secondary">
                    <TooltipProvider>
                      {resource.requirements.map((requirement) => (
                        <ItemInfoPopover
                          key={requirement.item.id}
                          itemId={requirement.item.id}
                          rarity={requirement.item.rarity}
                          name={requirement.item.name}
                          tooltip={<p>{requirement.item.name}</p>}
                        >
                          <Badge className="gap-1 rounded-[5px] px-2 py-0">
                            <strong>{requirement.quantityPerUnit}</strong>
                            <Image
                              src={requirement.item.sprite}
                              alt={requirement.item.name}
                              width={24}
                              height={24}
                              className="inline-block h-6 w-6"
                            />
                          </Badge>
                        </ItemInfoPopover>
                      ))}
                    </TooltipProvider>
                  </span>
                ) : null}
              </div>
            </span>
            <span className="shrink-0 text-primary">
              {isActive ? (
                <span className="text-xs text-xp">In progress</span>
              ) : isLockedByLevel ? (
                <Lock size={16} aria-hidden="true" />
              ) : (
                <ChevronRight size={18} aria-hidden="true" />
              )}
            </span>
          </span>
        </div>
      );
    });
  }, [
    resources,
    activeResourceId,
    openResourceDialog,
    progressLoading,
    userLevel,
  ]);

  return (
    <>
      {craftingRule ? (
        <CraftingResourceCatalog
          resources={resources}
          rule={craftingRule}
          activeResourceId={activeResourceId}
          userLevel={userLevel}
          progressLoading={progressLoading}
          onSelect={openResourceDialog}
        />
      ) : (
        <div className="space-y-3">
          {cards.length ? (
            cards
          ) : (
            <div className="game-empty-state">
              No resources are available here. Check the world atlas for another
              location.
            </div>
          )}
        </div>
      )}
      <ResourceStartDialog
        resource={selectedResource}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
