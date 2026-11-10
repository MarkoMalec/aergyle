"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { WAYFARER_NAME_KEY } from "~/lib/wayfarer-name";

/**
 * Asks for a name and writes it onto the blank page of the atlas painting,
 * then carries it over to registration. Without JavaScript it is a plain link
 * to registration: the field has no `name`, so nothing lands in the URL.
 */
export function FirstPageForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const written = name.trim();

  // The ink is painted inside the scene art, outside this component.
  useEffect(() => {
    const ink = document.querySelector<HTMLElement>("[data-atlas-ink]");
    const line = ink?.querySelector("[data-atlas-name]");
    if (!ink || !line) return;
    // An emptied field keeps the last name on the page while the ink fades out.
    if (written) line.textContent = written;
    ink.dataset.written = String(written.length > 0);
  }, [written]);

  const begin = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (written) sessionStorage.setItem(WAYFARER_NAME_KEY, written);
      else sessionStorage.removeItem(WAYFARER_NAME_KEY);
    } catch {
      // Storage is off; registration just starts with an empty name.
    }
    router.push("/play?mode=register");
  };

  return (
    <form
      action="/play"
      method="get"
      onSubmit={begin}
      className="flex flex-wrap items-center gap-3"
    >
      <input type="hidden" name="mode" value="register" />
      <label htmlFor="wayfarer-name" className="sr-only">
        Name your wayfarer
      </label>
      <Input
        id="wayfarer-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        // PLAYER_NAME_MAX; registration validates the name properly.
        maxLength={20}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        placeholder="Name your wayfarer"
        className="h-9 w-full border-transparent bg-foreground/10 shadow-none backdrop-blur-sm placeholder:text-foreground/50 focus-visible:ring-primary/70 sm:w-60"
      />
      <Button type="submit" className="px-6">
        Write your first page <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
