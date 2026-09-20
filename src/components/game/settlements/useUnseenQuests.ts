"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLevelContext } from "~/context/levelContext";
import { questQueryKeys } from "~/lib/query-keys";
import type { UnseenQuest } from "~/server/settlements";

/**
 * One-time quests where the player stands that they have not seen yet; they
 * light up the new-quest dots. The travel status refreshes them when a
 * journey ends, and settlement actions when they change quests.
 */
export function useUnseenQuests() {
  const pathname = usePathname();
  const level = useLevelContext().levelData?.level;
  const query = useQuery({
    queryKey: questQueryKeys.unseen(),
    queryFn: async () => {
      const response = await fetch("/api/settlements/quests/unseen", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not check for new quests");
      return ((await response.json()) as { quests: UnseenQuest[] }).quests;
    },
    staleTime: 30_000,
  });

  const { refetch } = query;
  // Recheck on every page change and level-up: either can bring quests into
  // view. Joins a check already under way rather than starting another.
  useEffect(() => {
    void refetch({ cancelRefetch: false });
  }, [pathname, level, refetch]);

  return query;
}

/** Marks an NPC's unseen quests as seen while its quest list is on screen. */
export function useMarkQuestsSeen(npcId: number) {
  const queryClient = useQueryClient();
  const { data } = useUnseenQuests();
  const questIds = useMemo(
    () =>
      data
        ?.filter((quest) => quest.npcId === npcId)
        .map((quest) => quest.questId) ?? [],
    [data, npcId],
  );

  useEffect(() => {
    if (questIds.length === 0) return;
    const queryKey = questQueryKeys.unseen();
    // Clear the dots at once; a check already under way would bring them back.
    void queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<UnseenQuest[]>(queryKey, (quests) =>
      quests?.filter((quest) => !questIds.includes(quest.questId)),
    );
    void fetch("/api/settlements/quests/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questIds }),
    }).then((response) => {
      // After a failure the dots return with the next check.
      if (response.ok) void queryClient.invalidateQueries({ queryKey });
    });
  }, [questIds, queryClient]);
}
