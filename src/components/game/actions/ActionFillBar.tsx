import React from "react";
import { cn } from "~/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { formatDuration } from "./format";

export function ActionFillBar({
  value,
  previewValue,
  lagMs = 500,
  className,
  trackClassName,
  fillClassName,
  tickClassName,
  title,
  sessionAmount,
  href,
  sprite,
  variant,
  remainingTravelTime,
}: {
  value: number;
  previewValue?: number;
  lagMs?: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  tickClassName?: string;
  title: string;
  sessionAmount: number;
  remainingTravelTime?: number | null;
  href?: string;
  sprite?: string;
  variant?: "fancy" | "simple";
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const previewClamped = Math.max(0, Math.min(1, previewValue ?? value));
  const [laggedPreview, setLaggedPreview] = React.useState(previewClamped);

  function toPercent(input: number) {
    const v = Math.max(0, Math.min(1, input));
    // Avoid getting visually stuck at 99% due to float precision/rounding.
    if (v >= 0.999) return 100;
    return Math.floor(v * 100);
  }

  React.useEffect(() => {
    const ms = Math.max(0, Math.floor(lagMs));
    if (ms === 0) {
      setLaggedPreview(previewClamped);
      return;
    }

    const t = window.setTimeout(() => setLaggedPreview(previewClamped), ms);
    return () => window.clearTimeout(t);
  }, [previewClamped, lagMs]);

  const Wrapper: React.ElementType = href ? Link : "div";
  const wrapperProps = href
    ? ({ href, className: "relative block" } as const)
    : ({ className: "relative" } as const);

  if (variant === "simple") {
    return (
      <Wrapper {...wrapperProps}>
        <div
          className={cn(
            "relative overflow-hidden rounded-full bg-white/10",
            className,
            trackClassName,
          )}
        >
          <div
            className={cn(
              "h-2 rounded-full transition-[width]",
              fillClassName ?? "bg-yellow-400",
            )}
            style={{
              width: `${toPercent(clamped)}%`,
            }}
          />

          <div
            className={cn(
              "absolute left-0 top-0 h-full rounded-full bg-yellow-500/20 transition-[width]",
              tickClassName,
            )}
            style={{
              width: `${toPercent(laggedPreview)}%`,
            }}
          />
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper {...wrapperProps}>
      <span className="absolute -right-2 -top-3 z-30 rounded-full bg-gray-600/80 px-2 py-0.5 text-[10px] font-black text-white/80">
        {remainingTravelTime
          ? formatDuration(remainingTravelTime)
          : sessionAmount}
      </span>
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-white/10",
          className,
          trackClassName,
        )}
      >
        <div className="pointer-events-none relative z-30 flex select-none items-center gap-2 py-1.5 pl-2 pr-3 text-sm font-bold text-white/80">
          {sprite ? (
            <Image
              src={sprite}
              alt=""
              width={920}
              height={920}
              className="h-6 w-6"
            />
          ) : null}
          <span className="mb-[2px] inline-block">{title}</span>
          <div className="ml-2 h-4 w-4 animate-spin rounded-full border-[3px] border-gray-300 border-b-gray-700/60 border-l-gray-700/60 border-t-gray-700/50" />
        </div>
        <div className="absolute left-0 top-0 h-full w-full">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              fillClassName ?? "bg-[#20c05c]",
            )}
            style={{
              width: `${toPercent(clamped)}%`,
            }}
          />

          <div
            className="absolute left-0 top-0 h-full rounded-full bg-green-700/20 transition-[width]"
            style={{
              width: `${toPercent(laggedPreview)}%`,
            }}
          />
        </div>
      </div>
    </Wrapper>
  );
}
