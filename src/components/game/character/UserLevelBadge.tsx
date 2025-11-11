"use client";

import { useLevelContext } from "~/context/levelContext";

export const UserLevelBadge = () => {
  const { levelData, isLoading } = useLevelContext();

  if (isLoading || !levelData) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-400">
        <span className="text-2xl font-bold text-white">?</span>
      </div>
    );
  }

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (levelData.xpProgress / 100) * circumference;

  return (
    <div className="relative h-12 w-12">
      {/* SVG Circular Progress */}
      <svg
        className="absolute inset-0 h-full w-full -rotate-90 transform"
        viewBox="0 0 48 48"
      >
        {/* Background circle */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="4"
        />
        {/* Progress circle */}
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: "stroke-dashoffset 0.5s ease",
          }}
        />
      </svg>
      
      {/* Level number in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-400">
          <span className="text-xl font-bold text-white">
            {levelData.level}
          </span>
        </div>
      </div>
    </div>
  );
};
