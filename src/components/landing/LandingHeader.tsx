"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { DayDial } from "./DayDial";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className="fixed inset-x-0 top-0 z-[var(--z-header)] transition-[background-color,box-shadow] duration-300 data-[scrolled=true]:bg-background data-[scrolled=true]:shadow-[0_10px_30px_-18px_#060c10]"
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          href="/"
          aria-label="Aergyle home"
          className="inline-flex items-center gap-3 rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/assets/logo/aergyle-logo.png"
            alt=""
            width={40}
            height={32}
            className="brightness-0 invert-[0.88] sepia-[0.25]"
          />
          <span className="font-display text-xl font-bold leading-none tracking-[-0.04em]">
            Aergyle
          </span>
        </Link>
        <DayDial className="hidden text-foreground/80 min-[430px]:flex" />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Account">
          <Button asChild variant="ghost" className="text-foreground/85">
            <Link href="/play?mode=signin">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/play?mode=register">Play now</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
