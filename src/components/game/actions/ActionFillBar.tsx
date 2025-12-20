import React from "react";
import { cn } from "~/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";

export function ActionFillBar({
  value,
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
}: {
  value: number;
  lagMs?: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  tickClassName?: string;
  title: string;
  sessionAmount: number;
  href?: string;
  sprite?: string;
  variant?: "fancy" | "simple";
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const [lagged, setLagged] = React.useState(clamped);

  React.useEffect(() => {
    const ms = Math.max(0, Math.floor(lagMs));
    if (ms === 0) {
      setLagged(clamped);
      return;
    }

    const t = window.setTimeout(() => setLagged(clamped), ms);
    return () => window.clearTimeout(t);
  }, [clamped, lagMs]);

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
              "h-2 rounded-full transition-all ease-in",
              fillClassName ?? "bg-[#20c05c]",
            )}
            style={{
              width: `${Math.floor(lagged * 100)}%`,
            }}
          />

          <div
            className={cn("absolute left-0 top-0 h-full rounded-full bg-green-700/20", tickClassName)}
            style={{
              width: `${Math.floor(clamped * 100)}%`,
            }}
          />
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper {...wrapperProps}>
      <span className="absolute -right-2 -top-2 z-30 rounded-full bg-gray-700/80 px-2 py-0.5 font-mono text-[10px] text-white/80">
        {sessionAmount}
      </span>
      <div
        className={cn(
          "relative overflow-hidden rounded-full bg-white/10",
          className,
          trackClassName,
        )}
      >
        <div className="pointer-events-none relative z-30 flex select-none items-center gap-2 pl-2 pr-3 py-1.5 text-sm font-bold text-white/80">
          {sprite ? (
            <Image
              src={sprite}
              alt=""
              width={920}
              height={920}
              className="h-6 w-6"
            />
          ) : null}
          <span className="inline-block mb-[2px]">{title}</span>
          <div className="ml-2 h-4 w-4 animate-spin rounded-full border-[3px] border-gray-300 border-b-gray-700/60 border-l-gray-700/60 border-t-gray-700/50" />
        </div>
        <div className="absolute left-0 top-0 h-full w-full">
          <div
            className={cn(
              "h-full rounded-full transition-all ease-in",
              fillClassName ?? "bg-[#20c05c]",
            )}
            style={{
              width: `${Math.floor(lagged * 100)}%`,
            }}
          />

          <div
            className="absolute left-0 top-0 h-full rounded-full bg-green-700/20 transition-all ease-in"
            style={{
              width: `${Math.floor(clamped * 100)}%`,
            }}
          />
        </div>
      </div>
    </Wrapper>
  );
}
