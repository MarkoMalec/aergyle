"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Clock, UserCheck, UserMinus, UserPlus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { FriendRelation } from "~/game/friends";
import { FRIEND_RELATION_EVENT, useFriendAction } from "./useFriends";

const menuClass =
  "rounded-[12px] border-0 p-1 [box-shadow:var(--shadow-overlay)]";
const menuItemClass = "rounded-[8px] text-[13px]";

/**
 * Add friend / Accept / Friends on a player's profile. Starts from the
 * relation the page was rendered with and follows every change, including
 * ones made in the Friends window while the page is open.
 */
export function FriendButton({
  player,
  initialRelation,
}: {
  player: { id: string; name: string };
  initialRelation: FriendRelation;
}) {
  const router = useRouter();
  const [relation, setRelation] = useState(initialRelation);
  const [confirming, setConfirming] = useState(false);
  const action = useFriendAction();
  // A refusal usually means the other player changed it; the page re-reads.
  const onError = () => router.refresh();

  useEffect(() => setRelation(initialRelation), [initialRelation]);
  useEffect(() => {
    const follow = (event: Event) => {
      const detail = (
        event as CustomEvent<{ playerId: string; relation: FriendRelation }>
      ).detail;
      if (detail.playerId === player.id) {
        setRelation(detail.relation);
        setConfirming(false);
      }
    };
    window.addEventListener(FRIEND_RELATION_EVENT, follow);
    return () => window.removeEventListener(FRIEND_RELATION_EVENT, follow);
  }, [player.id]);

  if (relation === "self") return null;

  if (confirming) {
    return (
      <>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={action.isPending}
          onClick={() =>
            action.mutate(
              { kind: "end", player, expect: "friends" },
              { onError },
            )
          }
        >
          <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
          Remove friend
        </Button>
      </>
    );
  }

  if (relation === "incoming") {
    return (
      <>
        <Button
          size="sm"
          variant="soft"
          disabled={action.isPending}
          onClick={() => action.mutate({ kind: "add", player }, { onError })}
        >
          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Accept friend
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={action.isPending}
          onClick={() =>
            action.mutate(
              { kind: "end", player, expect: "incoming" },
              { onError },
            )
          }
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Decline
        </Button>
      </>
    );
  }

  if (relation === "none") {
    return (
      <Button
        size="sm"
        variant="soft"
        disabled={action.isPending}
        onClick={() => action.mutate({ kind: "add", player }, { onError })}
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
        Add friend
      </Button>
    );
  }

  // Friends, or a request on its way: a menu holds the way back.
  const isFriend = relation === "friends";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="secondary" disabled={action.isPending}>
          {isFriend ? (
            <UserCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          ) : (
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isFriend ? "Friends" : "Request sent"}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={menuClass}>
        {isFriend ? (
          <DropdownMenuItem
            className={menuItemClass}
            onSelect={() => setConfirming(true)}
          >
            <UserMinus aria-hidden="true" />
            Remove friend
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className={menuItemClass}
            onSelect={() =>
              action.mutate(
                { kind: "end", player, expect: "outgoing" },
                { onError },
              )
            }
          >
            <X aria-hidden="true" />
            Cancel request
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
