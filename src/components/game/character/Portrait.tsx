"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Check, LoaderCircle, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import { ResponsiveModal } from "~/components/ui/responsive-modal";
import { useUserContext } from "~/context/userContext";
import { cn } from "~/lib/utils";
import {
  DEFAULT_PLAYER_AVATAR,
  getPlayerAvatarBySrc,
  PLAYER_AVATARS,
} from "~/lib/player-avatars";
import { UserLevelBadge } from "./UserLevelBadge";

export default function Portrait({
  name,
  children,
}: {
  name: string;
  children?: ReactNode;
}) {
  const { user, setUser } = useUserContext();
  const initialAvatar =
    getPlayerAvatarBySrc(user?.image) ?? DEFAULT_PLAYER_AVATAR;
  const [avatarId, setAvatarId] = useState(initialAvatar.id);
  const [pendingAvatarId, setPendingAvatarId] = useState(initialAvatar.id);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const avatar =
    PLAYER_AVATARS.find((option) => option.id === avatarId) ??
    DEFAULT_PLAYER_AVATAR;

  const handleOpenChange = (open: boolean) => {
    if (isSaving) return;
    setIsOpen(open);
    if (open) setPendingAvatarId(avatarId);
  };

  const saveAvatar = async () => {
    const selectedAvatar = PLAYER_AVATARS.find(
      (option) => option.id === pendingAvatarId,
    );

    if (!selectedAvatar) return;

    setIsSaving(true);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: selectedAvatar.id }),
      });

      if (!response.ok) {
        throw new Error("The avatar could not be saved.");
      }

      setAvatarId(selectedAvatar.id);
      setUser((currentUser) =>
        currentUser
          ? { ...currentUser, image: selectedAvatar.src }
          : currentUser,
      );
      setIsOpen(false);
      toast.success(`${selectedAvatar.name} is now your avatar.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The avatar could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className="game-panel game-character-hero"
      aria-labelledby="character-name"
    >
      <UserLevelBadge className="absolute left-1 top-1" />
      <div className="game-character-hero-art group/avatar">
        <Image
          alt={`${avatar.name}, ${avatar.role}`}
          src={avatar.src}
          fill
          sizes="160px"
          className="pointer-events-none object-contain object-top"
          priority
        />
        <button
          type="button"
          className="game-character-avatar-edit"
          onClick={() => handleOpenChange(true)}
          aria-label="Change character avatar"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="game-character-hero-identity">
        <div className="game-character-hero-caption">
          <p className="game-eyebrow">{avatar.role}</p>
          <h2 id="character-name">{name}</h2>
          <p>{avatar.tagline}</p>
        </div>
      </div>

      {children ? (
        <div className="game-character-hero-stats">{children}</div>
      ) : null}

      <ResponsiveModal
        open={isOpen}
        onOpenChange={handleOpenChange}
        title="Choose your likeness"
        description="Pick the adventurer who will represent you across Aergyle."
        className="sm:max-w-3xl"
        bodyClassName="max-h-[min(72dvh,760px)] overflow-y-auto"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveAvatar()}
              disabled={isSaving || pendingAvatarId === avatarId}
            >
              {isSaving ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              {isSaving ? "Saving…" : "Use this avatar"}
            </Button>
          </>
        }
      >
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
          role="radiogroup"
          aria-label="Available character avatars"
        >
          {PLAYER_AVATARS.map((option) => {
            const isSelected = pendingAvatarId === option.id;

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-card text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/55 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected
                    ? "border-primary ring-1 ring-primary/60"
                    : "border-border-strong/75",
                )}
                onClick={() => setPendingAvatarId(option.id)}
              >
                <span
                  className="relative block aspect-square overflow-hidden border-b border-border/70"
                  style={{ background: option.backdrop }}
                >
                  <Image
                    src={option.src}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 44vw, 210px"
                    className="object-contain object-bottom p-2 transition-transform duration-300 group-hover:scale-[1.025]"
                  />
                  <span
                    className={cn(
                      "absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full border shadow-sm transition",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/15 bg-black/35 text-transparent backdrop-blur-sm",
                    )}
                    aria-hidden="true"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                </span>
                <span className="block p-3">
                  <span className="block truncate font-display text-sm font-semibold text-foreground">
                    {option.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {option.role}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </ResponsiveModal>
    </section>
  );
}
