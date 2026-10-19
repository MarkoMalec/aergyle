"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, LoaderCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import { ResponsiveModal } from "~/components/ui/responsive-modal";
import { useUserContext } from "~/context/userContext";
import { cn } from "~/lib/utils";
import { PLAYER_AVATARS } from "~/lib/player-avatars";

export type PlayerAvatar = (typeof PLAYER_AVATARS)[number];

/** Chooses and saves the character's likeness. */
export function AvatarPicker({
  open,
  onOpenChange,
  current,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: PlayerAvatar;
  onSaved: (avatar: PlayerAvatar) => void;
}) {
  const { setUser } = useUserContext();
  const [pendingId, setPendingId] = useState<string>(current.id);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (isSaving) return;
    if (next) setPendingId(current.id);
    onOpenChange(next);
  };

  const save = async () => {
    const selected = PLAYER_AVATARS.find((option) => option.id === pendingId);
    if (!selected) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: selected.id }),
      });
      if (!response.ok) throw new Error("The avatar could not be saved.");

      setUser((user) => (user ? { ...user, image: selected.src } : user));
      onSaved(selected);
      onOpenChange(false);
      toast.success(`${selected.name} is now your avatar.`);
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
    <ResponsiveModal
      open={open}
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
            onClick={() => void save()}
            disabled={isSaving || pendingId === current.id}
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
          const isSelected = pendingId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={cn(
                "group relative overflow-hidden rounded-xl bg-card text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isSelected && "ring-2 ring-primary",
              )}
              onClick={() => setPendingId(option.id)}
            >
              <span
                className="relative block aspect-square overflow-hidden"
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
                    "absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full shadow-sm transition",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-black/35 text-transparent",
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
  );
}
