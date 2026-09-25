"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import RegisterForm from "~/components/forms/registerForm";
import SignInForm from "~/components/forms/signInForm";
import { DiscordButton } from "~/components/auth/DiscordButton";
import { authErrorMessage } from "~/components/auth/authErrors";
import { cn } from "~/lib/utils";

export type AuthMode = "signin" | "register";

const COPY: Record<AuthMode, { title: string; lead: string }> = {
  signin: {
    title: "Welcome back, wayfarer",
    lead: "Your journey picks up right where you left it.",
  },
  register: {
    title: "Begin your journey",
    lead: "Create a character in under a minute. It's free to play.",
  },
};

export function AuthPanel({
  initialMode,
  initialError,
  callbackUrl,
}: {
  initialMode: AuthMode;
  /** A NextAuth error code from the URL, e.g. after a Discord round trip. */
  initialError: string | null;
  callbackUrl: string;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [error, setError] = useState<string | null>(
    authErrorMessage(initialError),
  );

  // Keep the URL in step so a refresh or a shared link opens the same tab,
  // and drop a stale ?error= once it has been shown.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    url.searchParams.delete("error");
    window.history.replaceState(null, "", url);
  }, [mode]);

  const switchTo = (next: AuthMode) => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Sign in or create an account"
        className="grid grid-cols-2 gap-1 rounded-xl bg-surface-inset p-1"
      >
        {(
          [
            ["signin", "Sign in"],
            ["register", "Create account"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`auth-tab-${value}`}
            aria-selected={mode === value}
            aria-controls="auth-panel"
            onClick={() => switchTo(value)}
            className={cn(
              "h-9 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === value
                ? "bg-secondary text-foreground shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id="auth-panel"
        role="tabpanel"
        aria-labelledby={`auth-tab-${mode}`}
        className="mt-8"
      >
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-foreground">
          {COPY[mode].title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{COPY[mode].lead}</p>

        <div aria-live="polite">
          {error ? (
            <p
              role="alert"
              className="mt-6 flex items-start gap-2.5 rounded-lg bg-danger/10 px-3.5 py-3 text-sm leading-snug text-danger"
            >
              <AlertCircle
                className="mt-px h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {error}
            </p>
          ) : null}
        </div>

        <DiscordButton
          className="mt-6"
          callbackUrl={callbackUrl}
          label={
            mode === "register" ? "Sign up with Discord" : "Continue with Discord"
          }
        />

        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-foreground/10" aria-hidden="true" />
          or with email
          <span className="h-px flex-1 bg-foreground/10" aria-hidden="true" />
        </div>

        {mode === "signin" ? (
          <SignInForm callbackUrl={callbackUrl} onError={setError} />
        ) : (
          <RegisterForm callbackUrl={callbackUrl} onError={setError} />
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to Aergyle? " : "Already have a character? "}
          <button
            type="button"
            onClick={() => switchTo(mode === "signin" ? "register" : "signin")}
            className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
