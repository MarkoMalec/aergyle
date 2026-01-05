"use client";

import React, { createContext, ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DndContext as DndKitContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { useUserContext } from "~/context/userContext";
import { useEquipmentContext } from "~/context/equipmentContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inventoryQueryKeys } from "~/lib/query-keys";
import {
  InventorySlotWithItem,
  EquipmentSlotsWithItems,
  EQUIPMENT_INDEX_MAP,
  EquipmentSlotType,
} from "~/types/inventory";
import { canEquipToSlot } from "~/utils/inventoryClient";
import { useState } from "react";
import { useVocationalActiveActionContext } from "~/components/game/actions/VocationalActiveActionProvider";
import toast from "react-hot-toast";

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
  initialEquipment: EquipmentSlotsWithItems;
}

type MutationContext = {
  previousInventory?: {
    slots: InventorySlotWithItem[];
    deleteSlot: InventorySlotWithItem;
  };
  previousEquipment?: EquipmentSlotsWithItems;
};

export const DndProvider: React.FC<DndProviderProps> = ({
  children,
  initialInventory,
  initialEquipment,
}) => {
  const { user } = useUserContext();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const inventoryKey = inventoryQueryKeys.byUser(user?.id);

  const { active: isActionActive } = useVocationalActiveActionContext();
  
  // Use global equipment context instead of local state
  const { equipment, updateEquipment: updateGlobalEquipment } = useEquipmentContext();

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

  const updateInventoryOrder = useMutation<
    unknown,
    Error,
    InventorySlotWithItem[],
    MutationContext
  >({
    mutationFn: async (newSlots: InventorySlotWithItem[]) => {
      const slotsToSend = newSlots.map((slot) => ({
        slotIndex: slot.slotIndex,
        item: slot.item ? { id: slot.item.id } : null,
      }));
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, inventory: slotsToSend }),
      });
      if (!response.ok) {
        throw new Error("Error updating inventory order");
      }
      return response.json();
    },
    onMutate: async (newInventory) => {
      await queryClient.cancelQueries({ queryKey: inventoryKey });
      const previousData = queryClient.getQueryData<{
        slots: InventorySlotWithItem[];
        deleteSlot: InventorySlotWithItem;
      }>(inventoryKey);
      
      // Optimistically update with new inventory, keeping existing deleteSlot
      queryClient.setQueryData(inventoryKey, {
        slots: newInventory,
        deleteSlot: previousData?.deleteSlot || { slotIndex: 999, item: null }
      });
      
      return { previousInventory: previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousInventory) {
        queryClient.setQueryData(
          inventoryKey,
          context.previousInventory,
        );
      }
      console.error("Failed to update inventory:", error);
      alert("Failed to update inventory. Please try again.");
    },
    onSuccess: () => {
      // Don't invalidate, just keep the optimistic update
      // The server response should match what we already set
    },
  });

  // Helper function to update delete slot in database
  const updateDeleteSlotInDB = async (newDeleteSlot: InventorySlotWithItem) => {
    try {
      // Optimistically update the cache
      const currentData = queryClient.getQueryData<{
        slots: InventorySlotWithItem[];
        deleteSlot: InventorySlotWithItem;
      }>(inventoryKey);
      
      if (currentData) {
        queryClient.setQueryData(inventoryKey, {
          ...currentData,
          deleteSlot: newDeleteSlot
        });
      }
      
      // Update the database
      await fetch("/api/inventory/delete-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          deleteSlotId: newDeleteSlot.item?.id || null,
        }),
      });
    } catch (error) {
      console.error("Failed to update delete slot:", error);
    }
  };

  // No need for local equipment mutation - use global one
  const updateEquipmentOrder = {
    mutateAsync: updateGlobalEquipment,
  };

  const inventory = inventoryQuery.data?.slots || [];
  const [deleteSlot, setDeleteSlot] = useState<InventorySlotWithItem>(
    inventoryQuery.data?.deleteSlot || { slotIndex: 999, item: null }
  );
  
  // Update deleteSlot when query data changes
  useEffect(() => {
    if (inventoryQuery.data?.deleteSlot) {
      setDeleteSlot(inventoryQuery.data.deleteSlot);
    }
  }, [inventoryQuery.data]);
  
  const isLoading = inventoryQuery.isLoading;

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

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

    // Same container swaps
    if (activeContainer === overContainer) {
      if (activeContainer === "inventory") {
        const updatedInventory = [...inventory];
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

        updateInventoryOrder.mutate(updatedInventory);
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

        updateEquipmentOrder.mutateAsync(updatedEquipment);
      }
    }
    // Cross-container moves
    else {
      // Inventory → Delete Slot
      if (activeContainer === "inventory" && overContainer === "delete") {
        const updatedInventory = [...inventory];
        const activeSlot = updatedInventory[activeIndex];
        
        if (!activeSlot || !activeSlot.item) return;

        // If delete slot already has an item, confirm deletion
        if (deleteSlot.item) {
          const confirmed = window.confirm(
            `Are you sure you want to delete "${deleteSlot.item.name}"?\n\nThis action cannot be undone.`
          );
          
          if (!confirmed) return;
          
          // Delete the item from database
          try {
            await fetch(`/api/inventory/delete`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user?.id,
                userItemId: deleteSlot.item.id,
              }),
            });
          } catch (error) {
            console.error("Failed to delete item:", error);
            alert("Failed to delete item. Please try again.");
            return;
          }
        }

        // Move item to delete slot
        const newDeleteSlot = {
          slotIndex: 999,
          item: activeSlot.item,
        };
        setDeleteSlot(newDeleteSlot);
        updateDeleteSlotInDB(newDeleteSlot);
        
        // Remove from inventory
        activeSlot.item = null;
        updateInventoryOrder.mutate(updatedInventory);
      }
      // Equipment → Delete Slot
      else if (activeContainer === "equipment" && overContainer === "delete") {
        const updatedEquipment = { ...equipment };
        const equipmentKey = EQUIPMENT_INDEX_MAP[activeIndex];

        if (!equipmentKey) return;

        const item = updatedEquipment[equipmentKey];
        if (!item) return;

        // If delete slot already has an item, confirm deletion
        if (deleteSlot.item) {
          const confirmed = window.confirm(
            `Are you sure you want to delete "${deleteSlot.item.name}"?\n\nThis action cannot be undone.`
          );
          
          if (!confirmed) return;
          
          // Delete the item from database
          try {
            await fetch(`/api/inventory/delete`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user?.id,
                userItemId: deleteSlot.item.id,
              }),
            });
          } catch (error) {
            console.error("Failed to delete item:", error);
            alert("Failed to delete item. Please try again.");
            return;
          }
        }

        // Move item to delete slot
        const newDeleteSlot = {
          slotIndex: 999,
          item: item,
        };
        setDeleteSlot(newDeleteSlot);
        updateDeleteSlotInDB(newDeleteSlot);
        
        // Remove from equipment
        updatedEquipment[equipmentKey] = null;
        updateEquipmentOrder.mutateAsync(updatedEquipment);
      }
      // Delete Slot → Inventory
      else if (activeContainer == "delete" && overContainer === "inventory") {
        const updatedInventory = [...inventory];
        const overSlot = updatedInventory[overIndex];
        
        if (!overSlot || !deleteSlot.item) return;

        // Swap items
        const existingItem = overSlot.item;
        overSlot.item = deleteSlot.item;
        
        const newDeleteSlot = {
          slotIndex: 999,
          item: existingItem,
        };
        setDeleteSlot(newDeleteSlot);
        updateDeleteSlotInDB(newDeleteSlot);

        updateInventoryOrder.mutate(updatedInventory);
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
        
        const newDeleteSlot = {
          slotIndex: 999,
          item: existingItem,
        };
        setDeleteSlot(newDeleteSlot);
        updateDeleteSlotInDB(newDeleteSlot);

        updateEquipmentOrder.mutateAsync(updatedEquipment);
      }
      // Inventory → Equipment
      else if (activeContainer === "inventory" && overContainer === "equipment") {
        const updatedInventory = [...inventory];
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
        activeSlot.item = existingItem;

        updateInventoryOrder.mutate(updatedInventory);
        updateEquipmentOrder.mutateAsync(updatedEquipment);
      }
      // Equipment → Inventory
      else if (
        activeContainer === "equipment" &&
        overContainer === "inventory"
      ) {
        const updatedInventory = [...inventory];
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
        overSlot.item = item;
        updatedEquipment[equipmentKey] = existingItem;

        updateInventoryOrder.mutate(updatedInventory);
        updateEquipmentOrder.mutateAsync(updatedEquipment);
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
        onDragEnd={handleDragEnd}
        id="unique-dnd-context"
      >
        {children}
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
