"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserContext } from "~/context/userContext";
import { EquipmentSlotsWithItems } from "~/types/inventory";
import { equipmentQueryKeys } from "~/lib/query-keys";

interface EquipmentContextProps {
  equipment: EquipmentSlotsWithItems;
  isLoading: boolean;
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

  // Query for equipment
  const { data: equipment = initialEquipment, isLoading } = useQuery({
    queryKey: equipmentQueryKeys.byUser(user?.id),
    queryFn: async () => {
      const response = await fetch(`/api/equipment?userId=${user?.id}`);
      if (!response.ok) throw new Error("Failed to fetch equipment");
      return response.json() as Promise<EquipmentSlotsWithItems>;
    },
    initialData: initialEquipment,
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: false, // Don't refetch if data is fresh
    refetchOnWindowFocus: false, // Prevent refetch on tab switch
  });

  return (
    <EquipmentContext.Provider
      value={{
        equipment,
        isLoading,
      }}
    >
      {children}
    </EquipmentContext.Provider>
  );
};
