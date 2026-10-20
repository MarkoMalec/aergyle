"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { communicationFetch } from "~/components/game/communication/useCommunication";
import type { EndableFriendRelation, FriendRelation } from "~/game/friends";
import { communicationQueryKeys, friendQueryKeys } from "~/lib/query-keys";
import type { FriendSearchResult, FriendsOverview } from "~/server/players";

/** Friends and open requests; read while the Friends window is open. */
export function useFriendsList(enabled: boolean) {
  return useQuery({
    queryKey: friendQueryKeys.list(),
    queryFn: () => communicationFetch<FriendsOverview>("/api/friends"),
    enabled,
    // Keeps the online dots honest while the window stays open.
    refetchInterval: enabled ? 60_000 : false,
    staleTime: 15_000,
  });
}

/**
 * Players by name tag. Runs only for a submitted term (the Search button),
 * never while typing; the same term is answered from cache for a while.
 */
export function useFriendSearch(term: string | null) {
  return useQuery({
    queryKey: friendQueryKeys.search(term ?? ""),
    queryFn: () =>
      communicationFetch<{ players: FriendSearchResult[] }>(
        `/api/friends/search?q=${encodeURIComponent(term ?? "")}`,
      ),
    enabled: term !== null,
    staleTime: 60_000,
  });
}

type Target = { id: string; name: string };

/**
 * Fired after every friend action with `{ playerId, relation }`, so a
 * profile's button follows changes made in the Friends window.
 */
export const FRIEND_RELATION_EVENT = "aergyle:friend-relation";

export type FriendAction =
  /** Asks, or accepts their request. */
  | { kind: "add"; player: Target }
  /** Unfriends, cancels, or declines, depending on what the player saw. */
  | { kind: "end"; player: Target; expect: EndableFriendRelation };

function doneMessage(action: FriendAction, relation: FriendRelation) {
  const name = action.player.name;
  if (action.kind === "add") {
    return relation === "friends"
      ? `You and ${name} are now friends`
      : `Friend request sent to ${name}`;
  }
  if (action.expect === "friends") return `${name} is no longer your friend`;
  if (action.expect === "outgoing") return `Request to ${name} cancelled`;
  return `Request from ${name} declined`;
}

/**
 * One friend action. Every place that shows a relation (the window, its
 * search results, a profile) picks up the new state; on a refusal they
 * re-read, since the other player may have changed it meanwhile.
 */
export function useFriendAction(
  onDone?: (relation: FriendRelation, action: FriendAction) => void,
) {
  const queryClient = useQueryClient();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: friendQueryKeys.list() });
    void queryClient.invalidateQueries({
      queryKey: communicationQueryKeys.summary(),
    });
  };

  return useMutation({
    mutationFn: (action: FriendAction) => {
      const id = encodeURIComponent(action.player.id);
      return action.kind === "add"
        ? communicationFetch<{ relation: FriendRelation }>(
            `/api/friends/${id}`,
            { method: "POST" },
          )
        : communicationFetch<{ relation: FriendRelation }>(
            `/api/friends/${id}?expect=${action.expect}`,
            { method: "DELETE" },
          );
    },
    onSuccess: ({ relation }, action) => {
      toast.success(doneMessage(action, relation));
      // The row leaves the window at once; the re-read below fills in a new
      // friend's details.
      const other = (row: { player: { id: string } }) =>
        row.player.id !== action.player.id;
      queryClient.setQueryData<FriendsOverview>(
        friendQueryKeys.list(),
        (data) =>
          data && {
            ...data,
            friends:
              relation === "none"
                ? data.friends.filter((friend) => friend.id !== action.player.id)
                : data.friends,
            incoming: data.incoming.filter(other),
            outgoing:
              relation === "outgoing" ? data.outgoing : data.outgoing.filter(other),
          },
      );
      // Search results show the new state without searching again.
      queryClient.setQueriesData<{ players: FriendSearchResult[] }>(
        { queryKey: [...friendQueryKeys.all(), "search"] },
        (data) =>
          data && {
            players: data.players.map((player) =>
              player.id === action.player.id ? { ...player, relation } : player,
            ),
          },
      );
      refresh();
      window.dispatchEvent(
        new CustomEvent(FRIEND_RELATION_EVENT, {
          detail: { playerId: action.player.id, relation },
        }),
      );
      onDone?.(relation, action);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      refresh();
      void queryClient.invalidateQueries({
        queryKey: [...friendQueryKeys.all(), "search"],
      });
    },
  });
}
