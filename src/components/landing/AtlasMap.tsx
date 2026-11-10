"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { WORLD_ATLAS_LOCATION_MARKERS } from "~/game/world/atlasLocations";
import { cn } from "~/lib/utils";
import { prefersReducedMotion, Tilt, useOnScreen } from "./motion";

type Marker = (typeof WORLD_ATLAS_LOCATION_MARKERS)[number];

const START = WORLD_ATLAS_LOCATION_MARKERS[0];
const TOUR_MS = 3400;

function percent(value: `${number}%`) {
  return Number.parseFloat(value);
}

/** A gentle arc from Crownhold to the chosen place, in map percentages. */
function routePath(to: Marker) {
  const [x1, y1] = [percent(START.left), percent(START.top)];
  const [x2, y2] = [percent(to.left), percent(to.top)];
  const bend = 0.18;
  const cx = (x1 + x2) / 2 - (y2 - y1) * bend;
  const cy = (y1 + y2) / 2 + (x2 - x1) * bend;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

function opensAt(marker: Marker) {
  return marker.requiredLevel <= 1
    ? "Open from your first day"
    : `Opens at level ${marker.requiredLevel}`;
}

export function AtlasMap() {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const [selected, setSelected] = useState<Marker>(START);
  const [explored, setExplored] = useState(false);

  // Until the visitor picks a place, the atlas walks the road by itself, in
  // the order the markers open up.
  useEffect(() => {
    if (explored || !onScreen || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      setSelected((current) => {
        const next = WORLD_ATLAS_LOCATION_MARKERS.indexOf(current) + 1;
        return WORLD_ATLAS_LOCATION_MARKERS[
          next % WORLD_ATLAS_LOCATION_MARKERS.length
        ]!;
      });
    }, TOUR_MS);
    return () => window.clearInterval(timer);
  }, [explored, onScreen]);

  const visit = (marker: Marker) => {
    setExplored(true);
    setSelected(marker);
  };

  return (
    <div ref={ref} className="grid gap-5">
      <Tilt max={2}>
        <div className="relative aspect-[3/2] overflow-hidden rounded-[20px] bg-surface-inset shadow-[0_40px_90px_-40px_#02070a,0_0_0_1px_hsl(var(--foreground)/0.04)]">
          <Image
            src="/assets/world/world-map-v1.png"
            alt="The world atlas of Aergyle: snow peaks in the north-west, a volcano over the northern sea, a castle delta at the centre and a burning dark citadel in the east"
            fill
            sizes="(min-width: 1400px) 1300px, 100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(var(--background)/0.55)_100%)]"
          />

          {selected !== START ? (
            <svg
              key={selected.name}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <mask id="atlas-route-mask">
                  <path
                    d={routePath(selected)}
                    pathLength={1}
                    fill="none"
                    stroke="white"
                    strokeWidth={4}
                    className="motion-safe:animate-route-draw [stroke-dasharray:1]"
                  />
                </mask>
              </defs>
              <path
                d={routePath(selected)}
                fill="none"
                stroke="#F3DFAE"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="2 7"
                vectorEffect="non-scaling-stroke"
                mask="url(#atlas-route-mask)"
                className="drop-shadow-[0_1px_2px_#000]"
              />
            </svg>
          ) : null}

          {WORLD_ATLAS_LOCATION_MARKERS.map((marker) => {
            const active = marker.name === selected.name;
            const locked = marker.requiredLevel > 1;
            return (
              <button
                key={marker.name}
                type="button"
                aria-pressed={active}
                onClick={() => visit(marker)}
                onMouseEnter={() => visit(marker)}
                onFocus={() => visit(marker)}
                style={{ left: marker.left, top: marker.top }}
                className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full p-2 focus-visible:outline-none"
              >
                <span className="sr-only">
                  {marker.name}, {opensAt(marker).toLowerCase()}
                </span>
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 m-auto h-4 w-4 rounded-full bg-[#F3DFAE]/70 motion-safe:animate-ping"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative block h-3 w-3 rotate-45 rounded-[3px] shadow-[0_0_0_4px_hsl(var(--background)/0.75),0_4px_10px_#000] transition-[background-color,transform] duration-200 sm:h-3.5 sm:w-3.5",
                    locked ? "bg-foreground/70" : "bg-primary",
                    active && "scale-125 bg-[#F3DFAE]",
                    "group-focus-visible:shadow-[0_0_0_4px_hsl(var(--ring))]",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-1/2 top-full hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-background/95 px-2 py-1 text-xs font-semibold shadow-[0_6px_16px_-6px_#000] transition-colors md:block",
                    active ? "text-primary" : "text-foreground/90",
                  )}
                >
                  {marker.name}
                  {locked ? (
                    <span className="ml-1.5 font-medium text-muted-foreground">
                      Lv {marker.requiredLevel}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}

          {/* Lamplight that follows the mouse across the tilted map. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_var(--gx,50%)_var(--gy,-40%),rgba(255,236,196,0.13),transparent_42%)]"
          />

          <AtlasPlaque
            marker={selected}
            live={explored}
            className="absolute bottom-4 right-4 z-20 hidden w-[min(380px,30%)] lg:block"
          />
        </div>
      </Tilt>
      <AtlasPlaque marker={selected} live={explored} className="lg:hidden" />
    </div>
  );
}

function AtlasPlaque({
  marker,
  live,
  className,
}: {
  marker: Marker;
  /** Announce changes: only once the visitor is the one making them. */
  live: boolean;
  className?: string;
}) {
  return (
    <div
      aria-live={live ? "polite" : "off"}
      className={cn(
        "rounded-2xl bg-background/95 p-5 shadow-[0_18px_50px_#060c10a6]",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        {marker.region} · {marker.terrain}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em]">
        {marker.name}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {marker.description}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {marker.knownFor.join(" · ")}
      </p>
      <p
        className={cn(
          "mt-3 text-sm font-semibold",
          marker.requiredLevel > 1 ? "text-warning" : "text-success",
        )}
      >
        {opensAt(marker)}
      </p>
    </div>
  );
}
