"use client";

import { useCallback, useEffect, useState } from "react";

export type PinnedPage = { href: string; label: string };

export const MAX_PINNED_PAGES = 5;

const STORAGE_KEY = "aergyle:pinned-pages";

function read(): PinnedPage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is PinnedPage =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as PinnedPage).href === "string" &&
          typeof (entry as PinnedPage).label === "string",
      )
      .slice(0, MAX_PINNED_PAGES);
  } catch {
    return [];
  }
}

/**
 * The player's shortcuts to pages they keep coming back to. Kept in this
 * browser: pins are a convenience, not part of the character.
 */
export function usePinnedPages() {
  const [pinned, setPinned] = useState<PinnedPage[]>([]);

  // Read after mount so the server and client markup agree.
  useEffect(() => setPinned(read()), []);

  const save = useCallback((next: PinnedPage[]) => {
    setPinned(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // A blocked or full store only costs the player their shortcuts.
    }
  }, []);

  const pin = useCallback(
    (page: PinnedPage) => {
      if (pinned.length >= MAX_PINNED_PAGES) return;
      if (pinned.some((entry) => entry.href === page.href)) return;
      save([...pinned, page]);
    },
    [pinned, save],
  );

  const unpin = useCallback(
    (href: string) => save(pinned.filter((entry) => entry.href !== href)),
    [pinned, save],
  );

  return { pinned, pin, unpin };
}
