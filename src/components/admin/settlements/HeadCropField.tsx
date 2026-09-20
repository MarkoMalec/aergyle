"use client";

import Image from "next/image";
import React, { useRef } from "react";
import { AssetPreview } from "~/components/admin/settlements/SettlementForm";
import { NpcHead } from "~/components/game/map/NpcHead";
import {
  clampHeadCrop,
  MIN_HEAD_CROP_SIZE,
  type HeadCrop,
} from "~/game/world/maps";

const WIDTH = 160;

/**
 * The portrait with the circle its settlement-map head is cut from. Drag the
 * circle to move it; the slider zooms in and out.
 */
export function HeadCropField(props: {
  portrait: string | null;
  crop: HeadCrop;
  onChange: (crop: HeadCrop) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; crop: HeadCrop } | null>(null);
  const { crop } = props;
  if (!props.portrait?.startsWith("/")) {
    return <AssetPreview src={null} width={WIDTH} height={WIDTH * 1.5} />;
  }

  /** The portrait's height over its width. */
  const aspect = () => {
    const rect = frameRef.current?.getBoundingClientRect();
    return rect?.width ? rect.height / rect.width : 1.5;
  };
  // Zooming keeps the circle's centre where it is.
  const zoom = (size: number) => {
    const ratio = aspect();
    props.onChange(
      clampHeadCrop(
        {
          size,
          x: crop.x + (crop.size - size) / 2,
          y: crop.y + (crop.size - size) / ratio / 2,
        },
        ratio,
      ),
    );
  };

  return (
    <div className="space-y-3" style={{ width: WIDTH }}>
      <div
        ref={frameRef}
        className="relative touch-none select-none overflow-hidden rounded-lg bg-black/30"
      >
        <Image
          src={props.portrait}
          alt=""
          width={WIDTH}
          height={WIDTH * 1.5}
          draggable={false}
          className="block h-auto w-full"
        />
        <div
          className="absolute aspect-square cursor-move rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.55)] ring-2 ring-amber-300"
          style={{
            left: `${crop.x * 100}%`,
            top: `${crop.y * 100}%`,
            width: `${crop.size * 100}%`,
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, crop };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            const rect = frameRef.current?.getBoundingClientRect();
            if (!start || !rect) return;
            props.onChange(
              clampHeadCrop(
                {
                  size: start.crop.size,
                  x: start.crop.x + (event.clientX - start.x) / rect.width,
                  y: start.crop.y + (event.clientY - start.y) / rect.height,
                },
                rect.height / rect.width,
              ),
            );
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="h-14 w-14 shrink-0">
          <NpcHead portrait={props.portrait} crop={crop} />
        </span>
        <label className="min-w-0 flex-1 space-y-1 text-xs">
          <span className="block font-medium text-white/70">Map head</span>
          {/* Sliding right zooms in, to a smaller square. */}
          <input
            type="range"
            className="w-full accent-amber-400"
            min={MIN_HEAD_CROP_SIZE}
            max={1}
            step={0.01}
            value={1 + MIN_HEAD_CROP_SIZE - crop.size}
            onChange={(event) =>
              zoom(1 + MIN_HEAD_CROP_SIZE - Number(event.target.value))
            }
          />
        </label>
      </div>
    </div>
  );
}
