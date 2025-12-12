"use client";

import React from "react";
import PlayerIsland from "./PlayerIsland";
import Image from "next/image";

const GameHeader = () => {
  return (
    <header className="border-b border-black border-white/5 bg-background">
      <div className=" flex h-[50px] items-center justify-between pr-5">
        <div className="flex h-full w-[50px] items-center justify-center border-r border-white/5">
          <Image
            alt="logo"
            src="/assets/logo/aergyle-logo.png"
            width={36}
            height={36}
            className="grayscale-[1] invert-[1]"
          />
        </div>
        <PlayerIsland />
      </div>
    </header>
  );
};

export default GameHeader;
