"use client";

import React, { createContext, useContext } from "react";

export type SkillProgressResponse = {
  trackKey: string;
  level: number;
  currentXp: number;
  xpForNextLevel: number;
  xpProgress: number;
  xpRemaining: number;
};

export type SkillProgressContextValue = {
  skillProgress: SkillProgressResponse | null;
  progressLoading: boolean;
};

const SkillProgressContext = createContext<SkillProgressContextValue | null>(
  null,
);

export function SkillProgressProvider(props: {
  value: SkillProgressContextValue;
  children: React.ReactNode;
}) {
  return (
    <SkillProgressContext.Provider value={props.value}>
      {props.children}
    </SkillProgressContext.Provider>
  );
}

export function useSkillProgress() {
  return useContext(SkillProgressContext);
}
