"use client";

import { useEffect, useRef } from "react";

// Grinder sparks thrown off the bright head of a filling bench line. Self-contained
// (Web Animations on plain SVG circles): to revert, delete this file and its one use in EnchantPanel.

const SVG_NS = "http://www.w3.org/2000/svg";
/** ViewBox units of line per spark. */
const SPACING = 2.5;
/** Pull on a spark, in viewBox units per second squared. */
const GRAVITY = 260;
/** Air drag on a spark's launch speed, per second. */
const DRAG = 2.2;
/** Keyframes per spark: enough for a smooth arc. */
const STEPS = 14;

/** Sparks along `d`, each thrown as the head passes, over [delay, delay + duration] ms. */
export function GrindSparks({ d, delay, duration }: { d: string; delay: number; duration: number }) {
  const measure = useRef<SVGPathElement>(null);
  const layer = useRef<SVGGElement>(null);

  useEffect(() => {
    const path = measure.current;
    const g = layer.current;
    if (!path || !g) return;
    const length = path.getTotalLength();
    const count = Math.max(3, Math.round(length / SPACING));
    const start = performance.now();
    const animations: Animation[] = [];

    for (let i = 0; i < count; i++) {
      const f = Math.min(1, (i + Math.random()) / count);
      const p = path.getPointAtLength(f * length);
      const q = path.getPointAtLength(Math.max(0, f * length - 1));
      // Thrown back from the head, fanned out; some are embers that stay on the line.
      const ember = Math.random() < 0.25;
      const angle = Math.atan2(q.y - p.y, q.x - p.x) + (Math.random() - 0.5) * 1.8;
      // Launch velocity in units per second, with a kick upward as a grinder throws them.
      const speed = ember ? Math.random() * 4 : 40 + Math.random() * 90;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - (ember ? 0 : 20 + Math.random() * 50);
      const gravity = ember ? 0 : GRAVITY * (0.8 + Math.random() * 0.4);
      const life = ember ? 700 + Math.random() * 600 : 550 + Math.random() * 650;

      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", p.x.toFixed(1));
      c.setAttribute("cy", p.y.toFixed(1));
      c.setAttribute("r", (ember ? 1.1 : 0.7 + Math.random() * 1.1).toFixed(2));
      c.setAttribute("fill", Math.random() < 0.55 ? "white" : "currentColor");
      c.setAttribute("stroke", "none");
      c.style.opacity = "0";
      c.style.transformBox = "fill-box";
      c.style.transformOrigin = "center";
      g.append(c);

      const frames = Array.from({ length: STEPS + 1 }, (_, k) => {
        const t = k / STEPS;
        const s = (t * life) / 1000;
        // Drag eases the launch speed off; gravity keeps pulling, so they arc and drop.
        const carried = (1 - Math.exp(-DRAG * s)) / DRAG;
        const x = vx * carried;
        const y = vy * carried + 0.5 * gravity * s * s;
        const opacity = ember ? (k % 2 ? 0.35 : 1) * (1 - t) : 1 - t ** 3;
        return { transform: `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${1.3 - 0.8 * t})`, opacity };
      });
      animations.push(
        c.animate(frames, {
          delay: Math.max(0, delay + f * duration - (performance.now() - start)),
          duration: life,
          fill: "forwards",
        }),
      );
    }

    return () => {
      animations.forEach((a) => a.cancel());
      g.replaceChildren();
    };
  }, [d, delay, duration]);

  return (
    <>
      <path ref={measure} d={d} stroke="none" visibility="hidden" />
      <g ref={layer} />
    </>
  );
}
