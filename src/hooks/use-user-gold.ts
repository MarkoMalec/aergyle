"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { userQueryKeys } from "~/lib/query-keys";

export function useUserGold() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: userQueryKeys.gold(session?.user?.id),
    queryFn: async () => {
      const response = await fetch("/api/user/gold");
      if (!response.ok) {
        throw new Error("Failed to fetch user gold");
      }
      const data = await response.json();
      return data.gold as number;
    },
    enabled: !!session?.user?.id,
    staleTime: 1000, // Consider stale after 1 second
    refetchOnWindowFocus: true,
  });
}
