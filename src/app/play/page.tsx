import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Axe, Coins, Compass, Hammer } from "lucide-react";
import { AuthPanel, type AuthMode } from "~/components/auth/AuthPanel";
import { safeCallbackPath } from "~/lib/auth-rules";
import { cn } from "~/lib/utils";

export const metadata = {
  title: "Play Aergyle",
  description:
    "Sign in or create a character to start your adventure in Aergyle.",
};

const CALLINGS = [
  { icon: Axe, label: "Gather" },
  { icon: Hammer, label: "Craft" },
  { icon: Coins, label: "Trade" },
  { icon: Compass, label: "Explore" },
];

type Param = string | string[] | undefined;

function first(value: Param) {
  return Array.isArray(value) ? value[0] : value;
}

function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Aergyle home"
      className={cn(
        "inline-flex items-center gap-3 rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Image
        src="/assets/logo/aergyle-logo.png"
        alt=""
        width={44}
        height={36}
        className="brightness-0 invert-[0.88] sepia-[0.25]"
      />
      <span className="font-display text-2xl font-bold leading-none tracking-[-0.04em]">
        Aergyle
      </span>
    </Link>
  );
}

export default function PlayPage({
  searchParams,
}: {
  searchParams?: { mode?: Param; error?: Param; callbackUrl?: Param };
}) {
  const mode: AuthMode =
    first(searchParams?.mode) === "register" ? "register" : "signin";
  const error = first(searchParams?.error) ?? null;
  const callbackUrl = safeCallbackPath(first(searchParams?.callbackUrl));

  return (
    <main className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(460px,1fr)]">
      <section className="relative isolate hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between">
        <Image
          src="/assets/homepage/background1.jpg"
          alt=""
          fill
          priority
          sizes="60vw"
          className="-z-20 object-cover object-[45%_center]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,hsl(var(--background)/0.55)_0%,hsl(var(--background)/0.05)_32%,hsl(var(--background)/0.55)_68%,hsl(var(--background))_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 -z-10 w-56 bg-gradient-to-r from-transparent via-background/40 to-background"
        />

        <BrandLink />

        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            An idle adventure. A world of your own.
          </p>
          <p className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
            Choose a calling.
            <br />
            <span className="text-primary">Build a life.</span>
          </p>
          <p className="mt-5 max-w-md text-base leading-relaxed text-text-secondary">
            Gather, craft, trade and explore. Your wayfarer keeps at their work
            while you are away.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Things to do">
            {CALLINGS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-full bg-background/65 px-3.5 py-2 text-xs font-medium text-foreground shadow-[0_6px_20px_-10px_rgba(0,0,0,0.8)] backdrop-blur-md"
              >
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative isolate flex min-h-dvh flex-col px-5 pb-8 pt-6 sm:px-10 lg:px-16">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden lg:hidden"
        >
          <Image
            src="/assets/homepage/background1.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[35%_30%] opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/75 to-background" />
        </div>

        <header className="flex items-center justify-between gap-4">
          <BrandLink className="lg:hidden" />
          <Link
            href="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Home
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">
            <AuthPanel
              initialMode={mode}
              initialError={error}
              callbackUrl={callbackUrl}
            />
          </div>
        </div>

        <footer className="text-center text-xs text-muted-foreground/70">
          Never share your password. Nobody from Aergyle will ever ask for it.
        </footer>
      </section>
    </main>
  );
}
