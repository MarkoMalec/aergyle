"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserContext } from "~/context/userContext";
import { EquipmentSlotsWithItems } from "~/types/inventory";
import { ItemWithStats } from "~/types/stats";

interface EquipmentContextProps {
  equipment: EquipmentSlotsWithItems;
  isLoading: boolean;
  updateEquipment: (newEquipment: EquipmentSlotsWithItems) => Promise<void>;
}

const EquipmentContext = createContext<EquipmentContextProps | undefined>(
  undefined
);

export const useEquipmentContext = () => {
  const context = useContext(EquipmentContext);
  if (!context) {
    throw new Error(
      "useEquipmentContext must be used within EquipmentProvider"
    );
  }
  return context;
};

interface EquipmentProviderProps {
  children: ReactNode;
  initialEquipment: EquipmentSlotsWithItems;
}

export const EquipmentProvider: React.FC<EquipmentProviderProps> = ({
  children,
  initialEquipment,
}) => {
  const { user } = useUserContext();
  const queryClient = useQueryClient();

  // Query for equipment
  const { data: equipment = initialEquipment, isLoading } = useQuery({
    queryKey: ["equipment", user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/equipment?userId=${user?.id}`);
      if (!response.ok) throw new Error("Failed to fetch equipment");
      return response.json() as Promise<EquipmentSlotsWithItems>;
    },
    initialData: initialEquipment,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Mutation for updating equipment
  const updateEquipmentMutation = useMutation({
    mutationFn: async (newEquipment: EquipmentSlotsWithItems) => {
      // Convert items to IDs for API
      const equipmentIds = Object.entries(newEquipment).reduce(
        (acc, [slot, item]) => {
          acc[slot as keyof EquipmentSlotsWithItems] = item?.id ?? null;
          return acc;
        },
        {} as Record<string, number | null>
      );

      const response = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          equipment: equipmentIds,
        }),
      });

      if (!response.ok) throw new Error("Failed to update equipment");
      return response.json();
    },
    onMutate: async (newEquipment) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["equipment", user?.id] });
      const previousEquipment = queryClient.getQueryData<EquipmentSlotsWithItems>([
        "equipment",
        user?.id,
      ]);
      queryClient.setQueryData(["equipment", user?.id], newEquipment);
      return { previousEquipment };
    },
    onError: (err, newEquipment, context) => {
      // Rollback on error
      if (context?.previousEquipment) {
        queryClient.setQueryData(
          ["equipment", user?.id],
          context.previousEquipment
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", user?.id] });
      // Also invalidate inventory since capacity may have changed
      queryClient.invalidateQueries({ queryKey: ["inventory", user?.id] });
    },
  });

  const updateEquipment = async (newEquipment: EquipmentSlotsWithItems) => {
    await updateEquipmentMutation.mutateAsync(newEquipment);
  };

  return (
    <EquipmentContext.Provider
      value={{
        equipment,
        isLoading,
        updateEquipment,
      }}
    >
      {children}
    </EquipmentContext.Provider>
  );
};
