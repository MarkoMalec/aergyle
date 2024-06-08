import React from "react";
import Image from "next/image";

const Portrait = () => {
  return (
    <Image
      className="shadow-lg rounded"
      alt="portrait"
      src="/assets/character/character-warrior.jpg"
      width={480}
      height={480}
    />
  );
};

export default Portrait;
