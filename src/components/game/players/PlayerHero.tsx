"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Backpack, MapPin, MessageSquare, Pencil } from "lucide-react";
import { Button } from "~/components/ui/button";
import { formatRemaining } from "~/components/game/actions/format";
import { messagePlayer } from "~/components/game/communication/messagePlayer";
import { FriendButton } from "~/components/game/friends/FriendButton";
import {
  AvatarPicker,
  type PlayerAvatar,
} from "~/components/game/character/AvatarPicker";
import {
  HeroShell,
  StatusChips as OwnStatusChips,
  heroChipClass,
} from "~/components/game/character/CharacterHero";
import { useLevelContext } from "~/context/levelContext";
import { timeAgo } from "~/game/communication";
import type { FriendRelation } from "~/game/friends";
import { isOnline } from "~/game/players";
import {
  DEFAULT_PLAYER_AVATAR,
  getPlayerAvatarBySrc,
} from "~/lib/player-avatars";
import { cn } from "~/lib/utils";
import type { PlayerProfile } from "~/server/players";

/** Seconds left until `endsAt`, counted down while the page is open. */
function useSecondsLeft(endsAt: string | null) {
  const left = () =>
    endsAt
      ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000))
      : 0;
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    setSeconds(left());
    const timer = window.setInterval(() => setSeconds(left()), 1000);
    return () => window.clearInterval(timer);
    // `left` only reads `endsAt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);

  return seconds;
}

function Presence({ lastOnline }: { lastOnline: string }) {
  // Decided after mount: the server's clock and the browser's can disagree.
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => setOnline(isOnline(lastOnline)), [lastOnline]);

  if (online === null) return <p className="h-4" />;
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          online
            ? "bg-success shadow-[0_0_0_3px_hsl(var(--success)/0.18)]"
            : "bg-muted-foreground/50",
        )}
      />
      <span className={cn("truncate", online && "text-success")}>
        {online ? "Online" : `Last seen ${timeAgo(lastOnline).toLowerCase()}`}
      </span>
    </p>
  );
}

function StatusChips({
  activity,
  location,
}: Pick<PlayerProfile, "activity" | "location">) {
  const secondsLeft = useSecondsLeft(activity?.endsAt ?? null);
  const finished = secondsLeft === 0;
  // These labels already say what is happening ("Hunting in …").
  const selfDescribing = activity?.kind !== "vocation";

  return (
    <div className="flex flex-wrap gap-2">
      {activity && !finished ? (
        <span className={cn(heroChipClass, "pl-1.5")} title={activity.label}>
          {activity.sprite ? (
            <Image
              src={activity.sprite}
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] shrink-0 object-contain"
            />
          ) : (
            <span
              className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            />
          )}
          {selfDescribing ? null : (
            <span className="shrink-0 text-muted-foreground">
              {activity.skillLabel}
            </span>
          )}
          <span className="truncate font-medium text-foreground">
            {activity.label}
          </span>
          {secondsLeft ? (
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatRemaining(secondsLeft)}
            </span>
          ) : null}
        </span>
      ) : (
        <span className={cn(heroChipClass, "text-muted-foreground")}>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60"
            aria-hidden="true"
          />
          Idle
        </span>
      )}
      {location ? (
        <span className={heroChipClass}>
          <MapPin
            className="h-3.5 w-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="truncate font-medium text-foreground">
            {location}
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** The character hero as other players see it: nothing to change, one to message. */
/**
 * The character hero on a profile. Everyone sees the same thing; the owner can
 * also change the avatar, and their activity chip and level stay live.
 */
export function PlayerHero({
  profile,
  isOwner,
  friendRelation,
}: {
  profile: PlayerProfile;
  isOwner: boolean;
  /** Where the viewer stands with this player. */
  friendRelation: FriendRelation;
}) {
  const [avatar, setAvatar] = useState<PlayerAvatar>(
    () => getPlayerAvatarBySrc(profile.image) ?? DEFAULT_PLAYER_AVATAR,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const { levelData } = useLevelContext();

  return (
    <HeroShell
      avatar={avatar}
      name={profile.name}
      subtitle={<Presence lastOnline={profile.lastOnline} />}
      levelData={isOwner ? levelData ?? profile.level : profile.level}
      initialHealth={profile.currentHealth}
      status={
        isOwner ? (
          <OwnStatusChips location={profile.location} />
        ) : (
          <StatusChips
            activity={profile.activity}
            location={profile.location}
          />
        )
      }
      actions={
        isOwner ? (
          <Button asChild variant="soft" size="sm">
            <Link href="/inventory">
              <Backpack className="h-3.5 w-3.5" aria-hidden="true" />
              Inventory
            </Link>
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() =>
                messagePlayer({
                  id: profile.id,
                  name: profile.name,
                  image: profile.image,
                })
              }
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Message
            </Button>
            <FriendButton
              player={{ id: profile.id, name: profile.name }}
              initialRelation={friendRelation}
            />
          </>
        )
      }
      artAction={
        isOwner ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="absolute bottom-3 left-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-background/75 px-2.5 text-xs font-medium text-foreground/85 shadow-[var(--shadow-panel)] transition-colors duration-150 hover:bg-background hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Change character avatar"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Avatar</span>
          </button>
        ) : null
      }
    >
      {isOwner ? (
        <AvatarPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          current={avatar}
          onSaved={setAvatar}
        />
      ) : null}
    </HeroShell>
  );
}
