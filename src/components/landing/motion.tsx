"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export type RevealState = "idle" | "pending" | "shown";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * "idle" on the server and for anything already on screen at load, so nothing
 * is ever hidden without JavaScript; "pending" for things below the fold until
 * they scroll into view, then "shown" for good.
 */
export function useReveal<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<RevealState>("idle");

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;

    setState("pending");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, state] as const;
}

const REVEAL_EFFECTS = {
  // Rises into place.
  rise: "transition-[opacity,transform] duration-700 data-[reveal=pending]:translate-y-6 data-[reveal=pending]:opacity-0",
  // Painted in from the left, like a strip of the atlas being inked.
  wipe: "transition-[clip-path] duration-[1100ms] [clip-path:inset(0_0_0_0)] data-[reveal=pending]:[clip-path:inset(0_100%_0_0)]",
  // A route line drawn once from its start.
  draw: "origin-left transition-transform duration-700 data-[reveal=pending]:scale-x-0",
};

/** Plays its effect once, the first time it scrolls into view. */
export function Reveal({
  as: Tag = "div",
  effect = "rise",
  delay = 0,
  className,
  children,
}: {
  as?: "div" | "li" | "p" | "h2" | "h3" | "figure" | "span";
  effect?: keyof typeof REVEAL_EFFECTS;
  delay?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const [ref, state] = useReveal<HTMLElement>(0.15);
  const motion = {
    "data-reveal": state,
    style: { transitionDelay: state === "shown" ? `${delay}ms` : undefined },
  };
  const effectClass = cn(
    "ease-[cubic-bezier(0.2,0.7,0.2,1)]",
    REVEAL_EFFECTS[effect],
  );

  // Chrome's IntersectionObserver honours clip-path, so a fully wiped-out
  // element would never be seen: wipe an inner layer and watch the outer.
  if (effect === "wipe") {
    return React.createElement(
      Tag,
      { ref, className },
      <div {...motion} className={cn("relative h-full w-full", effectClass)}>
        {children}
      </div>,
    );
  }

  return React.createElement(
    Tag,
    { ref, ...motion, className: cn(effectClass, className) },
    children,
  );
}

/** Drifts against the scroll, `speed` px per px scrolled, while on screen. */
export function Parallax({
  speed,
  className,
  children,
}: {
  speed: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = Math.min(window.scrollY, window.innerHeight * 1.2);
      node.style.transform = `translate3d(0, ${offset * speed}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [speed]);

  return (
    <div ref={ref} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
