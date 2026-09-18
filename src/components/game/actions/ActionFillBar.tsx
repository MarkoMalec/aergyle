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
    ? ({
        href,
        "aria-label": `${title}, ${toPercent(clamped)} percent${remainingTravelTime != null ? `, ${formatDuration(remainingTravelTime)} remaining` : `, ${sessionAmount} collected`}`,
        className: "relative block min-w-0 max-w-full",
      } as const)
    : ({ className: "relative min-w-0 max-w-full" } as const);

  if (variant === "simple") {
    return (
      <Wrapper {...wrapperProps}>
        <div
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={toPercent(clamped)}
          className={cn(
            "relative overflow-hidden rounded-lg bg-surface-inset",
            className,
            trackClassName,
          )}
        >
          <div
            className={cn(
              "h-2 rounded-lg transition-[width]",
              fillClassName ?? "bg-xp",
            )}
            style={{
              width: `${toPercent(clamped)}%`,
            }}
          />

          <div
            className={cn(
              "absolute left-0 top-0 h-full rounded-lg bg-xp/20 transition-[width]",
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
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={toPercent(clamped)}
        className={cn(
          "relative overflow-hidden rounded-lg bg-surface-inset",
          className,
          trackClassName,
        )}
      >
        <div className="pointer-events-none relative z-30 flex min-w-0 select-none items-center gap-2 py-2 pl-2 pr-3 text-xs font-medium text-text-secondary">
          {sprite ? (
            <Image
              src={sprite}
              alt=""
              width={920}
              height={920}
              className="h-6 w-6"
            />
          ) : null}
          <span className="max-w-32 truncate">{title}</span>
          <span className="shrink-0 text-xs tabular-nums text-xp">
            {toPercent(clamped)}%
          </span>
          <span className="shrink-0 border-l border-border pl-2 text-xs tabular-nums text-muted-foreground">
            {remainingTravelTime != null
              ? formatDuration(remainingTravelTime)
              : `+${sessionAmount}`}
          </span>
        </div>
        <div className="absolute left-0 top-0 h-full w-full">
          <div
            className={cn(
              "h-full rounded-lg transition-[width]",
              fillClassName ?? "bg-xp/25",
            )}
            style={{
              width: `${toPercent(clamped)}%`,
            }}
          />

          <div
            className="absolute left-0 top-0 h-full rounded-lg bg-xp/15 transition-[width]"
            style={{
              width: `${toPercent(laggedPreview)}%`,
            }}
          />
        </div>
      </div>
    </Wrapper>
  );
}
