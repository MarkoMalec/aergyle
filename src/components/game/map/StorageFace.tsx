import Image from "next/image";
import { PLACE_ICONS } from "./placeIcons";

/**
 * The chest on a storage pin: the artwork every storage shares, or the
 * fallback icon until one is set in admin.
 */
export function StorageFace({
  icon,
  px = 34,
}: {
  icon: string | null;
  px?: number;
}) {
  if (!icon?.startsWith("/")) return <PLACE_ICONS.storage aria-hidden="true" />;
  return (
    <Image
      src={icon}
      alt=""
      width={px * 2}
      height={px * 2}
      sizes={`${px}px`}
      className="h-[72%] w-[72%] object-contain"
    />
  );
}
