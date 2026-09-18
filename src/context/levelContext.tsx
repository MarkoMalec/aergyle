"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  refreshLevel: () => Promise<void>;
  simulateLevelUp: (newLevel: number, newXp: number) => void; // For animations
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
  const queryClient = useQueryClient();
  const levelKey = userQueryKeys.level(user?.id);

  // Invalidated whenever XP is awarded (e.g. activity ticks), so the badge stays live.
  const levelQuery = useQuery({
    queryKey: levelKey,
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

  // Refresh level data (call after awarding XP)
  const refreshLevel = async () => {
    await levelQuery.refetch();
  };

  // For showing level up animations before backend sync
  const simulateLevelUp = (newLevel: number, newXp: number) => {
    queryClient.setQueryData<LevelData>(levelKey, (levelData) =>
      levelData
        ? {
            ...levelData,
            level: newLevel,
            currentXp: newXp,
            xpProgress:
              levelData.xpForNextLevel > 0
                ? (newXp / levelData.xpForNextLevel) * 100
                : 100,
          }
        : levelData,
    );
  };

  return (
    <LevelContext.Provider
      value={{
        levelData: levelQuery.data ?? null,
        isLoading: levelQuery.isLoading,
        refreshLevel,
        simulateLevelUp,
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
