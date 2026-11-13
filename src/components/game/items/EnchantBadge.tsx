import { enchantBadge } from "~/game/enchanting";

/** Enchant level over an item's top-left corner (the rarity mark is top-right, the quantity bottom-right). */
export function EnchantBadge({ level }: { level?: number }) {
  const text = enchantBadge(level ?? 0);
  if (!text) return null;
  return (
    // <span className="pointer-events-none absolute left-0.5 top-0.5 rounded bg-background/95 px-1 text-[11px] font-semibold leading-4 tabular-nums text-primary shadow-sm">
    <span className="[text-shadow:0_0_5px_rgb(255_0_0_/_0.95)] pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[18px] font-normal tabular-nums leading-4 text-primary">
      {text}
    </span>
  );
}
