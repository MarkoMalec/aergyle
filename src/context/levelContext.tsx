"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useUserContext } from "./userContext";

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

export const LevelProvider = ({ children, initialLevelData }: LevelProviderProps) => {
  const { user } = useUserContext();
  const [levelData, setLevelData] = useState<LevelData | null>(initialLevelData || null);
  const [isLoading, setIsLoading] = useState(!initialLevelData);

  // Fetch level data
  const fetchLevelData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/leveling/progress?userId=${user.id}`);
      const data = await response.json();
      setLevelData(data);
    } catch (error) {
      console.error("Error fetching level data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!initialLevelData && user?.id) {
      fetchLevelData();
    }
  }, [user?.id]);

  // Refresh level data (call after awarding XP)
  const refreshLevel = async () => {
    await fetchLevelData();
  };

  // For showing level up animations before backend sync
  const simulateLevelUp = (newLevel: number, newXp: number) => {
    if (!levelData) return;
    
    setLevelData({
      ...levelData,
      level: newLevel,
      currentXp: newXp,
      xpProgress: (newXp / levelData.xpForNextLevel) * 100,
    });
  };

  return (
    <LevelContext.Provider
      value={{
        levelData,
        isLoading,
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
