"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { cn } from "~/lib/utils";
import { useOnScreen } from "./motion";

// Only where there is a mouse to carry the torch, room to swing it, and no
// request for stillness. Everyone else sees the scene fully lit.
const CAN_CARRY =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * Puts its children in the dark and hands the visitor a torch: a pool of
 * light follows the pointer, and wanders on its own until the pointer comes.
 * Children with a z-index above 10 stay out of the dark.
 */
export function Torchlight({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const pool = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(CAN_CARRY);
    const sync = () => setLit(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const node = ref.current;
    const light = pool.current;
    if (!lit || !onScreen || !node || !light) return;

    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    const at = { x: 0.62, y: 0.5 };

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      pointer = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    };
    const onLeave = () => {
      pointer = null;
    };
    const step = (now: number) => {
      const seconds = now / 1000;
      const target = pointer ?? {
        x: 0.56 + 0.3 * Math.sin(seconds * 0.29),
        y: 0.56 + 0.24 * Math.sin(seconds * 0.43 + 1),
      };
      const ease = pointer ? 0.2 : 0.03;
      at.x += (target.x - at.x) * ease;
      at.y += (target.y - at.y) * ease;
      const flame =
        1.04 + 0.03 * Math.sin(seconds * 11) + 0.02 * Math.sin(seconds * 17.3);
      // The pool is twice the scene, so half its own size is the whole scene.
      light.style.transform = `translate3d(${((at.x - 0.5) * 50).toFixed(3)}%, ${((at.y - 0.5) * 50).toFixed(3)}%, 0) scale(${flame.toFixed(4)})`;
      frame = requestAnimationFrame(step);
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(step);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
    };
  }, [lit, onScreen, ref]);

  return (
    <div ref={ref} className={className}>
      {children}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-0 transition-opacity duration-1000",
          lit && "opacity-100",
        )}
      >
        <div
          ref={pool}
          className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] bg-[radial-gradient(circle_at_center,rgba(255,170,90,0.12)_0,transparent_260px),radial-gradient(circle_at_center,transparent_0,transparent_120px,hsl(var(--background)/0.7)_460px)] will-change-transform"
        />
      </div>
    </div>
  );
}
