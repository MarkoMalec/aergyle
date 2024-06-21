import React from "react";
import Image from "next/image";

const Portrait = () => {
  return (
    <Image
      className="shadow-lg rounded"
      alt="portrait"
      src="/assets/character/character-warrior.jpg"
      width={400}
      height={400}
    />
  );
};

export default Portrait;
