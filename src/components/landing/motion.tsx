"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export type RevealState = "idle" | "pending" | "shown";

export function prefersReducedMotion() {
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

/** True while any part of the element is in the viewport. */
export function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) =>
      setOnScreen(entries.some((entry) => entry.isIntersecting)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, onScreen] as const;
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

// Everything that follows the scroll shares one listener and one frame.
const tracked = new Set<HTMLElement>();
let scrollFrame = 0;

function publishProgress() {
  scrollFrame = 0;
  const viewport = window.innerHeight;
  const updates: [HTMLElement, number][] = [];
  tracked.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.bottom < -viewport || rect.top > viewport * 2) return;
    const travelled = (viewport - rect.top) / (viewport + rect.height);
    updates.push([node, Math.min(1, Math.max(0, travelled))]);
  });
  updates.forEach(([node, p]) => node.style.setProperty("--p", p.toFixed(4)));
}

function scheduleProgress() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(publishProgress);
}

/**
 * Publishes how far the element has travelled up the viewport as `--p`: 0 as
 * it enters at the bottom, 1 as it leaves at the top. Children read it with
 * `var(--p, 0.5)`, so they sit at rest without JavaScript or with reduced
 * motion.
 */
export function ScrollVar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    if (tracked.size === 0) {
      window.addEventListener("scroll", scheduleProgress, { passive: true });
      window.addEventListener("resize", scheduleProgress);
    }
    tracked.add(node);
    scheduleProgress();
    return () => {
      tracked.delete(node);
      if (tracked.size === 0) {
        window.removeEventListener("scroll", scheduleProgress);
        window.removeEventListener("resize", scheduleProgress);
      }
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function hasMouse() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Publishes the pointer's place over the element as `--mx` and `--my`, each
 * from -1 to 1 and eased, so layers inside can lean against each other.
 */
export function PointerDrift({
  className,
  children,
  ...rest
}: React.ComponentProps<"section">) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion() || !hasMouse()) return;
    let frame = 0;
    const at = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const step = () => {
      at.x += (target.x - at.x) * 0.06;
      at.y += (target.y - at.y) * 0.06;
      node.style.setProperty("--mx", at.x.toFixed(4));
      node.style.setProperty("--my", at.y.toFixed(4));
      const settled =
        Math.abs(target.x - at.x) + Math.abs(target.y - at.y) < 0.002;
      frame = settled ? 0 : requestAnimationFrame(step);
    };
    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      target.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(step);
    };
    node.addEventListener("pointermove", onMove);
    return () => {
      node.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={ref} className={className} {...rest}>
      {children}
    </section>
  );
}

/**
 * Leans towards the mouse by up to `max` degrees. Children can light a glare
 * at `var(--gx) var(--gy)`.
 */
export function Tilt({
  max = 8,
  className,
  children,
}: {
  max?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const lean = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node || event.pointerType !== "mouse" || prefersReducedMotion()) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    node.style.setProperty("--rx", `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
    node.style.setProperty("--ry", `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
    node.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    node.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
  };
  const rest = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      className={cn("[perspective:1100px]", className)}
      onPointerMove={lean}
      onPointerLeave={rest}
    >
      <div
        ref={ref}
        className="h-full w-full transition-transform duration-200 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))]"
      >
        {children}
      </div>
    </div>
  );
}
