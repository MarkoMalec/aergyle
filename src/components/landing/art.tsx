import "server-only";

import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import type React from "react";
import { cn } from "~/lib/utils";

// Homepage paintings live in public/assets/homepage. A slot whose file is not
// there yet keeps its place with a painted-in-CSS backdrop, and in development
// names the file it is waiting for (briefs: art/homepage-v1/PROMPTS.md).
const ART_DIR = "/assets/homepage";
const EXTENSIONS = [".webp", ".png", ".jpg"];

export function homepageArt(name: string): string | null {
  for (const extension of EXTENSIONS) {
    const file = `${name}${extension}`;
    if (fs.existsSync(path.join(process.cwd(), "public", ART_DIR, file))) {
      return `${ART_DIR}/${file}`;
    }
  }
  return null;
}

export function ArtSlot({
  name,
  alt = "",
  sizes,
  priority,
  className,
  focus,
  boxClassName,
  imageClassName,
  fallback,
  children,
}: {
  /** File name without extension; .webp, .png and .jpg are all picked up. */
  name: string;
  alt?: string;
  sizes: string;
  priority?: boolean;
  /** Positions the slot; it must give the slot a size. */
  className?: string;
  /**
   * For the 3:2 scene paintings: the point, in percent, that stays in view
   * when the slot crops the painting. Gives `children` a box that is exactly
   * the painting, so lights placed on it stay on the fire at every size.
   */
  focus?: readonly [number, number];
  boxClassName?: string;
  imageClassName?: string;
  /** Shown while the painting is missing. */
  fallback?: React.ReactNode;
  /** Lights and other layers painted over the picture (needs `focus`). */
  children?: React.ReactNode;
}) {
  const src = homepageArt(name);

  if (src && focus) {
    // object-fit: cover, done by hand so the children share the crop.
    return (
      <div className={cn("overflow-hidden [container-type:size]", className)}>
        <div
          className={cn(
            "absolute aspect-[3/2] w-[max(100cqw,150cqh)] [container-type:inline-size]",
            boxClassName,
          )}
          style={{
            left: `calc((100cqw - max(100cqw, 150cqh)) * ${focus[0] / 100})`,
            top: `calc((100cqh - max(100cqh, 66.667cqw)) * ${focus[1] / 100})`,
          }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            className={cn("object-cover", imageClassName)}
          />
          {children}
        </div>
      </div>
    );
  }

  if (src) {
    return (
      <div className={cn("overflow-hidden", className)}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn("object-cover", imageClassName)}
        />
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden", className)} aria-hidden="true">
      {fallback}
      {process.env.NODE_ENV === "development" ? (
        <span className="absolute inset-2 z-[5] flex items-center justify-center rounded-lg outline-dashed outline-1 outline-primary/40">
          <span className="rounded-md bg-background/90 px-2.5 py-1.5 font-mono text-xs text-primary">
            art: {name}
          </span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * A light source in a painting: a fire, a lantern, the sun. Placed and sized
 * in percent of the painting, as a child of an ArtSlot with `focus`.
 */
export function Glow({
  x,
  y,
  size,
  color,
  motion = "flicker",
  delay = 0,
  className,
}: {
  x: number;
  y: number;
  /** Diameter, in percent of the painting's width. */
  size: number;
  color: string;
  motion?: "flicker" | "breathe" | "twinkle";
  delay?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute aspect-square -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
      style={{ left: `${x}%`, top: `${y}%`, width: `${size}%` }}
    >
      <span
        className={cn(
          "block h-full w-full rounded-full",
          motion === "flicker" && "motion-safe:animate-flicker",
          motion === "breathe" && "motion-safe:animate-breathe",
          motion === "twinkle" && "motion-safe:animate-twinkle",
          className,
        )}
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
          animationDelay: `${delay}s`,
        }}
      />
    </span>
  );
}
