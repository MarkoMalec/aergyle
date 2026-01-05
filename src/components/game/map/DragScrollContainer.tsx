"use client";

import React, { useRef, useState } from "react";
import { cn } from "~/lib/utils";

function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    "a,button,input,textarea,select,label,[role='button'],[role='link']",
  );
}

export default function DragScrollContainer(props: {
  className?: string;
  children: React.ReactNode;
}) {
  const { className, children } = props;
  const ref = useRef<HTMLDivElement | null>(null);

  const startRef = useRef({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const pointerDownRef = useRef(false);
  const [dragging, setDragging] = useState(false);

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
      className={cn(
        "overflow-auto",
        dragging ? "cursor-grabbing select-none" : "cursor-grab",
        className,
      )}
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
    >
      {children}
    </div>
  );
}
