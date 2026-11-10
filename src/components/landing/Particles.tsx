"use client";

import { useEffect, useRef } from "react";
import { cn } from "~/lib/utils";

type Range = readonly [number, number];

type Preset = {
  /** Particles per 100 000 px² of canvas, capped at `max`. */
  density: number;
  max: number;
  rgb: string;
  /** Radius of the soft dot, px. */
  size: Range;
  /** Drift, px per second. */
  vx: Range;
  vy: Range;
  alpha: Range;
  /** How fast each one pulses, radians per second. */
  pulse: number;
  /** Sideways wander, px. */
  sway: number;
  /** Fades out towards the top, like sparks cooling. */
  cools?: boolean;
};

const PRESETS = {
  // Dust and pollen catching the low sun.
  motes: {
    density: 5,
    max: 70,
    rgb: "250, 220, 160",
    size: [1.2, 3.2],
    vx: [3, 12],
    vy: [-9, -2],
    alpha: [0.12, 0.55],
    pulse: 0.7,
    sway: 10,
  },
  // Sparks off the forge.
  embers: {
    density: 5,
    max: 60,
    rgb: "245, 150, 70",
    size: [1.4, 3.4],
    vx: [-5, 9],
    vy: [-52, -20],
    alpha: [0.35, 0.95],
    pulse: 3.2,
    sway: 16,
    cools: true,
  },
  fireflies: {
    density: 3.5,
    max: 34,
    rgb: "214, 238, 130",
    size: [1.6, 3.2],
    vx: [-7, 7],
    vy: [-5, 5],
    alpha: [0, 0.9],
    pulse: 1.3,
    sway: 26,
  },
} satisfies Record<string, Preset>;

function between([low, high]: Range) {
  return low + Math.random() * (high - low);
}

/**
 * A handful of drifting lights on a canvas that fills its parent. Runs only
 * while it is on screen, and not at all with reduced motion.
 */
export function Particles({
  preset,
  className,
}: {
  preset: keyof typeof PRESETS;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const config: Preset = PRESETS[preset];
    const ratio = Math.min(window.devicePixelRatio, 2);
    let width = 0;
    let height = 0;
    let particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      phase: number;
    }[] = [];

    // One soft dot, drawn once and stamped for every particle.
    const dot = document.createElement("canvas");
    dot.width = dot.height = 64;
    const dotContext = dot.getContext("2d")!;
    const gradient = dotContext.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${config.rgb}, 1)`);
    gradient.addColorStop(0.25, `rgba(${config.rgb}, 0.55)`);
    gradient.addColorStop(1, `rgba(${config.rgb}, 0)`);
    dotContext.fillStyle = gradient;
    dotContext.fillRect(0, 0, 64, 64);

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      // A 0×0 canvas is an error state in Firefox; wait for a real size.
      if (!width || !height) return;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(
        config.max,
        Math.round(((width * height) / 100_000) * config.density),
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: between(config.vx),
        vy: between(config.vy),
        size: between(config.size),
        alpha: between(config.alpha),
        phase: Math.random() * Math.PI * 2,
      }));
    };

    let frame = 0;
    let last = 0;
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const seconds = now / 1000;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.y < -8) particle.y = height + 8;
        if (particle.y > height + 8) particle.y = -8;
        if (particle.x < -8) particle.x = width + 8;
        if (particle.x > width + 8) particle.x = -8;
        const pulse =
          0.5 + 0.5 * Math.sin(particle.phase + seconds * config.pulse);
        const cooling = config.cools ? (particle.y / height) ** 1.4 : 1;
        context.globalAlpha = particle.alpha * pulse * cooling;
        const x =
          particle.x +
          Math.sin(particle.phase + seconds * 0.6) * config.sway;
        const r = particle.size * 3;
        context.drawImage(dot, x - r, particle.y - r, r * 2, r * 2);
      }
      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    resize();
    const sizes = new ResizeObserver(resize);
    sizes.observe(canvas);
    const visibility = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) start();
      else stop();
    });
    visibility.observe(canvas);

    return () => {
      stop();
      sizes.disconnect();
      visibility.disconnect();
    };
  }, [preset]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      // Sized by CSS, not by its pixel buffer: otherwise each resize at 2× DPR
      // doubles the element and the canvas grows until the browser gives up.
      className={cn("pointer-events-none block h-full w-full", className)}
    />
  );
}
