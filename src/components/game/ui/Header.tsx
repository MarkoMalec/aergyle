"use client";

import { Compass } from "lucide-react";
import PlayerIsland from "./PlayerIsland";
import ActiveActionHeaderWidget from "~/components/game/actions/ActiveActionHeaderWidget";
import ActiveEffectHeaderWidget from "~/components/game/actions/ActiveEffectHeaderWidget";

export default function GameHeader() {
  return (
    <header className="game-topbar">
      <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground lg:flex">
        <Compass size={16} className="text-primary" aria-hidden="true" />
        Wayfarer’s atlas
      </div>
      {/* One row at every width: below xl the widgets collapse to icons and
          the activity bar takes the room that is left. */}
      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5 xl:gap-2">
        <ActiveActionHeaderWidget />
        <ActiveEffectHeaderWidget />
        <PlayerIsland />
      </div>
    </header>
  );
}
