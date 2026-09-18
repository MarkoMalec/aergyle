"use client";

import { Compass } from "lucide-react";
import PlayerIsland from "./PlayerIsland";
import ActiveActionHeaderWidget from "~/components/game/actions/ActiveActionHeaderWidget";
import ActiveEffectHeaderWidget from "~/components/game/actions/ActiveEffectHeaderWidget";

export default function GameHeader() {
  return (
    <header className="game-topbar">
      <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
        <Compass size={16} className="text-primary" aria-hidden="true" />
        Wayfarer’s atlas
      </div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
        <ActiveActionHeaderWidget />
        <ActiveEffectHeaderWidget />
        <PlayerIsland />
      </div>
    </header>
  );
}
