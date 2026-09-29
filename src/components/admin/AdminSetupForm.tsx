"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { PasswordInput } from "~/components/auth/PasswordInput";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

const inputClass = "h-11 border-white/10 bg-black/25";

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-black/20 p-5">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/15 text-xs text-emerald-300">
          {number}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AdminSetupForm({
  username,
  secret,
  qrDataUrl,
  passwordMin,
}: {
  username: string;
  secret: string;
  qrDataUrl: string;
  /** The server's minimum, passed in so the rule lives in one place. */
  passwordMin: number;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const longEnough = password.length >= passwordMin;
  const matches = confirm.length > 0 && confirm === password;
  const ready = longEnough && matches && code.length === 6;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matches) {
      setError("The two passwords don't match.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code }),
      });
      if (response.ok) {
        window.location.assign("/admin");
        return;
      }
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "Setup failed. Please try again.");
      setCode("");
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    }
    setPending(false);
  };

  return (
    <form
      onSubmit={submit}
      className="relative mx-auto w-full max-w-lg rounded-2xl bg-card/95 p-7 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.7)] ring-1 ring-white/5"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Finish setting up {username}
          </h1>
          <p className="text-xs text-muted-foreground">
            Both steps are needed before you can open the dashboard.
          </p>
        </div>
      </div>

      <div className="mt-7 space-y-4">
        <Step number={1} title="Choose your own password">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setup-password">New password</Label>
              <PasswordInput
                id="setup-password"
                autoComplete="new-password"
                required
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
              <p
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors",
                  longEnough ? "text-emerald-300" : "text-muted-foreground",
                )}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                At least {passwordMin} characters
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-confirm">Repeat password</Label>
              <PasswordInput
                id="setup-confirm"
                autoComplete="new-password"
                required
                maxLength={256}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className={inputClass}
              />
              {confirm.length > 0 && !matches ? (
                <p className="text-xs text-red-300">
                  The two passwords don&apos;t match.
                </p>
              ) : null}
            </div>
          </div>
        </Step>

        <Step number={2} title="Add your authenticator">
          <div className="flex flex-col gap-5 sm:flex-row">
            <Image
              src={qrDataUrl}
              alt=""
              width={144}
              height={144}
              unoptimized
              className="mx-auto h-36 w-36 shrink-0 rounded-lg bg-white p-1.5 sm:mx-0"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Scan this in Authy, 1Password or Google Authenticator. If you
                can&apos;t scan, enter this key by hand:
              </p>
              <code className="block break-all rounded-md bg-black/30 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground/80">
                {secret.match(/.{1,4}/g)?.join(" ")}
              </code>
              <div className="space-y-2">
                <Label htmlFor="setup-code">Code from the app</Label>
                <Input
                  id="setup-code"
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
                  className="h-12 border-white/10 bg-black/25 text-center font-mono text-xl tracking-[0.4em] placeholder:tracking-[0.4em] placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
          </div>
        </Step>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="mt-6 h-11 w-full"
        disabled={pending || !ready}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        {pending ? "Finishing…" : "Finish setup"}
      </Button>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Changing your password later means enrolling the authenticator again,
        because the two are tied together.
      </p>
    </form>
  );
}
