"use client";

import { useState, type ReactNode } from "react";
import AuthShell from "~/components/game/ui/AuthShell";
import { Button } from "~/components/ui/button";

export default function PlayLayout({
  children,
  register,
  signin,
}: {
  children: ReactNode;
  register: ReactNode;
  signin: ReactNode;
}) {
  const [screen, setScreen] = useState<"register" | "signin">("register");
  return (
    <AuthShell>
      {children}
      <div
        className="m-6 mb-0 flex gap-2 rounded-xl bg-surface-inset p-1"
        role="group"
        aria-label="Choose how to enter Aergyle"
      >
        <Button
          variant={screen === "register" ? "secondary" : "ghost"}
          className="flex-1"
          aria-pressed={screen === "register"}
          onClick={() => setScreen("register")}
        >
          New adventure
        </Button>
        <Button
          variant={screen === "signin" ? "secondary" : "ghost"}
          className="flex-1"
          aria-pressed={screen === "signin"}
          onClick={() => setScreen("signin")}
        >
          Sign in
        </Button>
      </div>
      <div hidden={screen !== "register"}>{register}</div>
      <div hidden={screen !== "signin"}>{signin}</div>
    </AuthShell>
  );
}
