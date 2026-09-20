"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

function isInteractiveElement(target: EventTarget | null): boolean {
  // Element, not HTMLElement: an icon's SVG inside a button counts too.
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    "a,button,input,textarea,select,label,[role='button'],[role='link']",
  );
}

export default function DragScrollContainer(props: {
  className?: string;
  children: React.ReactNode;
  initialFocus?: { x: number; y: number } | null;
  /** Where in the view the focus lands, as a fraction of its size. */
  focusAt?: number;
  label?: string;
}) {
  const { className, children, initialFocus, focusAt = 0.78 } = props;
  const ref = useRef<HTMLDivElement | null>(null);
  const hasPositionedRef = useRef(false);

  const startRef = useRef({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const pointerDownRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !initialFocus || hasPositionedRef.current) return;

    const positionMap = () => {
      if (hasPositionedRef.current || el.scrollWidth <= el.clientWidth) return;

      // By default, keep the focus visible while preserving more map context
      // toward the realm's centre, where most routes converge.
      el.scrollLeft = Math.max(
        0,
        el.scrollWidth * initialFocus.x - el.clientWidth * focusAt,
      );
      el.scrollTop = Math.max(
        0,
        el.scrollHeight * initialFocus.y - el.clientHeight * focusAt,
      );
      hasPositionedRef.current = true;
    };

    const frame = window.requestAnimationFrame(positionMap);
    const image = el.querySelector("img");
    image?.addEventListener("load", positionMap, { once: true });

    return () => {
      window.cancelAnimationFrame(frame);
      image?.removeEventListener("load", positionMap);
    };
  }, [initialFocus, focusAt]);

  const endDrag = (pointerId?: number) => {
    pointerDownRef.current = false;
    setDragging(false);

    const el = ref.current;
    if (!el || pointerId == null) return;
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      // no-op
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="region"
      aria-label={`${props.label ?? "World map"}. Use arrow keys to scroll.`}
      className={cn(
        "overflow-auto",
        dragging ? "cursor-grabbing select-none" : "cursor-grab",
        className,
      )}
      data-dragging={dragging}
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        if (e.button !== 0) return; // left click only
        if (isInteractiveElement(e.target)) return;

        const el = ref.current;
        if (!el) return;

        pointerDownRef.current = true;
        setDragging(true);

        startRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: el.scrollLeft,
          scrollTop: el.scrollTop,
        };

        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // no-op
        }
      }}
      onPointerMove={(e) => {
        if (!pointerDownRef.current) return;
        const el = ref.current;
        if (!el) return;

        const dx = e.clientX - startRef.current.x;
        const dy = e.clientY - startRef.current.y;

        el.scrollLeft = startRef.current.scrollLeft - dx;
        el.scrollTop = startRef.current.scrollTop - dy;
      }}
      onPointerUp={(e) => endDrag(e.pointerId)}
      onPointerCancel={(e) => endDrag(e.pointerId)}
      onPointerLeave={() => endDrag()}
      onKeyDown={(event) => {
        if (isInteractiveElement(event.target)) return;
        const el = ref.current;
        if (!el) return;

        const distance = event.shiftKey ? 220 : 72;
        const offsets: Partial<Record<string, [number, number]>> = {
          ArrowLeft: [-distance, 0],
          ArrowRight: [distance, 0],
          ArrowUp: [0, -distance],
          ArrowDown: [0, distance],
        };
        const offset = offsets[event.key];
        if (!offset) return;

        event.preventDefault();
        const reduceMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        el.scrollBy({
          left: offset[0],
          top: offset[1],
          behavior: reduceMotion ? "auto" : "smooth",
        });
      }}
    >
      {children}
    </div>
  );
}
