import React from "react";
import Image from "next/image";
import { UserLevelBadge } from "./UserLevelBadge";

const Portrait = () => {
  return (
    <div className="relative">
      <Image
        className="rounded shadow-lg"
        alt="portrait"
        src="/assets/character/character-warrior.jpg"
        width={400}
        height={400}
      />
      <div className="absolute left-2 top-2">
        <UserLevelBadge />
      </div>
    </div>
  );
};

export default Portrait;
