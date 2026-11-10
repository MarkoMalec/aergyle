"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

// The page is one day. Sections carry `data-hour` (and `data-daypart`); the
// dial reads the hour off whichever one is passing the middle of the screen.
const SUNRISE = 5;
const SUNSET = 21;
const ARC = { cx: 24, cy: 22, r: 20 };

/** Where the sun (or, after sunset, the moon) sits on its arc at `hour`. */
function place(hour: number) {
  const night = hour >= SUNSET || hour < SUNRISE;
  const across = night
    ? ((hour - SUNSET + 24) % 24) / (24 - SUNSET + SUNRISE)
    : (hour - SUNRISE) / (SUNSET - SUNRISE);
  const angle = Math.PI * (1 - across);
  return {
    night,
    cx: ARC.cx + ARC.r * Math.cos(angle),
    cy: ARC.cy - ARC.r * Math.sin(angle),
  };
}

function clockText(hour: number) {
  const minutes = Math.floor(hour * 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

const FIRST_HOUR = 5.75;

export function DayDial({ className }: { className?: string }) {
  const body = useRef<SVGCircleElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const [sky, setSky] = useState({ part: "Dawn", night: false });

  useEffect(() => {
    const stops = Array.from(
      document.querySelectorAll<HTMLElement>("[data-hour]"),
    );
    if (stops.length === 0) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const anchor = window.scrollY + window.innerHeight * 0.45;
      // Each section's top and hour, closed by midnight at the foot of the page.
      const marks = stops.map(
        (stop) =>
          [
            stop.getBoundingClientRect().top + window.scrollY,
            Number(stop.dataset.hour),
          ] as const,
      );
      marks.push([document.documentElement.scrollHeight, 24]);
      let index = 0;
      while (index < stops.length - 1 && marks[index + 1]![0] <= anchor) {
        index++;
      }
      const [top, hour] = marks[index]!;
      const [nextTop, nextHour] = marks[index + 1]!;
      const through = Math.min(1, Math.max(0, (anchor - top) / (nextTop - top)));
      const now = hour + (nextHour - hour) * through;

      const { night, cx, cy } = place(now);
      body.current?.setAttribute("cx", cx.toFixed(2));
      body.current?.setAttribute("cy", cy.toFixed(2));
      if (clock.current) clock.current.textContent = clockText(now);
      const part = stops[index]!.dataset.daypart ?? "";
      setSky((current) =>
        current.part === part && current.night === night
          ? current
          : { part, night },
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const start = place(FIRST_HOUR);

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none items-center gap-2.5", className)}
    >
      <svg viewBox="0 0 48 27" className="h-[26px] w-[46px] overflow-visible">
        <path
          d="M4 22 A20 20 0 0 1 44 22"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeDasharray="1.5 3.2"
          strokeLinecap="round"
        />
        <path d="M0 22 H48" stroke="currentColor" strokeOpacity="0.3" />
        <circle
          ref={body}
          cx={start.cx.toFixed(2)}
          cy={start.cy.toFixed(2)}
          r="3.6"
          className={cn(
            "transition-[fill] duration-700",
            sky.night
              ? "fill-[#d5dfee] drop-shadow-[0_0_4px_#a9c0e6]"
              : "fill-primary drop-shadow-[0_0_5px_hsl(var(--primary))]",
          )}
        />
      </svg>
      <span className="hidden min-w-[5.5rem] text-xs leading-tight md:block">
        <span
          ref={clock}
          className="block font-semibold tabular-nums text-foreground"
        >
          {clockText(FIRST_HOUR)}
        </span>
        <span className="block text-muted-foreground">{sky.part}</span>
      </span>
    </div>
  );
}
