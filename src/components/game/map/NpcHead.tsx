import Image from "next/image";
import { UserRound } from "lucide-react";
import type { HeadCrop } from "~/game/world/maps";

/**
 * An NPC's head: the crop of its portrait, filling its round parent. `px` is
 * the largest size it is shown at, so a small image is downloaded.
 */
export function NpcHead(props: {
  portrait: string | null;
  crop: HeadCrop;
  px?: number;
}) {
  const { crop } = props;
  return (
    <span className="npc-head">
      {props.portrait?.startsWith("/") ? (
        <Image
          src={props.portrait}
          alt=""
          // A 2:3 portrait until the real one loads.
          width={512}
          height={768}
          sizes={`${Math.ceil((props.px ?? 56) / crop.size)}px`}
          // Scaled so the crop's side is the head's, then shifted so the
          // crop's corner is the head's.
          style={{
            width: `${100 / crop.size}%`,
            transform: `translate(${-crop.x * 100}%, ${-crop.y * 100}%)`,
          }}
        />
      ) : (
        <UserRound aria-hidden="true" />
      )}
    </span>
  );
}
