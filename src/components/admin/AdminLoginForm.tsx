"use client";

import { useState, type FormEvent } from "react";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export function AdminLoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, code }),
      });
      if (response.ok) {
        window.location.assign(next);
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "Sign-in failed. Please try again.");
      setCode("");
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    }
    setPending(false);
  };

  return (
    <form
      onSubmit={submit}
      className="relative w-full max-w-sm rounded-2xl bg-card/95 p-7 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.7)] ring-1 ring-white/5"
      aria-describedby={error ? "admin-login-error" : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Aergyle Admin
          </h1>
          <p className="text-xs text-muted-foreground">
            Restricted area. Every sign-in is logged.
          </p>
        </div>
      </div>

      <div className="mt-7 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="admin-username">Username</Label>
          <Input
            id="admin-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={64}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 border-white/10 bg-black/25"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 border-white/10 bg-black/25"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-code">Authenticator code</Label>
          <Input
            id="admin-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="000000"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="h-12 border-white/10 bg-black/25 text-center font-mono text-xl tracking-[0.5em] placeholder:tracking-[0.5em] placeholder:text-muted-foreground/40"
          />
          <p className="text-xs text-muted-foreground">
            The 6-digit code from your authenticator app (e.g. Authy).
          </p>
        </div>
      </div>

      {error ? (
        <p
          id="admin-login-error"
          role="alert"
          className="mt-5 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="mt-6 h-11 w-full"
        disabled={pending || code.length !== 6}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        )}
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Lost your authenticator? Reset access from the server with the admin
        CLI.
      </p>
    </form>
  );
}
