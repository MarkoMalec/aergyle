"use client";

import Image from "next/image";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import { useRef, useState } from "react";
import type { ItemWithStats } from "~/types/stats";
import { useRarityColors } from "~/hooks/use-rarity-colors";
import { rarityStyle } from "~/utils/rarity-colors";
import {
  ItemDetails,
  ItemDetailsPopoverContent,
  itemHasImmediateHealing,
  itemHasTimedEffect,
} from "~/components/game/items/ItemDetails";
import { ListItemDialog } from "~/components/game/marketplace/ListItemDialog";
import { cn } from "~/lib/utils";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import { Button } from "~/components/ui/button";
import {
  BookCheck,
  BookOpen,
  FlaskConical,
  Loader2,
  Shield,
  ShieldOff,
  Split,
  Store,
  Utensils,
} from "lucide-react";
import { SplitStackDialog } from "./SplitStackDialog";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";
import { useUserContext } from "~/context/userContext";
import { meetsItemLevelRequirement } from "~/utils/inventoryClient";
import { ItemType } from "~/generated/prisma/enums";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  foodEffectQueryKeys,
  inventoryQueryKeys,
  recipeQueryKeys,
} from "~/lib/query-keys";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

/** Compact borderless actions that share one equal-width row under the item card. */
const actionClass = "h-8 w-full px-2 text-xs";
/** The main action is tinted gold rather than solid, so it leads without shouting. */
const primaryActionClass = cn(
  actionClass,
  "bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary",
);
const secondaryActionClass = cn(
  actionClass,
  "bg-surface-inset/70 text-foreground hover:bg-surface-inset hover:text-foreground",
);

interface SingleItemTemplateProps {
  item: ItemWithStats;
  sprite: string;
  container?: string;
  index?: number;
  onEquip?: () => void;
  onUnequip?: () => void;
  showEquipButton?: boolean;
  showUnequipButton?: boolean;
  showListButton?: boolean;
  children?: React.ReactNode; // For the image/trigger wrapper
  className?: string;
}

export default function SingleItemTemplate({
  item,
  sprite,
  container,
  onEquip,
  onUnequip,
  showEquipButton = false,
  showUnequipButton = false,
  showListButton = false,
  children,
  className,
}: SingleItemTemplateProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [isLearningRecipe, setIsLearningRecipe] = useState(false);
  const [isEating, setIsEating] = useState(false);

  const { active: isActionActive } = useVocationalActiveActionContext();
  const { user } = useUserContext();
  const queryClient = useQueryClient();
  const router = useRouter();
  const meetsLevel = meetsItemLevelRequirement(item, user?.level ?? 0);
  const isRecipe = item.itemType === ItemType.RECIPE;
  const supportsImmediateHealing = itemHasImmediateHealing(item);
  const supportsTimedEffect = itemHasTimedEffect(item.itemType);
  const canUseConsumable =
    supportsImmediateHealing ||
    (supportsTimedEffect &&
      Boolean(item.foodEffectSeconds && item.foodEffectStats?.length));
  const learnedRecipes = useQuery({
    queryKey: recipeQueryKeys.learned(user?.id),
    enabled: isRecipe && Boolean(user?.id),
    queryFn: async (): Promise<{ learnedRecipeItemIds: number[] }> => {
      const response = await fetch("/api/recipes", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load learned recipes");
      return (await response.json()) as { learnedRecipeItemIds: number[] };
    },
    staleTime: 30_000,
  });
  const recipeIsLearned =
    isRecipe &&
    (learnedRecipes.data?.learnedRecipeItemIds ?? []).includes(item.itemId);
  const inInventory = container === "inventory";
  const canUse = inInventory && canUseConsumable;
  const isDrink =
    item.itemType === ItemType.POTION || item.itemType === ItemType.ELIXIR;
  const canLearn = inInventory && isRecipe;
  const canSplit = inInventory && (item.quantity ?? 1) > 1;
  const hasActions =
    showEquipButton ||
    showUnequipButton ||
    canUse ||
    canLearn ||
    showListButton ||
    canSplit;

  const { colors } = useRarityColors();
  const hexColor = colors[item.rarity];
  const itemRarityStyle = rarityStyle(item.rarity, hexColor);

  const handleEquipClick = () => {
    if (isActionActive || !meetsLevel) return;
    if (onEquip) {
      onEquip();
      setOpen(false);
    }
  };

  const handleUnequipClick = () => {
    if (isActionActive) return;
    if (onUnequip) {
      onUnequip();
      setOpen(false);
    }
  };

  const handleLearnRecipe = async () => {
    if (!isRecipe || recipeIsLearned || isLearningRecipe) return;

    setIsLearningRecipe(true);
    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userItemId: item.id }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        recipeName?: string;
        unlockedDishes?: Array<{ name: string }>;
        unlockedCrafts?: Array<{ name: string }>;
      } | null;
      if (!response.ok) {
        toast.error(result?.error ?? "Failed to learn crafting knowledge");
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
        queryClient.invalidateQueries({
          queryKey: recipeQueryKeys.learned(user?.id),
        }),
      ]);
      router.refresh();
      setOpen(false);

      const crafts =
        (result?.unlockedCrafts ?? result?.unlockedDishes)?.map(
          (craft) => craft.name,
        ) ?? [];
      const recipeName = result?.recipeName ?? item.name;
      toast.success(
        crafts.length > 0
          ? `Learned ${recipeName}. Unlocked ${crafts.join(", ")}.`
          : `Learned ${recipeName}.`,
      );
    } catch {
      toast.error("Failed to learn crafting knowledge");
    } finally {
      setIsLearningRecipe(false);
    }
  };

  const handleEat = async () => {
    if (!canUseConsumable || isEating) return;

    setIsEating(true);
    try {
      const response = await fetch("/api/food-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userItemId: item.id }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        effect?: {
          healing?: { healed: number } | null;
          timed?: object | null;
        };
      } | null;
      if (!response.ok) {
        toast.error(result?.error ?? "Failed to use consumable");
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
        queryClient.invalidateQueries({
          queryKey: foodEffectQueryKeys.active(user?.id),
        }),
      ]);
      router.refresh();
      setOpen(false);
      const healed = Math.floor(result?.effect?.healing?.healed ?? 0);
      const isActive = Boolean(result?.effect?.timed);
      toast.success(
        healed > 0
          ? `${item.name} restored ${healed} health${isActive ? " and is now active" : ""}.`
          : isActive
            ? `${item.name} is now active.`
            : `${item.name} was used.`,
      );
    } catch {
      toast.error("Failed to use consumable");
    } finally {
      setIsEating(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && document.activeElement instanceof HTMLElement)
          triggerRef.current = document.activeElement;
        setOpen(nextOpen);
      }}
    >
      {children ?? (
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "game-slot game-item-trigger rarity-frame",
              className,
            )}
            style={itemRarityStyle}
            data-rarity={item.rarity}
            aria-label={`${item.name}, ${item.rarity.toLowerCase()}. Item details`}
          >
            <Image
              alt={item.name}
              src={sprite}
              width={62}
              height={62}
              className="rounded-md"
            />
            <ItemRarityMark rarity={item.rarity} />
          </button>
        </PopoverTrigger>
      )}
      <ItemDetailsPopoverContent
        name={item.name}
        rarity={item.rarity}
        onCloseAutoFocus={(event) => {
          if (listDialogOpen || splitDialogOpen) event.preventDefault();
        }}
      >
        <ItemDetails item={{ ...item, sprite }} />
        {hasActions && (
          <div className="mt-5">
            <div className="grid auto-cols-fr grid-flow-col gap-2">
              {showEquipButton && (
                <Button
                  disabled={isActionActive || !meetsLevel}
                  onClick={handleEquipClick}
                  variant="ghost"
                  className={primaryActionClass}
                >
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  Equip
                </Button>
              )}
              {showUnequipButton && (
                <Button
                  disabled={isActionActive}
                  onClick={handleUnequipClick}
                  variant="ghost"
                  className={secondaryActionClass}
                >
                  <ShieldOff className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  Unequip
                </Button>
              )}
              {canUse && (
                <Button
                  onClick={handleEat}
                  disabled={isEating}
                  variant="ghost"
                  className={primaryActionClass}
                >
                  {isEating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : isDrink ? (
                    <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Utensils className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isEating ? "Using..." : isDrink ? "Drink" : "Use"}
                </Button>
              )}
              {canLearn && (
                <Button
                  onClick={handleLearnRecipe}
                  disabled={
                    isLearningRecipe ||
                    learnedRecipes.isLoading ||
                    recipeIsLearned
                  }
                  variant="ghost"
                  className={primaryActionClass}
                  title="Learn recipe"
                >
                  {isLearningRecipe || learnedRecipes.isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : recipeIsLearned ? (
                    <BookCheck className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isLearningRecipe
                    ? "Learning..."
                    : recipeIsLearned
                      ? "Learned"
                      : "Learn"}
                </Button>
              )}
              {showListButton && (
                <Button
                  onClick={() => {
                    setListDialogOpen(true);
                    setOpen(false);
                  }}
                  variant="ghost"
                  className={secondaryActionClass}
                  title="List on the marketplace"
                >
                  <Store className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  Sell
                </Button>
              )}
              {canSplit && (
                <Button
                  variant="ghost"
                  className={secondaryActionClass}
                  title="Split stack"
                  onClick={() => {
                    setOpen(false);
                    setSplitDialogOpen(true);
                  }}
                >
                  <Split className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  Split
                </Button>
              )}
            </div>
            {isActionActive && (showEquipButton || showUnequipButton) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Finish or stop your active action to change equipment.
              </p>
            )}
          </div>
        )}
      </ItemDetailsPopoverContent>
      <SplitStackDialog
        item={item}
        isOpen={splitDialogOpen}
        returnFocus={() => triggerRef.current?.focus()}
        onClose={() => setSplitDialogOpen(false)}
      />

      {/* List Item Dialog */}
      {item.id && (
        <ListItemDialog
          isOpen={listDialogOpen}
          returnFocus={() => triggerRef.current?.focus()}
          onClose={() => setListDialogOpen(false)}
          userItemId={item.id}
          itemId={item.itemId}
          itemName={item.name}
          sprite={sprite}
          rarity={item.rarity}
          maxQuantity={item.quantity ?? 1}
          stackable={item.stackable ?? false}
        />
      )}
    </Popover>
  );
}
