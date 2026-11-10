"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";
import { TOWNSFOLK } from "./content";
import { prefersReducedMotion, useOnScreen } from "./motion";

const TURN_MS = 4800;

/**
 * The mentors in a row, taking turns to say their piece. Pointing at one (or
 * tabbing to them) gives them the floor and ends the turn-taking.
 */
export function Townsfolk() {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>();
  const [speaker, setSpeaker] = useState(0);
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    if (chosen || !onScreen || prefersReducedMotion()) return;
    const timer = window.setInterval(
      () => setSpeaker((current) => (current + 1) % TOWNSFOLK.length),
      TURN_MS,
    );
    return () => window.clearInterval(timer);
  }, [chosen, onScreen]);

  const giveFloor = (index: number) => {
    setChosen(true);
    setSpeaker(index);
  };

  return (
    <div ref={ref}>
      {/* Every quote shares one cell, so the tallest sets the height once. */}
      <div className="grid lg:justify-items-end">
        {TOWNSFOLK.map((person, index) => (
          <blockquote
            key={person.name}
            aria-hidden={index !== speaker}
            className={cn(
              "col-start-1 row-start-1 max-w-xl transition-[opacity,transform] duration-500 lg:text-right",
              index === speaker
                ? "opacity-100"
                : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <p className="font-display text-xl italic leading-snug text-foreground/95 text-pretty sm:text-2xl">
              “{person.quote}”
            </p>
            <footer className="mt-3 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">{person.name}</span>
              {" · "}
              {person.trade}
            </footer>
          </blockquote>
        ))}
      </div>
      {/* Speaks the quote of whoever the visitor picked, not the auto turns. */}
      <p aria-live="polite" className="sr-only">
        {chosen ? TOWNSFOLK[speaker]!.quote : ""}
      </p>

      <ul className="relative mt-10 flex items-end justify-center before:absolute before:inset-x-[6%] before:bottom-1 before:h-16 before:rounded-[50%] before:bg-[radial-gradient(ellipse,#000000a0,transparent_70%)] sm:before:bottom-12 lg:justify-end">
        {TOWNSFOLK.map((person, index) => {
          const speaking = index === speaker;
          return (
            <li
              key={person.name}
              className={cn(
                "relative -mx-2 w-[4.5rem] shrink-0 sm:-mx-4 sm:w-32 lg:w-36",
                speaking && "z-10",
              )}
            >
              <button
                type="button"
                aria-pressed={speaking}
                aria-label={`${person.name}, ${person.trade}`}
                onClick={() => giveFloor(index)}
                onMouseEnter={() => giveFloor(index)}
                onFocus={() => giveFloor(index)}
                className="group block w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -top-7 left-1/2 -translate-x-1/2 transition-opacity duration-300",
                    speaking ? "opacity-100" : "opacity-0",
                  )}
                >
                  <span className="block font-display text-3xl font-bold leading-none text-currency drop-shadow-[0_0_8px_hsl(var(--currency)/0.8)] motion-safe:animate-bob">
                    !
                  </span>
                </span>
                <span
                  className={cn(
                    "relative block aspect-[2/3] w-full origin-bottom transition-[filter,transform] duration-500",
                    speaking
                      ? "scale-110 brightness-110"
                      : "brightness-[0.55] saturate-[0.7]",
                  )}
                >
                  <Image
                    src={person.sprite}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 160px, 140px"
                    className="object-contain object-bottom"
                  />
                </span>
                <span
                  className={cn(
                    "mt-3 hidden px-4 text-center text-sm font-semibold leading-tight transition-colors duration-300 sm:block",
                    speaking ? "text-foreground" : "text-foreground/50",
                  )}
                >
                  {person.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
