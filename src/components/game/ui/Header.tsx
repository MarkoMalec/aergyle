"use client";

import React from "react";
import PlayerIsland from "./PlayerIsland";

const GameHeader = () => {
  return (
    <header className="border-b border-black">
      <div className="container mx-auto flex h-16 items-center justify-between px-5">
        <h1 className="text-2xl">Aergyle</h1>
        <PlayerIsland />
      </div>
    </header>
  );
};

export default GameHeader;
