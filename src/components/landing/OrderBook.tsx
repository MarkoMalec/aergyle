"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { rarityStyle } from "~/utils/rarity-colors";
import { prefersReducedMotion, Reveal, useOnScreen } from "./motion";

type Row = { price: number; quantity: number; fills: number };

const row = (price: number, quantity: number): Row => ({
  price,
  quantity,
  fills: 0,
});

const OPENING = {
  asks: [row(84, 120), row(86, 58), row(91, 300)],
  bids: [row(79, 400), row(77, 1200), row(72, 75)],
};

const SIDES = [
  ["Selling", "asks", "text-danger"],
  ["Buying", "bids", "text-success"],
] as const;

const TRADE_MS = 1700;

/** The game's order book for one ore, with a quay's worth of trades going by. */
export function OrderBook() {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const [book, setBook] = useState(OPENING);

  // Illustrative trades: one order grows or shrinks by up to a fifth.
  useEffect(() => {
    if (!onScreen || prefersReducedMotion()) return;
    const timer = window.setInterval(() => {
      const side = Math.random() < 0.5 ? "asks" : "bids";
      const index = Math.floor(Math.random() * 3);
      const swing = Math.random() * 0.4 - 0.2;
      setBook((current) => ({
        ...current,
        [side]: current[side].map((order, position) =>
          position === index
            ? {
                ...order,
                quantity: Math.max(
                  5,
                  order.quantity + Math.round(order.quantity * swing),
                ),
                fills: order.fills + 1,
              }
            : order,
        ),
      }));
    }, TRADE_MS);
    return () => window.clearInterval(timer);
  }, [onScreen]);

  return (
    <div
      ref={ref}
      className="w-full max-w-[420px] rounded-2xl bg-popover p-5 shadow-[0_30px_80px_-20px_#03080b]"
    >
      <div className="flex items-center gap-4">
        <div
          className="rarity-frame relative h-14 w-14 shrink-0 rounded-xl p-1"
          data-rarity="COMMON"
          style={rarityStyle("COMMON")}
        >
          <Image
            src="/assets/items/resources/ores/sunstone-ore-atlas-v1.png"
            alt=""
            width={56}
            height={56}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-[-0.02em]">
            Sunstone Ore
          </p>
          <p className="text-xs text-muted-foreground">Order book</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm tabular-nums">
        {SIDES.map(([label, side, tone]) => (
          <div key={label} className="rounded-xl bg-surface-inset/70 p-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <ul className="mt-2 grid gap-0.5">
              {book[side].map((order) => (
                <li
                  // A new key replays the flash each time the order changes.
                  key={`${order.price}-${order.fills}`}
                  className={cn(
                    "-mx-1.5 flex justify-between gap-2 rounded-md px-1.5 py-0.5",
                    order.fills > 0 && "motion-safe:animate-row-flash",
                  )}
                >
                  <span className={cn("font-semibold", tone)}>
                    {order.price} g
                  </span>
                  <span className="text-text-secondary">
                    ×{order.quantity.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Reveal effect="wipe" className="mt-4 h-10">
        <svg
          viewBox="0 0 200 40"
          preserveAspectRatio="none"
          className="h-full w-full"
          role="img"
          aria-label="Price trend rising over the week"
        >
          <path
            d="M0 30 L20 27 L40 31 L60 24 L80 26 L100 19 L120 22 L140 15 L160 17 L180 10 L200 12"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Reveal>
    </div>
  );
}
