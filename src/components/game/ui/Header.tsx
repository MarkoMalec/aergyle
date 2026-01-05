"use client";

import React from "react";
import PlayerIsland from "./PlayerIsland";
import ActiveActionHeaderWidget from "~/components/game/actions/ActiveActionHeaderWidget";

const GameHeader = () => {
  return (
    <header className="sticky top-2 z-30 mb-12 w-full">
      <div className=" flex h-[50px] items-center justify-between">
        <div className="flex flex-1 items-center justify-end gap-4">
          <ActiveActionHeaderWidget />
          <PlayerIsland />
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
