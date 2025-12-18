"use client";

import React, { createContext, useContext } from "react";
import type { UseVocationalActiveActionResult } from "./useVocationalActiveAction";
import { useVocationalActiveAction } from "./useVocationalActiveAction";

const VocationalActiveActionContext =
  createContext<UseVocationalActiveActionResult | null>(null);

export function VocationalActiveActionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = useVocationalActiveAction();

  return (
    <VocationalActiveActionContext.Provider value={state}>
      {children}
    </VocationalActiveActionContext.Provider>
  );
}

export function useVocationalActiveActionContext(): UseVocationalActiveActionResult {
  const ctx = useContext(VocationalActiveActionContext);
  if (!ctx) {
    throw new Error(
      "useVocationalActiveActionContext must be used within VocationalActiveActionProvider",
    );
  }
  return ctx;
}
