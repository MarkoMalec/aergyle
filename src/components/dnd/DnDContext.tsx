"use client";

import React, { createContext, ReactNode, useEffect } from "react";
import {
  DndContext as DndKitContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { useUserContext } from "~/context/userContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  InventorySlotWithItem,
  EquipmentSlotsWithItems,
  EQUIPMENT_INDEX_MAP,
  EquipmentSlotType,
} from "~/types/inventory";
import { canEquipToSlot } from "~/utils/inventory";

// Export for backward compatibility
export type InventorySlot = InventorySlotWithItem;

interface DndContextProps {
  inventory: InventorySlotWithItem[];
  equipment: EquipmentSlotsWithItems;
  isLoading: boolean;
}

const DndContext = createContext<DndContextProps | undefined>(undefined);

interface DndProviderProps {
  children: ReactNode;
  initialInventory: InventorySlotWithItem[];
  initialEquipment: EquipmentSlotsWithItems;
}

type MutationContext = {
  previousInventory?: InventorySlotWithItem[];
  previousEquipment?: EquipmentSlotsWithItems;
};

export const DndProvider: React.FC<DndProviderProps> = ({
  children,
  initialInventory,
  initialEquipment,
}) => {
  const { user } = useUserContext();
  const queryClient = useQueryClient();

  const fetchInventory = async (): Promise<InventorySlotWithItem[]> => {
    const response = await fetch(`/api/inventory?userId=${user?.id}`);
    if (!response.ok) {
      throw new Error("Error fetching inventory");
    }
    const data = await response.json();
    return data.slots as InventorySlotWithItem[];
  };

  const fetchEquipment = async (): Promise<EquipmentSlotsWithItems> => {
    const response = await fetch(`/api/equipment?userId=${user?.id}`);
    if (!response.ok) {
      throw new Error("Error fetching equipment");
    }
    return await response.json();
  };

  const inventoryQuery = useQuery({
    queryKey: ["inventory", user?.id],
    initialData: initialInventory,
    queryFn: fetchInventory,
    enabled: !!user?.id,
  });

  const equipmentQuery = useQuery({
    queryKey: ["equipment", user?.id],
    initialData: initialEquipment,
    queryFn: fetchEquipment,
    enabled: !!user?.id,
  });

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
      await queryClient.cancelQueries({ queryKey: ["inventory", user?.id] });
      const previousInventory = queryClient.getQueryData<
        InventorySlotWithItem[]
      >(["inventory", user?.id]);
      queryClient.setQueryData(["inventory", user?.id], newInventory);
      return { previousInventory };
    },
    onError: (error, variables, context) => {
      if (context?.previousInventory) {
        queryClient.setQueryData(
          ["inventory", user?.id],
          context.previousInventory,
        );
      }
      console.error("Failed to update inventory:", error);
      alert("Failed to update inventory. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", user?.id] });
    },
  });

  const updateEquipmentOrder = useMutation<
    unknown,
    Error,
    EquipmentSlotsWithItems,
    MutationContext
  >({
    mutationFn: async (newSlots: EquipmentSlotsWithItems) => {
      const equipmentData = Object.keys(newSlots).reduce(
        (acc, key) => {
          const slotKey = key as EquipmentSlotType;
          acc[key] = newSlots[slotKey]?.id || null;
          return acc;
        },
        {} as Record<string, number | null>,
      );
      const response = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, equipment: equipmentData }),
      });
      if (!response.ok) {
        throw new Error("Error updating equipment order");
      }
      return response.json();
    },
    onMutate: async (newEquipment) => {
      await queryClient.cancelQueries({ queryKey: ["equipment", user?.id] });
      const previousEquipment =
        queryClient.getQueryData<EquipmentSlotsWithItems>([
          "equipment",
          user?.id,
        ]);
      queryClient.setQueryData(["equipment", user?.id], newEquipment);
      return { previousEquipment };
    },
    onError: (error, variables, context) => {
      if (context?.previousEquipment) {
        queryClient.setQueryData(
          ["equipment", user?.id],
          context.previousEquipment,
        );
      }
      console.error("Failed to update equipment:", error);
      alert("Failed to update equipment. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", user?.id] });
    },
  });

  const inventory = inventoryQuery.data || [];
  const equipment = equipmentQuery.data || ({} as EquipmentSlotsWithItems);
  const isLoading = inventoryQuery.isLoading || equipmentQuery.isLoading;

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

    // Same container swaps
    if (activeContainer === overContainer) {
      if (activeContainer === "inventory") {
        const updatedInventory = [...inventory];
        const activeSlot = updatedInventory[activeIndex];
        const overSlot = updatedInventory[overIndex];

        if (!activeSlot || !overSlot) return;

        // Swap items
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

        updateEquipmentOrder.mutate(updatedEquipment);
      }
    }
    // Cross-container moves
    else {
      // Inventory → Equipment
      if (activeContainer === "inventory" && overContainer === "equipment") {
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
        updateEquipmentOrder.mutate(updatedEquipment);
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
        updateEquipmentOrder.mutate(updatedEquipment);
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
