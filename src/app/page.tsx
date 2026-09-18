import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Axe, Compass, ShoppingBag } from "lucide-react";
import { Button } from "~/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between border-b border-border px-5 sm:px-10">
        <Link href="/" className="game-brand pl-0" aria-label="Aergyle home">
          <Image
            src="/assets/logo/aergyle-logo.png"
            alt=""
            width={46}
            height={38}
          />
          <span className="game-wordmark">Aergyle</span>
        </Link>
        <Button asChild variant="outline">
          <Link href="/signin">
            Sign in <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </Button>
      </header>
      <section className="relative isolate mx-auto grid max-w-7xl overflow-hidden border-b border-border px-5 py-16 sm:px-10 sm:py-24 lg:min-h-[650px] lg:grid-cols-2 lg:items-center">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#111b1efa,#111b1ed9),url('/assets/homepage/background1.jpg')] bg-cover bg-center" />
        <div className="relative z-10 max-w-xl">
          <p className="game-eyebrow">
            An idle adventure. A world of your own.
          </p>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-7xl">
            Choose a calling.
            <br />
            <span className="text-primary">Build a life.</span>
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-text-secondary">
            From the first cut of timber to a pack full of rare finds. Explore
            Aergyle, master your vocations, and make every quiet moment count.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Begin your journey <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/signin">Return to Aergyle</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Gather · Grow · Trade · Explore
          </p>
        </div>
        <div className="relative mt-8 h-[320px] sm:h-[420px] lg:mt-0 lg:h-[500px]">
          <Image
            src="/assets/female-sword-hero.png"
            alt="Aergyle wayfarer with a silver sword and violet travelling cloak"
            fill
            priority
            sizes="(max-width: 1024px) 90vw, 600px"
            className="object-contain"
          />
        </div>
      </section>
      <section
        className="mx-auto max-w-7xl px-5 py-12 sm:px-10 sm:py-16"
        aria-labelledby="callings-heading"
      >
        <p className="game-eyebrow">One journey. Many callings.</p>
        <h2
          id="callings-heading"
          className="mt-3 font-display text-3xl font-semibold"
        >
          There is more than one way to leave your mark.
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Axe,
              title: "Learn a craft",
              text: "Cut timber, mine ore, cast a line, or turn raw materials into something useful.",
            },
            {
              icon: Compass,
              title: "Find your place",
              text: "Travel the world atlas and tend a garden between adventures.",
            },
            {
              icon: ShoppingBag,
              title: "Make your fortune",
              text: "Collect equipment and trade your finds with other players at the marketplace.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="border-t border-primary/40 pt-5">
              <div className="flex items-center justify-between text-primary">
                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">
                {title}
              </h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {text}
              </p>
            </article>
          ))}
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 border-t border-border px-5 py-6 text-xs text-muted-foreground sm:px-10">
        <span>Aergyle · A life of adventure</span>
        <Link href="/play" className="text-primary">
          Enter the world →
        </Link>
      </footer>
    </main>
  );
}
