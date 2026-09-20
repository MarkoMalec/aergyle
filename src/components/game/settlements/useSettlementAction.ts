"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useUserContext } from "~/context/userContext";
import {
  inventoryQueryKeys,
  questQueryKeys,
  userQueryKeys,
} from "~/lib/query-keys";
import { refreshProgress } from "~/lib/player-sync";

type ActionResult = Record<string, unknown>;

/**
 * Posts a settlement action (buy, sell, quest, contribution), then refreshes
 * gold, inventory, quests, level and the server-rendered page. `pending` names the running
 * action so only its button shows progress.
 */
export function useSettlementAction() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useUserContext();
  const [pending, setPending] = useState<string | null>(null);

  const run = async (
    key: string,
    url: string,
    body: unknown,
    successMessage: (result: ActionResult) => string,
  ) => {
    setPending(key);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => null)) as
        | (ActionResult & { error?: string })
        | null;
      if (!response.ok) throw new Error(json?.error ?? "Something went wrong");
      toast.success(successMessage(json ?? {}));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: userQueryKeys.gold() }),
        queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all() }),
        // Quest progress counts held items, so any trade can change it, and
        // a finished project can reveal new quests.
        queryClient.invalidateQueries({ queryKey: questQueryKeys.all() }),
      ]);
      refreshProgress(queryClient, user?.id);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
      return false;
    } finally {
      setPending(null);
    }
  };

  return { run, pending };
}
