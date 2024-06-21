"use client";

import React from "react";
import PlayerIsland from "./PlayerIsland";
import Image from "next/image";

const GameHeader = () => {
  return (
    <header className="border-b border-white/5 border-black">
      <div className=" flex h-[50px] items-center justify-between pr-5">
        <div className="border-white/5 flex h-full w-[50px] items-center justify-center border-r">
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
