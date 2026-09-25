"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUserContext } from "./userContext";
import { userQueryKeys } from "~/lib/query-keys";

interface LevelData {
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  xpProgress: number;
  xpRemaining: number;
}

interface LevelContextType {
  levelData: LevelData | null;
  isLoading: boolean;
}

const LevelContext = createContext<LevelContextType | undefined>(undefined);

interface LevelProviderProps {
  children: ReactNode;
  initialLevelData?: LevelData;
}

export const LevelProvider = ({
  children,
  initialLevelData,
}: LevelProviderProps) => {
  const { user } = useUserContext();

  // Invalidated whenever XP is awarded (e.g. activity ticks), so the badge stays live.
  const levelQuery = useQuery({
    queryKey: userQueryKeys.level(user?.id),
    queryFn: async (): Promise<LevelData> => {
      const response = await fetch("/api/leveling/progress", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Error fetching level data");
      return (await response.json()) as LevelData;
    },
    enabled: Boolean(user?.id),
    initialData: initialLevelData,
    staleTime: Infinity,
  });

  return (
    <LevelContext.Provider
      value={{
        levelData: levelQuery.data ?? null,
        isLoading: levelQuery.isLoading,
      }}
    >
      {children}
    </LevelContext.Provider>
  );
};

export const useLevelContext = () => {
  const context = useContext(LevelContext);
  if (!context) {
    throw new Error("useLevelContext must be used within LevelProvider");
  }
  return context;
};
