"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

/**
 * Shown when the session cookie is valid but its account is gone. Signing out
 * clears the cookie; a plain redirect would bounce between /play and the game.
 */
export function StaleSession() {
  useEffect(() => {
    void signOut({ callbackUrl: "/play" });
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-sm text-muted-foreground">
      Your session has ended. Signing you out…
    </main>
  );
}
