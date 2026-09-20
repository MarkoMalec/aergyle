"use client";

import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { PLAYER_AVATARS } from "~/lib/player-avatars";

const LABEL = "Seeing who else is here — work in progress";

/**
 * Placeholder for the other characters working the same skill nearby. The
 * faces and the count are sample data until presence is wired up.
 */
export function NearbyPlayers() {
  const faces = PLAYER_AVATARS.slice(0, 5);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger className="flex w-full items-center justify-center">
          <span className="flex items-center -space-x-2.5 opacity-70">
            {faces.map((avatar) => (
              <span
                key={avatar.id}
                className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-background"
                style={{ background: avatar.backdrop }}
              >
                <Image
                  src={avatar.src}
                  alt=""
                  width={72}
                  height={72}
                  className="h-full w-full object-cover object-top"
                />
              </span>
            ))}
            {/* A real overflow count replaces this once presence is wired up. */}
            <span className="grid h-9 min-w-9 place-items-center rounded-full bg-secondary/60 px-2 text-[11px] font-semibold text-text-secondary ring-2 ring-background">
              Soon
            </span>
          </span>
          <span className="sr-only">{LABEL}</span>
        </TooltipTrigger>
        <TooltipContent>{LABEL}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
