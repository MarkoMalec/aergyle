import type { QueryClient } from "@tanstack/react-query";
import type { VocationalActionType } from "~/generated/prisma/enums";
import { dispatchSkillProgressEvent } from "~/components/game/skills/skillProgressEvents";
import { inventoryQueryKeys, userQueryKeys } from "~/lib/query-keys";
import type { ItemQuantityChange } from "~/realtime/events";
import type { InventorySlotWithItem } from "~/types/inventory";
import type { SellableItem } from "~/types/marketplace";
import { toSkillNameFromActionType } from "~/utils/vocations";

/**
 * Keeps every on-screen view of a player's items and XP in step with changes made
 * on the server (activity ticks, stops): inventory, marketplace sell list, level
 * badge and skill progress.
 */

type InventoryCache = { slots: InventorySlotWithItem[] };
type SellableCache = { items: SellableItem[] };

/**
 * Applies server-reported stack quantities to the cached inventory and sell list, so
 * counts update without a refetch. Falls back to refetching when a change can't be
 * applied, e.g. a new stack the cache has never seen.
 */
export function applyItemChanges(
  queryClient: QueryClient,
  userId: string | undefined,
  changes: readonly ItemQuantityChange[],
  newStacks: boolean,
) {
  const quantityById = new Map(
    changes.map((change) => [change.userItemId, change.quantity]),
  );
  let needsRefetch = newStacks;

  queryClient.setQueryData<InventoryCache>(
    inventoryQueryKeys.byUser(userId),
    (data) => {
      if (!data) return data;
      let applied = 0;
      const slots = data.slots.map((slot) => {
        const quantity = slot.item ? quantityById.get(slot.item.id) : undefined;
        if (!slot.item || quantity === undefined) return slot;
        applied++;
        return {
          ...slot,
          item: quantity > 0 ? { ...slot.item, quantity } : null,
        };
      });
      if (applied < quantityById.size) needsRefetch = true;
      return { ...data, slots };
    },
  );

  queryClient.setQueryData<SellableCache>(
    inventoryQueryKeys.sellable(userId),
    (data) => {
      if (!data) return data;
      // Stacks missing here are untradeable; new ones arrive with the refetch below.
      const items = data.items.flatMap((item) => {
        const quantity = quantityById.get(item.id);
        if (quantity === undefined) return [item];
        return quantity > 0 ? [{ ...item, quantity }] : [];
      });
      return { ...data, items };
    },
  );

  if (needsRefetch) {
    void queryClient.invalidateQueries({
      queryKey: inventoryQueryKeys.byUser(userId),
    });
  }
}

/** Refreshes XP displays: the level badge and, when given, that skill's progress. */
export function refreshProgress(
  queryClient: QueryClient,
  userId: string | undefined,
  skill?: VocationalActionType | null,
) {
  void queryClient.invalidateQueries({ queryKey: userQueryKeys.level(userId) });
  if (skill) dispatchSkillProgressEvent(toSkillNameFromActionType(skill));
}
