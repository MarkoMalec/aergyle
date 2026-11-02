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
  imageClassName,
  fallback,
}: {
  /** File name without extension; .webp, .png and .jpg are all picked up. */
  name: string;
  alt?: string;
  sizes: string;
  priority?: boolean;
  /** Positions the slot; it must give the slot a size. */
  className?: string;
  imageClassName?: string;
  /** Shown while the painting is missing. */
  fallback?: React.ReactNode;
}) {
  const src = homepageArt(name);

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
