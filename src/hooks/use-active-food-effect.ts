"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ItemRarity, StatType } from "~/generated/prisma/enums";
import { foodEffectQueryKeys } from "~/lib/query-keys";
import { useUserContext } from "~/context/userContext";

export type ActiveFoodEffect = {
  id: number;
  startedAt: string;
  endsAt: string;
  item: {
    id: number;
    name: string;
    sprite: string;
    rarity: ItemRarity;
    foodEffectStats: Array<{ statType: StatType; value: number }>;
  };
};

export function useActiveFoodEffect() {
  const { user } = useUserContext();
  const [now, setNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: foodEffectQueryKeys.active(user?.id),
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<{ effect: ActiveFoodEffect | null }> => {
      const response = await fetch("/api/food-effect", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load active timed effect");
      return (await response.json()) as { effect: ActiveFoodEffect | null };
    },
    staleTime: 30_000,
    refetchOnMount: true,
  });

  useEffect(() => {
    const endsAt = query.data?.effect?.endsAt;
    if (!endsAt) return;

    const endsAtMs = new Date(endsAt).getTime();
    setNow(Date.now());
    const timer = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= endsAtMs) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [query.data?.effect?.endsAt]);

  const remainingSeconds = useMemo(() => {
    const endsAt = query.data?.effect?.endsAt;
    if (!endsAt) return 0;
    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
  }, [now, query.data?.effect?.endsAt]);

  return {
    ...query,
    effect: remainingSeconds > 0 ? query.data?.effect ?? null : null,
    remainingSeconds,
  };
}
