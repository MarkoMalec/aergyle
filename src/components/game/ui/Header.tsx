"use client";

import React from "react";
import PlayerIsland from "./PlayerIsland";
import ActiveActionHeaderWidget from "~/components/game/actions/ActiveActionHeaderWidget";

const GameHeader = () => {
  return (
    <header className="sticky mb-12 top-2 w-full z-30">
      <div className=" flex h-[50px] items-center justify-between pr-5">
        <div className="flex flex-1 items-center justify-end gap-6">
          <ActiveActionHeaderWidget />
          <PlayerIsland />
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
