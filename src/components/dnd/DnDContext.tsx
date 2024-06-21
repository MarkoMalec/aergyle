// @ts-nocheck
// "use client";

// import React, { createContext, useState, ReactNode } from "react";
// import {
//   DndContext as DndKitContext,
//   closestCenter,
//   MouseSensor,
//   useSensor,
//   useSensors,
//   DragEndEvent,
// } from "@dnd-kit/core";
// import { useUserContext } from "~/context/userContext";
// import { Item } from "@prisma/client";

// export type InventorySlot = {
//   slotIndex: number;
//   item: Item | null;
// };

// interface EquipmentSlots {
//   head: Item | null;
//   necklace: Item | null;
//   chest: Item | null;
//   shoulders: Item | null;
//   arms: Item | null;
//   gloves: Item | null;
//   legs: Item | null;
//   boots: Item | null;
//   belt: Item | null;
//   ring1: Item | null;
//   ring2: Item | null;
//   amulet: Item | null;
//   backpack: Item | null;
//   weapon: Item | null;
// }

// interface DndContextProps {
//   inventory: InventorySlot[];
//   equipment: EquipmentSlots;
//   setInventory: React.Dispatch<React.SetStateAction<InventorySlot[]>>;
//   setEquipment: React.Dispatch<React.SetStateAction<EquipmentSlots>>;
// }

// const DndContext = createContext<DndContextProps | undefined>(undefined);

// interface DndProviderProps {
//   children: ReactNode;
//   initialInventory: InventorySlot[];
//   initialEquipment: EquipmentSlots;
// }

// export const DndProvider: React.FC<DndProviderProps> = ({
//   children,
//   initialInventory,
//   initialEquipment,
// }) => {
//   const { user } = useUserContext();
//   const [inventory, setInventory] = useState<InventorySlot[]>(initialInventory);
//   const [equipment, setEquipment] = useState<EquipmentSlots>(initialEquipment);

//   const sensors = useSensors(
//     useSensor(MouseSensor, {
//       activationConstraint: {
//         distance: 5,
//       },
//     }),
//   );

//   // Map of indices to equipment keys
//   const equipmentIndexMap = {
//     100: "head",
//     101: "necklace",
//     102: "shoulders",
//     103: "chest",
//     104: "arms",
//     105: "gloves",
//     106: "legs",
//     107: "boots",
//     108: "belt",
//     109: "ring1",
//     110: "ring2",
//     111: "amulet",
//     112: "backpack",
//     113: "weapon",
//   };

//   const handleDragEnd = async (event: DragEndEvent) => {
//     const { active, over } = event;

//     if (!over || !active) return;

//     const activeIndex = active.data.current?.index;
//     const overIndex = over.data.current?.index;
//     const activeContainer = active.data.current?.container;
//     const overContainer = over.data.current?.container;

//     console.log("Active Index:", activeIndex);
//     console.log("Over Index:", overIndex);
//     console.log("Active Container:", activeContainer);
//     console.log("Over Container:", overContainer);

//     if (activeIndex !== undefined && overIndex !== undefined) {
//       if (activeContainer === overContainer) {
//         if (activeContainer === "inventory") {
//           const updatedInventory = [...inventory];
//           if (updatedInventory[overIndex]?.item !== null) {
//             [
//               updatedInventory[activeIndex].item,
//               updatedInventory[overIndex].item,
//             ] = [
//               updatedInventory[overIndex]?.item,
//               updatedInventory[activeIndex]?.item,
//             ];
//           } else {
//             updatedInventory[overIndex].item =
//               updatedInventory[activeIndex]?.item;
//             updatedInventory[activeIndex].item = null;
//           }

//           setInventory(updatedInventory);

//           const success = await updateInventoryOrder(updatedInventory);

//           if (!success) {
//             setInventory(inventory);
//           }
//         } else if (activeContainer === "equipment") {
//           const equipmentKeyActive = equipmentIndexMap[activeIndex];
//           const equipmentKeyOver = equipmentIndexMap[overIndex];
//           const updatedEquipment = { ...equipment };

//           if (
//             equipmentKeyActive &&
//             equipmentKeyOver &&
//             updatedEquipment[equipmentKeyActive]?.equipTo === equipmentKeyOver
//           ) {
//             if (updatedEquipment[equipmentKeyOver] !== null) {
//               [
//                 updatedEquipment[equipmentKeyActive],
//                 updatedEquipment[equipmentKeyOver],
//               ] = [
//                 updatedEquipment[equipmentKeyOver],
//                 updatedEquipment[equipmentKeyActive],
//               ];
//             } else {
//               updatedEquipment[equipmentKeyOver] =
//                 updatedEquipment[equipmentKeyActive];
//               updatedEquipment[equipmentKeyActive] = null;
//             }

//             setEquipment(updatedEquipment);

//             const success = await updateEquipmentOrder(updatedEquipment);

//             if (!success) {
//               setEquipment(equipment);
//             }
//           }
//         }
//       } else {
//         // Inventory ==> Equipment
//         if (activeContainer === "inventory" && overContainer === "equipment") {
//           const updatedInventory = [...inventory];
//           const updatedEquipment = { ...equipment };
//           const equipmentKey = equipmentIndexMap[overIndex];

//           console.log("Equipment Key:", equipmentKey);

//           if (equipmentKey !== updatedInventory[activeIndex]?.item?.equipTo && !(equipmentKey === "ring1" || equipmentKey === "ring2")) {
//             // alert(`Item not compatible with slot: ${updatedInventory[activeIndex]?.item?.equipTo}`);
//             return;
//           }

//           if (equipmentKey) {
//             if (updatedEquipment[equipmentKey] !== null) {
//               // Swap items if destination equipment slot is occupied
//               [
//                 updatedInventory[activeIndex].item,
//                 updatedEquipment[equipmentKey],
//               ] = [
//                 updatedEquipment[equipmentKey],
//                 updatedInventory[activeIndex].item,
//               ];
//             } else {
//               // Move item to empty slot
//               updatedEquipment[equipmentKey] =
//                 updatedInventory[activeIndex].item;
//               updatedInventory[activeIndex].item = null;
//             }

//             setInventory(updatedInventory);
//             setEquipment(updatedEquipment);

//             console.log("Updated Inventory:", updatedInventory);
//             console.log("Updated Equipment:", updatedEquipment);

//             const inventorySuccess =
//               await updateInventoryOrder(updatedInventory);
//             const equipmentSuccess =
//               await updateEquipmentOrder(updatedEquipment);

//             if (!inventorySuccess || !equipmentSuccess) {
//               setInventory(inventory);
//               setEquipment(equipment);
//             }
//           }
//         }
//         // Equipment ==> Inventory
//         else if (
//           activeContainer === "equipment" &&
//           overContainer === "inventory"
//         ) {
//           const updatedInventory = [...inventory];
//           const updatedEquipment = { ...equipment };
//           const equipmentKey = equipmentIndexMap[activeIndex];

//           console.log("Equipment Key:", equipmentKey);

//           if (equipmentKey) {
//             if (updatedInventory[overIndex].item !== null) {
//               // Swap items if destination inventory slot is occupied
//               [
//                 updatedInventory[overIndex].item,
//                 updatedEquipment[equipmentKey],
//               ] = [
//                 updatedEquipment[equipmentKey],
//                 updatedInventory[overIndex].item,
//               ];
//             } else {
//               // Move item to empty slot
//               updatedInventory[overIndex].item = updatedEquipment[equipmentKey];
//               updatedEquipment[equipmentKey] = null;
//             }

//             setInventory(updatedInventory);
//             setEquipment(updatedEquipment);

//             console.log("Updated Inventory:", updatedInventory);
//             console.log("Updated Equipment:", updatedEquipment);

//             const inventorySuccess =
//               await updateInventoryOrder(updatedInventory);
//             const equipmentSuccess =
//               await updateEquipmentOrder(updatedEquipment);

//             if (!inventorySuccess || !equipmentSuccess) {
//               setInventory(inventory);
//               setEquipment(equipment);
//             }
//           }
//         }
//       }
//     }
//   };

//   const updateInventoryOrder = async (
//     newSlots: InventorySlot[],
//   ): Promise<boolean> => {
//     const slotsToSend = newSlots.map((slot) => ({
//       slotIndex: slot.slotIndex,
//       item: slot.item ? { id: slot.item.id } : null,
//     }));

//     console.log("Updating Inventory Order:", slotsToSend);

//     try {
//       const response = await fetch("/api/inventory", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ userId: user?.id, inventory: slotsToSend }),
//       });

//       if (!response.ok) {
//         throw new Error("Error updating inventory order");
//       }

//       return true;
//     } catch (error) {
//       console.error("Error updating inventory order:", error);
//       return false;
//     }
//   };

//   const updateEquipmentOrder = async (
//     newSlots: EquipmentSlots,
//   ): Promise<boolean> => {
//     const equipmentData = Object.keys(newSlots).reduce(
//       (acc, key) => {
//         acc[key] = newSlots[key] ? newSlots[key]!.id : null;
//         return acc;
//       },
//       {} as { [key: string]: number | null },
//     );

//     console.log("Updating Equipment Order:", equipmentData);

//     try {
//       const response = await fetch("/api/equipment", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ userId: user?.id, equipment: equipmentData }),
//       });

//       if (!response.ok) {
//         throw new Error("Error updating equipment order");
//       }

//       return true;
//     } catch (error) {
//       console.error("Error updating equipment order:", error);
//       return false;
//     }
//   };

//   return (
//     <DndContext.Provider
//       value={{ inventory, equipment, setInventory, setEquipment }}
//     >
//       <DndKitContext
//         sensors={sensors}
//         collisionDetection={closestCenter}
//         onDragEnd={handleDragEnd}
//         id="unique-id"
//       >
//         {children}
//       </DndKitContext>
//     </DndContext.Provider>
//   );
// };

// export const useDndContext = () => {
//   const context = React.useContext(DndContext);
//   if (context === undefined) {
//     throw new Error("useDndContext must be used within a DndProvider");
//   }
//   return context;
// };

// @ts-nocheck
"use client";

import React, { createContext, ReactNode } from "react";
import {
  DndContext as DndKitContext,
  closestCenter,
  MouseSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { useUserContext } from "~/context/userContext";
import { Item } from "@prisma/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type InventorySlot = {
  slotIndex: number;
  item: Item | null;
};

interface EquipmentSlots {
  head: Item | null;
  necklace: Item | null;
  chest: Item | null;
  shoulders: Item | null;
  arms: Item | null;
  gloves: Item | null;
  legs: Item | null;
  boots: Item | null;
  belt: Item | null;
  ring1: Item | null;
  ring2: Item | null;
  amulet: Item | null;
  backpack: Item | null;
  weapon: Item | null;
}

interface DndContextProps {
  inventory: InventorySlot[];
  equipment: EquipmentSlots;
  setInventory: React.Dispatch<React.SetStateAction<InventorySlot[]>>;
  setEquipment: React.Dispatch<React.SetStateAction<EquipmentSlots>>;
  mutating: boolean;
}

const DndContext = createContext<DndContextProps | undefined>(undefined);

interface DndProviderProps {
  children: ReactNode;
  initialInventory: InventorySlot[];
  initialEquipment: EquipmentSlots;
}

export const DndProvider: React.FC<DndProviderProps> = ({
  children,
  initialInventory,
  initialEquipment,
}) => {
  const { user } = useUserContext();
  const queryClient = useQueryClient();

  const [mutating, setMutating] = React.useState(false);

  const fetchInventory = async () => {
    const response = await fetch(`/api/inventory?userId=${user?.id}`);
    if (!response.ok) {
      throw new Error("Error fetching inventory");
    }
    const data = await response.json();
    return data.slots as InventorySlot[];
  };

  const fetchEquipment = async () => {
    const response = await fetch(`/api/equipment?userId=${user?.id}`);
    if (!response.ok) {
      throw new Error("Error fetching equipment");
    }
    const data = await response.json();
    return data;
  };

  const inventoryQuery = useQuery({
    queryKey: ["inventory", user?.id],
    initialData: initialInventory,
    queryFn: fetchInventory,
  });

  const equipmentQuery = useQuery({
    queryKey: ["equipment", user?.id],
    initialData: initialEquipment,
    queryFn: fetchEquipment,
  });

  const updateInventoryOrder = useMutation({
    mutationFn: async (newSlots: InventorySlot[]) => {
      const slotsToSend = newSlots.map((slot) => ({
        slotIndex: slot.slotIndex,
        item: slot.item ? { id: slot.item.id } : null,
      }));
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user?.id, inventory: slotsToSend }),
      });
      if (!response.ok) {
        throw new Error("Error updating inventory order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["inventory", user?.id]);
    },
  });

  let loading = false;

  const updateEquipmentOrder = useMutation({
    mutationFn: async (newSlots: EquipmentSlots) => {
      const equipmentData = Object.keys(newSlots).reduce(
        (acc, key) => {
          acc[key] = newSlots[key] ? newSlots[key]!.id : null;
          return acc;
        },
        {} as { [key: string]: number | null },
      );
      const response = await fetch("/api/equipment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user?.id, equipment: equipmentData }),
      });
      if (!response.ok) {
        throw new Error("Error updating equipment order");
      }
      return response.json();
    },
    onMutate: () => {
      setMutating(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["equipment", user?.id]);
      setMutating(false);
    },
  });

  const inventory = inventoryQuery.data;
  const equipment = equipmentQuery.data;

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  // Map of indices to equipment keys
  const equipmentIndexMap = {
    100: "head",
    101: "necklace",
    102: "shoulders",
    103: "chest",
    104: "arms",
    105: "gloves",
    106: "legs",
    107: "boots",
    108: "belt",
    109: "ring1",
    110: "ring2",
    111: "amulet",
    112: "backpack",
    113: "weapon",
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !active) return;

    const activeIndex = active.data.current?.index;
    const overIndex = over.data.current?.index;
    const activeContainer = active.data.current?.container;
    const overContainer = over.data.current?.container;

    console.log("Active Index:", activeIndex);
    console.log("Over Index:", overIndex);
    console.log("Active Container:", activeContainer);
    console.log("Over Container:", overContainer);

    if (activeIndex !== undefined && overIndex !== undefined) {
      if (activeContainer === overContainer) {
        if (activeContainer === "inventory") {
          if (!inventory) return; // Check if inventory is defined
          const updatedInventory = [...inventory];
          if (updatedInventory[overIndex]?.item !== null) {
            [
              updatedInventory[activeIndex].item,
              updatedInventory[overIndex].item,
            ] = [
              updatedInventory[overIndex]?.item,
              updatedInventory[activeIndex]?.item,
            ];
          } else {
            updatedInventory[overIndex].item =
              updatedInventory[activeIndex]?.item;
            updatedInventory[activeIndex].item = null;
          }

          queryClient.setQueryData(["inventory", user?.id], updatedInventory);

          updateInventoryOrder.mutate(updatedInventory);
        } else if (activeContainer === "equipment") {
          if (!equipment) return; // Check if equipment is defined
          const equipmentKeyActive = equipmentIndexMap[activeIndex];
          const equipmentKeyOver = equipmentIndexMap[overIndex];
          const updatedEquipment = { ...equipment };

          if (equipmentKeyActive && equipmentKeyOver) {
            if (updatedEquipment[equipmentKeyOver] !== null) {
              [
                updatedEquipment[equipmentKeyActive],
                updatedEquipment[equipmentKeyOver],
              ] = [
                updatedEquipment[equipmentKeyOver],
                updatedEquipment[equipmentKeyActive],
              ];
            } else {
              updatedEquipment[equipmentKeyOver] =
                updatedEquipment[equipmentKeyActive];
              updatedEquipment[equipmentKeyActive] = null;
            }

            queryClient.setQueryData(["equipment", user?.id], updatedEquipment);

            updateEquipmentOrder.mutate(updatedEquipment);
          }
        }
      } else {
        // Inventory ==> Equipment
        if (activeContainer === "inventory" && overContainer === "equipment") {
          if (!inventory || !equipment) return; // Check if inventory and equipment are defined
          const updatedInventory = [...inventory];
          const updatedEquipment = { ...equipment };
          const equipmentKey = equipmentIndexMap[overIndex];

          console.log("Equipment Key:", equipmentKey);

          if (
            equipmentKey !== updatedInventory[activeIndex]?.item?.equipTo &&
            !(equipmentKey === "ring1" || equipmentKey === "ring2")
          ) {
            // alert(`Item not compatible with slot: ${updatedInventory[activeIndex]?.item?.equipTo}`);
            return;
          }

          if (equipmentKey) {
            if (updatedEquipment[equipmentKey] !== null) {
              // Swap items if destination equipment slot is occupied
              [
                updatedInventory[activeIndex].item,
                updatedEquipment[equipmentKey],
              ] = [
                updatedEquipment[equipmentKey],
                updatedInventory[activeIndex].item,
              ];
            } else {
              // Move item to empty slot
              updatedEquipment[equipmentKey] =
                updatedInventory[activeIndex].item;
              updatedInventory[activeIndex].item = null;
            }

            queryClient.setQueryData(["inventory", user?.id], updatedInventory);
            queryClient.setQueryData(["equipment", user?.id], updatedEquipment);

            updateInventoryOrder.mutate(updatedInventory);
            updateEquipmentOrder.mutate(updatedEquipment);

            console.log("Updated Inventory:", updatedInventory);
            console.log("Updated Equipment:", updatedEquipment);
          }
        }
        // Equipment ==> Inventory
        else if (
          activeContainer === "equipment" &&
          overContainer === "inventory"
        ) {
          if (!inventory || !equipment) return; // Check if inventory and equipment are defined
          const updatedInventory = [...inventory];
          const updatedEquipment = { ...equipment };
          const equipmentKey = equipmentIndexMap[activeIndex];

          console.log("Equipment Key:", equipmentKey);

          if (equipmentKey) {
            if (updatedInventory[overIndex].item !== null) {
              // Swap items if destination inventory slot is occupied
              [
                updatedInventory[overIndex].item,
                updatedEquipment[equipmentKey],
              ] = [
                updatedEquipment[equipmentKey],
                updatedInventory[overIndex].item,
              ];
            } else {
              // Move item to empty slot
              updatedInventory[overIndex].item = updatedEquipment[equipmentKey];
              updatedEquipment[equipmentKey] = null;
            }

            queryClient.setQueryData(["inventory", user?.id], updatedInventory);
            queryClient.setQueryData(["equipment", user?.id], updatedEquipment);

            updateInventoryOrder.mutate(updatedInventory);
            updateEquipmentOrder.mutate(updatedEquipment);

            console.log("Updated Inventory:", updatedInventory);
            console.log("Updated Equipment:", updatedEquipment);
          }
        }
      }
    }
  };

  return (
    <DndContext.Provider
      value={{
        inventory: inventory ?? [],
        equipment: equipment ?? {},
        setInventory: updateInventoryOrder.mutate,
        setEquipment: updateEquipmentOrder.mutate,
        mutating: mutating,
      }}
    >
      <DndKitContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        id="unique-id"
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
