import React from "react";
import Image from "next/image";
import { UserLevelBadge } from "./UserLevelBadge";

const Portrait = () => {
  return (
    <div className="relative">
      <Image
        className="rounded-lg shadow-lg"
        alt="portrait"
        src="/assets/character/character-warrior.jpg"
        width={550}
        height={500}
      />
      <div className="absolute left-2 top-2">
        <UserLevelBadge />
      </div>
    </div>
  );
};

export default Portrait;
