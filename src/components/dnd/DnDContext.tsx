"use client";

import React, { createContext, ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DndContext as DndKitContext,
  DragOverlay,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import Image from "next/image";
import { useUserContext } from "~/context/userContext";
import { useEquipmentContext } from "~/context/equipmentContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { equipmentQueryKeys, inventoryQueryKeys } from "~/lib/query-keys";
import {
  InventorySlotWithItem,
  EquipmentSlotsWithItems,
} from "~/types/inventory";
import { EQUIPMENT_INDEX_MAP } from "~/utils/itemEquipTo";
import {
  canEquipToSlot,
  getDisplacedHand,
  meetsItemLevelRequirement,
} from "~/utils/inventoryClient";
import { useState } from "react";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import toast from "react-hot-toast";
import type { ItemWithStats } from "~/types/stats";
import { ItemRarityMark } from "~/utils/ui/rarity-mark";

// Export for backward compatibility
export type InventorySlot = InventorySlotWithItem;

interface DndContextProps {
  inventory: InventorySlotWithItem[];
  equipment: EquipmentSlotsWithItems;
  deleteSlot: InventorySlotWithItem;
  isLoading: boolean;
}

const DndContext = createContext<DndContextProps | undefined>(undefined);

interface DndProviderProps {
  children: ReactNode;
  initialInventory: InventorySlotWithItem[];
}

type InventoryData = {
  slots: InventorySlotWithItem[];
  deleteSlot: InventorySlotWithItem;
};

type MutationContext = {
  previousInventory?: InventoryData;
  previousEquipment?: EquipmentSlotsWithItems;
};

/** One move: the new bag layout, plus equipment and delete slot when they change. */
type LayoutChange = {
  inventory: InventorySlotWithItem[];
  equipment?: EquipmentSlotsWithItems;
  deleteSlot?: InventorySlotWithItem;
};

const EMPTY_DELETE_SLOT: InventorySlotWithItem = { slotIndex: 999, item: null };

export const DndProvider: React.FC<DndProviderProps> = ({
  children,
  initialInventory,
}) => {
  const { user } = useUserContext();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const inventoryKey = inventoryQueryKeys.byUser(user?.id);

  const { active: isActionActive } = useVocationalActiveActionContext();
  
  // Use global equipment context instead of local state
  const { equipment } = useEquipmentContext();
  const equipmentKey = equipmentQueryKeys.byUser(user?.id);

  const fetchInventory = async (): Promise<{ slots: InventorySlotWithItem[], deleteSlot: InventorySlotWithItem }> => {
    const response = await fetch(`/api/inventory?userId=${user?.id}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Error fetching inventory");
    }
    const data = await response.json();
    return {
      slots: data.slots as InventorySlotWithItem[],
      deleteSlot: data.deleteSlot as InventorySlotWithItem
    };
  };

  const inventoryQuery = useQuery({
    queryKey: inventoryKey,
    initialData: { slots: initialInventory, deleteSlot: { slotIndex: 999, item: null } },
    queryFn: fetchInventory,
    enabled: !!user?.id,
    staleTime: 0, // Always fresh - invalidation triggers immediate refetch for real-time updates
    // Important: Next.js can keep route segments cached client-side.
    // When navigating away/back to /profile, we must refetch to avoid showing stale stacks.
    refetchOnMount: true,
  });

  // If Next keeps this segment mounted (router cache), this ensures we still refresh
  // when the user navigates back to /profile.
  useEffect(() => {
    if (!user?.id) return;
    if (pathname !== "/profile") return;
    void inventoryQuery.refetch();
  }, [pathname, user?.id]);

  // Every move is saved as one request, so an item moving between the bag,
  // equipment and the delete slot is never in two places or in none; the
  // server rejects anything that isn't a pure rearrangement. Moves queue up
  // (one scope) so a quick second drag can't land before the first.
  const saveLayout = useMutation<unknown, Error, LayoutChange, MutationContext>({
    scope: { id: "inventory-layout" },
    mutationFn: async (change) => {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory: change.inventory.map((slot) => ({
            slotIndex: slot.slotIndex,
            item: slot.item ? { id: slot.item.id } : null,
          })),
          ...(change.equipment
            ? {
                equipment: Object.fromEntries(
                  Object.entries(change.equipment).map(([slot, item]) => [
                    slot,
                    item?.id ?? null,
                  ]),
                ),
              }
            : {}),
          ...(change.deleteSlot
            ? { deleteSlotId: change.deleteSlot.item?.id ?? null }
            : {}),
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          data?.error ?? "Couldn't save your inventory. Please try again.",
        );
      }
      return response.json();
    },
    onMutate: async (change) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: inventoryKey }),
        queryClient.cancelQueries({ queryKey: equipmentKey }),
      ]);
      const previousInventory =
        queryClient.getQueryData<InventoryData>(inventoryKey);
      const previousEquipment =
        queryClient.getQueryData<EquipmentSlotsWithItems>(equipmentKey);

      queryClient.setQueryData<InventoryData>(inventoryKey, {
        slots: change.inventory,
        deleteSlot:
          change.deleteSlot ??
          previousInventory?.deleteSlot ??
          EMPTY_DELETE_SLOT,
      });
      if (change.equipment) {
        queryClient.setQueryData(equipmentKey, change.equipment);
      }
      return { previousInventory, previousEquipment };
    },
    onError: (error, _change, context) => {
      if (context?.previousInventory) {
        queryClient.setQueryData(inventoryKey, context.previousInventory);
      }
      if (context?.previousEquipment) {
        queryClient.setQueryData(equipmentKey, context.previousEquipment);
      }
      toast.error(error.message);
      // Whatever the server has now is the truth.
      void queryClient.invalidateQueries({ queryKey: inventoryKey });
      void queryClient.invalidateQueries({ queryKey: equipmentKey });
    },
    onSuccess: (_data, change) => {
      // Equipment can change the bag's size (backpacks, carrying capacity).
      if (change.equipment) {
        void queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() });
        void queryClient.invalidateQueries({ queryKey: equipmentKey });
      }
    },
  });

  const inventory = inventoryQuery.data?.slots || [];
  const [deleteSlot, setDeleteSlot] = useState<InventorySlotWithItem>(
    inventoryQuery.data?.deleteSlot || EMPTY_DELETE_SLOT
  );
  
  // Update deleteSlot when query data changes
  useEffect(() => {
    if (inventoryQuery.data?.deleteSlot) {
      setDeleteSlot(inventoryQuery.data.deleteSlot);
    }
  }, [inventoryQuery.data]);
  
  const isLoading = inventoryQuery.isLoading;

  // The dragged item is drawn in an overlay so scrolling slot lists (tools)
  // can't clip it on its way out.
  const [draggedItem, setDraggedItem] = useState<ItemWithStats | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  // Sends the other hand's item to the first free bag slot, for a two-handed
  // weapon; returns false when the bags are full.
  const moveToBags = (
    updatedEquipment: EquipmentSlotsWithItems,
    updatedInventory: InventorySlotWithItem[],
    hand: "weapon" | "offhand",
  ): boolean => {
    const freeIndex = updatedInventory.findIndex((slot) => !slot.item);
    const freeSlot = updatedInventory[freeIndex];
    if (!freeSlot) {
      toast.error("Inventory is full, so your other hand can't be emptied.");
      return false;
    }
    updatedInventory[freeIndex] = { ...freeSlot, item: updatedEquipment[hand] };
    updatedEquipment[hand] = null;
    return true;
  };

  const toDeleteSlot = (item: InventorySlotWithItem["item"]) => ({
    slotIndex: 999,
    item,
  });

  // Dropping onto an occupied delete slot destroys what is already in it.
  // False when the player cancels or the delete fails.
  const confirmDeleteOfSlotItem = async () => {
    if (!deleteSlot.item) return true;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${deleteSlot.item.name}"?\n\nThis action cannot be undone.`,
    );
    if (!confirmed) return false;

    try {
      const response = await fetch(`/api/inventory/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userItemId: deleteSlot.item.id }),
      });
      if (!response.ok) throw new Error("Delete failed");
    } catch (error) {
      console.error("Failed to delete item:", error);
      toast.error("Failed to delete item. Please try again.");
      void queryClient.invalidateQueries({ queryKey: inventoryKey });
      return false;
    }
    return true;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !active) return;

    const activeIndex = active.data.current?.index as number | undefined;
    const overIndex = over.data.current?.index as number | undefined;
    const activeContainer = active.data.current?.container as
      | string
      | undefined;
    const overContainer = over.data.current?.container as string | undefined;

    if (activeIndex === undefined || overIndex === undefined) return;
    if (!activeContainer || !overContainer) return;

    // Block any equipment changes while an action is active.
    if (
      isActionActive &&
      (activeContainer === "equipment" || overContainer === "equipment")
    ) {
      toast.error("You cannot equip or unequip items while an action is active.");
      return;
    }

    // Check both directions before changing inventory, equipment or the delete slot.
    // Quick equip uses this same path through a synthetic drag event.
    const itemAt = (container: string, index: number) => {
      if (container === "inventory") return inventory[index]?.item;
      if (container === "delete") return deleteSlot.item;
      if (container === "equipment") {
        const slot = EQUIPMENT_INDEX_MAP[index];
        return slot ? equipment[slot] : null;
      }
      return null;
    };
    const enteringEquipment = [
      overContainer === "equipment" ? itemAt(activeContainer, activeIndex) : null,
      activeContainer === "equipment" ? itemAt(overContainer, overIndex) : null,
    ];
    const levelLockedItem = enteringEquipment.find(
      (item) => item && !meetsItemLevelRequirement(item, user?.level ?? 0),
    );
    if (levelLockedItem) {
      toast.error(`Requires level ${levelLockedItem.requiredLevel ?? 1} to equip ${levelLockedItem.name}.`);
      return;
    }

    // Same container swaps
    if (activeContainer === overContainer) {
      if (activeContainer === "inventory") {
        const updatedInventory = inventory.map((slot) => ({ ...slot }));
        const activeSlot = updatedInventory[activeIndex];
        const overSlot = updatedInventory[overIndex];

        if (!activeSlot || !overSlot) return;

        // Check if both slots have items and they can stack together
        if (
          activeSlot.item &&
          overSlot.item &&
          activeSlot.item.id !== overSlot.item.id && // Different UserItems
          activeSlot.item.name === overSlot.item.name && // Same item name (better proxy for same template)
          activeSlot.item.rarity === overSlot.item.rarity && // Same rarity
          activeSlot.item.quantity && // Has quantity (stackable)
          overSlot.item.quantity // Has quantity (stackable)
        ) {
          // Store IDs before modifying
          const sourceItemId = activeSlot.item.id;
          const targetItemId = overSlot.item.id;
          
          // Calculate merge result optimistically
          const sourceQty = activeSlot.item.quantity;
          const targetQty = overSlot.item.quantity;
          const totalQty = sourceQty + targetQty;
          
          // Assume max stack size of 99 (or get from item if available)
          const maxStackSize = 99;
          
          // Optimistic update: Apply changes immediately to UI
          if (totalQty <= maxStackSize) {
            // Full merge - update target, clear source
            overSlot.item = {
              ...overSlot.item,
              quantity: totalQty,
            };
            activeSlot.item = null;
          } else {
            // Partial merge - fill target to max, keep remainder in source
            overSlot.item = {
              ...overSlot.item,
              quantity: maxStackSize,
            };
            activeSlot.item = {
              ...activeSlot.item,
              quantity: totalQty - maxStackSize,
            };
          }
          
          // Apply optimistic update immediately for instant UI feedback
          queryClient.setQueryData(inventoryKey, {
            slots: updatedInventory,
            deleteSlot,
          });

          // Send to server in background
          fetch("/api/inventory/merge-stacks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceUserItemId: sourceItemId,
              targetUserItemId: targetItemId,
            }),
          })
            .then(async (response) => {
              if (response.ok) {
                // Sync with server to correct any discrepancies (e.g., different maxStackSize)
                await queryClient.invalidateQueries({ queryKey: inventoryKey });
              } else {
                // Revert on error
                await queryClient.invalidateQueries({ queryKey: inventoryKey });
              }
            })
            .catch((error) => {
              console.error("Failed to merge stacks:", error);
              // Revert on error
              queryClient.invalidateQueries({ queryKey: inventoryKey });
            });
          
          return; // Exit early, changes already applied optimistically
        }

        // Swap items (default behavior)
        [activeSlot.item, overSlot.item] = [overSlot.item, activeSlot.item];

        saveLayout.mutate({ inventory: updatedInventory });
      } else if (activeContainer === "equipment") {
        const equipmentKeyActive = EQUIPMENT_INDEX_MAP[activeIndex];
        const equipmentKeyOver = EQUIPMENT_INDEX_MAP[overIndex];

        if (!equipmentKeyActive || !equipmentKeyOver) return;

        const updatedEquipment = { ...equipment };
        
        // Get the items being moved
        const activeItem = updatedEquipment[equipmentKeyActive];
        const overItem = updatedEquipment[equipmentKeyOver];

        // Validate that active item can be equipped to the target slot
        if (activeItem && !canEquipToSlot(activeItem, equipmentKeyOver)) {
          alert(`Cannot equip ${activeItem.name} to ${equipmentKeyOver} slot`);
          return;
        }

        // If swapping, validate that the over item can go to the active slot
        if (overItem && !canEquipToSlot(overItem, equipmentKeyActive)) {
          alert(`Cannot equip ${overItem.name} to ${equipmentKeyActive} slot`);
          return;
        }

        // Swap items
        [
          updatedEquipment[equipmentKeyActive],
          updatedEquipment[equipmentKeyOver],
        ] = [
          updatedEquipment[equipmentKeyOver],
          updatedEquipment[equipmentKeyActive],
        ];

        saveLayout.mutate({ inventory, equipment: updatedEquipment });
      }
    }
    // Cross-container moves
    else {
      // Inventory → Delete Slot
      if (activeContainer === "inventory" && overContainer === "delete") {
        const updatedInventory = inventory.map((slot) => ({ ...slot }));
        const activeSlot = updatedInventory[activeIndex];
        
        if (!activeSlot || !activeSlot.item) return;

        if (!(await confirmDeleteOfSlotItem())) return;

        // Move item to delete slot
        const item = activeSlot.item;
        activeSlot.item = null;
        saveLayout.mutate({
          inventory: updatedInventory,
          deleteSlot: toDeleteSlot(item),
        });
      }
      // Equipment → Delete Slot
      else if (activeContainer === "equipment" && overContainer === "delete") {
        const updatedEquipment = { ...equipment };
        const equipmentKey = EQUIPMENT_INDEX_MAP[activeIndex];

        if (!equipmentKey) return;

        const item = updatedEquipment[equipmentKey];
        if (!item) return;

        if (!(await confirmDeleteOfSlotItem())) return;

        // Move item to delete slot
        updatedEquipment[equipmentKey] = null;
        saveLayout.mutate({
          inventory,
          equipment: updatedEquipment,
          deleteSlot: toDeleteSlot(item),
        });
      }
      // Delete Slot → Inventory
      else if (activeContainer == "delete" && overContainer === "inventory") {
        const updatedInventory = inventory.map((slot) => ({ ...slot }));
        const overSlot = updatedInventory[overIndex];
        
        if (!overSlot || !deleteSlot.item) return;

        // Swap items
        const existingItem = overSlot.item;
        overSlot.item = deleteSlot.item;

        saveLayout.mutate({
          inventory: updatedInventory,
          deleteSlot: toDeleteSlot(existingItem),
        });
      }
      // Delete Slot → Equipment
      else if (activeContainer === "delete" && overContainer === "equipment") {
        const updatedEquipment = { ...equipment };
        const equipmentKey = EQUIPMENT_INDEX_MAP[overIndex];

        if (!equipmentKey || !deleteSlot.item) return;

        // Validate equipment slot compatibility
        if (!canEquipToSlot(deleteSlot.item, equipmentKey)) {
          alert(`Cannot equip ${deleteSlot.item.name} to ${equipmentKey} slot`);
          return;
        }

        // Swap items
        const existingItem = updatedEquipment[equipmentKey];
        updatedEquipment[equipmentKey] = deleteSlot.item;

        const updatedInventory = inventory.map((slot) => ({ ...slot }));
        const otherHand = getDisplacedHand(updatedEquipment, equipmentKey);
        if (
          otherHand &&
          !moveToBags(updatedEquipment, updatedInventory, otherHand)
        )
          return;
        
        saveLayout.mutate({
          inventory: updatedInventory,
          equipment: updatedEquipment,
          deleteSlot: toDeleteSlot(existingItem),
        });
      }
      // Inventory → Equipment
      else if (activeContainer === "inventory" && overContainer === "equipment") {
        const updatedInventory = inventory.map((slot) => ({ ...slot }));
        const updatedEquipment = { ...equipment };
        const equipmentKey = EQUIPMENT_INDEX_MAP[overIndex];

        if (!equipmentKey) return;

        const activeSlot = updatedInventory[activeIndex];
        if (!activeSlot) return;

        const item = activeSlot.item;
        if (!item) return;

        // Validate equipment slot compatibility
        if (!canEquipToSlot(item, equipmentKey)) {
          alert(`Cannot equip ${item.name} to ${equipmentKey} slot`);
          return;
        }

        // Swap or move
        const existingItem = updatedEquipment[equipmentKey];
        updatedEquipment[equipmentKey] = item;
        updatedInventory[activeIndex] = { ...activeSlot, item: existingItem };

        const otherHand = getDisplacedHand(updatedEquipment, equipmentKey);
        if (
          otherHand &&
          !moveToBags(updatedEquipment, updatedInventory, otherHand)
        )
          return;

        saveLayout.mutate({
          inventory: updatedInventory,
          equipment: updatedEquipment,
        });
      }
      // Equipment → Inventory
      else if (
        activeContainer === "equipment" &&
        overContainer === "inventory"
      ) {
        const updatedInventory = inventory.map((slot) => ({ ...slot }));
        const updatedEquipment = { ...equipment };
        const equipmentKey = EQUIPMENT_INDEX_MAP[activeIndex];

        if (!equipmentKey) return;

        const overSlot = updatedInventory[overIndex];
        if (!overSlot) return;

        const item = updatedEquipment[equipmentKey];
        if (!item) return;

        // Check if unequipping a backpack would cause items to be inaccessible
        if (equipmentKey === "backpack") {
          const BASE_CAPACITY = 25;
          
          // Find items in bonus slots (slots >= BASE_CAPACITY)
          const itemsInBonusSlots = inventory
            .slice(BASE_CAPACITY)
            .filter(slot => slot.item !== null);
          
          if (itemsInBonusSlots.length > 0) {
            // Count empty slots in base capacity
            const emptyBaseSlots = inventory
              .slice(0, BASE_CAPACITY)
              .filter(slot => slot.item === null).length;
            
            if (emptyBaseSlots >= itemsInBonusSlots.length) {
              // All items can be moved - show info message
              const confirmed = window.confirm(
                `You have ${itemsInBonusSlots.length} item(s) in bonus slots.\n\n` +
                `These items will be automatically moved to empty slots when you unequip this backpack.\n\n` +
                `Continue?`
              );
              
              if (!confirmed) return;
            } else {
              // Not enough space - prevent unequip
              alert(
                `Cannot unequip backpack!\n\n` +
                `You have ${itemsInBonusSlots.length} item(s) in bonus slots but only ${emptyBaseSlots} empty base slot(s).\n\n` +
                `Please remove ${itemsInBonusSlots.length - emptyBaseSlots} item(s) from bonus slots first.`
              );
              return;
            }
          }
        }

        // If swapping with an item from inventory, validate it can go to the equipment slot
        const existingItem = overSlot.item;
        if (existingItem && !canEquipToSlot(existingItem, equipmentKey)) {
          alert(`Cannot equip ${existingItem.name} to ${equipmentKey} slot`);
          return;
        }

        // Swap or move
        updatedInventory[overIndex] = { ...overSlot, item };
        updatedEquipment[equipmentKey] = existingItem;

        const otherHand = getDisplacedHand(updatedEquipment, equipmentKey);
        if (
          otherHand &&
          !moveToBags(updatedEquipment, updatedInventory, otherHand)
        )
          return;

        saveLayout.mutate({
          inventory: updatedInventory,
          equipment: updatedEquipment,
        });
      }
    }
  };

  // Handle quick equip/unequip from popup
  const handleQuickEquip = (event: CustomEvent) => {
    const { fromContainer, fromIndex, toContainer, toIndex } = event.detail;

    // Create a synthetic drag end event
    const syntheticEvent = {
      active: {
        data: {
          current: {
            index: fromIndex,
            container: fromContainer,
          },
        },
      },
      over: {
        data: {
          current: {
            index: toIndex,
            container: toContainer,
          },
        },
      },
    };

    // @ts-ignore - calling handleDragEnd with synthetic event
    handleDragEnd(syntheticEvent);
  };

  useEffect(() => {
    // @ts-ignore - CustomEvent type
    window.addEventListener("quickEquip", handleQuickEquip);
    
    return () => {
      // @ts-ignore - CustomEvent type
      window.removeEventListener("quickEquip", handleQuickEquip);
    };
  }, [inventory, equipment]); // Re-attach when inventory/equipment changes

  return (
    <DndContext.Provider
      value={{
        inventory,
        equipment,
        deleteSlot,
        isLoading,
      }}
    >
      <DndKitContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) =>
          setDraggedItem(
            (active.data.current?.item as ItemWithStats | undefined) ?? null,
          )
        }
        onDragEnd={(event) => {
          setDraggedItem(null);
          void handleDragEnd(event);
        }}
        onDragCancel={() => setDraggedItem(null)}
        id="unique-dnd-context"
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {draggedItem ? (
            <div className="game-item-trigger game-drag-overlay">
              <Image
                alt=""
                src={draggedItem.sprite}
                width={102}
                height={102}
                className="object-contain"
              />
              <ItemRarityMark rarity={draggedItem.rarity} />
              {draggedItem.quantity && draggedItem.quantity > 1 && (
                <div className="game-item-quantity">
                  {draggedItem.quantity}
                </div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndKitContext>
    </DndContext.Provider>
  );
};

export const useDndContext = () => {
  const context = React.useContext(DndContext);
  if (context === undefined) {
    throw new Error("useDndContext must be used within a DndProvider");
  }
  return context;
};

// Use this on pages that may not be wrapped in DndProvider.
export const useOptionalDndContext = () => {
  return React.useContext(DndContext);
};
