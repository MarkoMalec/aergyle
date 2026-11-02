import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import type React from "react";
import { ArrowRight, ChevronDown, Mail, Trophy, Users } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { RARITY_VISUALS, rarityStyle } from "~/utils/rarity-colors";
import { ArtSlot } from "./art";
import { AtlasMap } from "./AtlasMap";
import { AwayHaul } from "./AwayHaul";
import {
  AtlasBackdrop,
  DawnBackdrop,
  DungeonBackdrop,
  MarketBackdrop,
  NightBackdrop,
} from "./backdrops";
import {
  BESTIARY,
  CRAFT_CHAINS,
  DUNGEON_NAMES,
  GATHERING_CALLINGS,
  TOWNSFOLK,
  type CraftChain,
} from "./content";
import { Parallax, Reveal } from "./motion";
import { RarityShowcase } from "./RarityShowcase";

// The page is one day in Aergyle: arrival at dawn, work by noon, the road
// after midday, trade towards evening, danger at dusk, rest at night, and a
// last page that is never written.

const WRAP = "mx-auto w-full max-w-[1400px] px-4 sm:px-8 lg:px-12";
const H2 =
  "font-display text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-balance sm:text-5xl lg:text-6xl";
const LEAD =
  "text-base leading-relaxed text-text-secondary text-pretty sm:text-lg";
const INK = "hsl(var(--background))";

function Story({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <Reveal as="h2" className={H2}>
        {title}
      </Reveal>
      <Reveal delay={120} className="mt-6 grid gap-4">
        {children}
      </Reveal>
    </div>
  );
}

/** Full-bleed painting on wide screens; a banner above the text on phones. */
function SceneArt({
  name,
  alt,
  position,
  fallback,
  shade,
}: {
  name: string;
  alt: string;
  position: string;
  fallback: React.ReactNode;
  /** Extra ink on the side the text sits on, from lg up. */
  shade: "left" | "right" | "top-left";
}) {
  return (
    <div className="relative h-[54svh] min-h-[300px] lg:absolute lg:inset-0 lg:h-auto">
      <ArtSlot
        name={name}
        alt={alt}
        sizes="100vw"
        className="absolute inset-0"
        imageClassName={position}
        fallback={fallback}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${INK} 0%, transparent 20%, transparent 58%, ${INK} 100%)`,
        }}
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 hidden lg:block",
          shade === "left" &&
            "bg-[linear-gradient(90deg,hsl(var(--background)/0.92)_0%,hsl(var(--background)/0.6)_34%,transparent_62%)]",
          shade === "right" &&
            "bg-[linear-gradient(270deg,hsl(var(--background)/0.92)_0%,hsl(var(--background)/0.62)_38%,transparent_64%)]",
          shade === "top-left" &&
            "bg-[radial-gradient(ellipse_70%_60%_at_0%_0%,hsl(var(--background)/0.92),transparent_70%)]",
        )}
      />
    </div>
  );
}

export function DawnHero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      <div className="relative h-[64svh] min-h-[360px] lg:absolute lg:inset-0 lg:h-auto">
        <Parallax speed={0.22} className="absolute inset-0">
          <ArtSlot
            name="hero-dawn-v1"
            alt="Dawn over Aergyle: a river valley running down to the walled city of Crownhold and the sea, snow peaks far behind"
            sizes="100vw"
            priority
            className="absolute inset-0"
            imageClassName="object-[64%_50%]"
            fallback={<DawnBackdrop />}
          />
        </Parallax>
        <Parallax
          speed={0.08}
          className="absolute bottom-0 right-[-14%] h-[92%] sm:right-[2%] lg:right-[5%] lg:h-[84%]"
        >
          <ArtSlot
            name="hero-wayfarer-v1"
            alt="A wayfarer with an empty pack and a felling axe, looking out over the valley"
            sizes="(min-width: 1024px) 34vw, 70vw"
            priority
            className="relative aspect-[2/3] h-full"
            imageClassName="object-contain object-bottom"
          />
        </Parallax>
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, hsl(var(--background) / 0.7) 0%, transparent 20%, transparent 50%, ${INK} 100%)`,
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-[linear-gradient(90deg,hsl(var(--background)/0.88)_0%,hsl(var(--background)/0.5)_36%,transparent_62%)] lg:block"
        />
      </div>

      <div className={cn(WRAP, "relative z-10 -mt-28 pb-14 lg:mt-auto lg:pb-24")}>
        <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-balance sm:text-6xl lg:text-7xl">
          The world is wide.{" "}
          <span className="text-primary">Your pack is empty.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-text-secondary text-pretty sm:text-lg">
          Aergyle is a hand-painted idle MMO that lives in your browser.
          Gather, craft, trade and fight your way across a living atlas, and
          come back to find your wayfarer still hard at work.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Button asChild className="px-6">
            <Link href="/play?mode=register">
              Begin your journey <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Link
            href="/play?mode=signin"
            className="rounded-md text-sm font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            I already have a wayfarer
          </Link>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Plays in your browser. Nothing to install.
        </p>
      </div>

      <a
        href="#first-light"
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex"
      >
        Follow the road
        <ChevronDown className="h-4 w-4" aria-hidden />
      </a>
    </section>
  );
}

export function FirstLight() {
  return (
    <section
      id="first-light"
      className="relative isolate scroll-mt-16 pt-24 sm:pt-32"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_55%_60%_at_90%_0%,#e1b5671c,transparent_70%)]"
      />
      <Story
        className={WRAP}
        title={
          <>
            It starts at first light,{" "}
            <span className="text-primary">with an axe.</span>
          </>
        }
      >
        <p className={cn(LEAD, "max-w-xl")}>
          Twelve callings, and not one of them is filler. Each levels on its
          own, each feeds another, and every hour you put in leaves something
          in your pack.
        </p>
      </Story>

      <ul className="mx-auto mt-14 flex max-w-[1920px] flex-col gap-1.5 sm:mt-20">
        {GATHERING_CALLINGS.map((calling, index) => (
          <Reveal
            as="li"
            effect="wipe"
            delay={index * 90}
            key={calling.skill}
            className="group relative h-[clamp(136px,12vw,232px)]"
          >
            <Image
              src={`/assets/skills/${calling.skill}-header.webp`}
              alt=""
              fill
              sizes="(min-width: 1920px) 1920px, 100vw"
              className="object-cover transition-[filter] duration-300 group-hover:brightness-110"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--background)/0.94)_0%,hsl(var(--background)/0.62)_32%,transparent_62%)]"
            />
            <div className={cn(WRAP, "relative flex h-full items-center gap-4 sm:gap-6")}>
              <Image
                src={`/assets/skills/icons/${calling.skill}.webp`}
                alt=""
                width={64}
                height={64}
                className="h-11 w-11 shrink-0 drop-shadow-[0_6px_10px_#000] sm:h-16 sm:w-16"
              />
              <div className="max-w-md">
                <h3 className="font-display text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                  {calling.name}
                </h3>
                <p className="mt-1 text-sm leading-snug text-text-secondary sm:text-base">
                  {calling.line}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function ChainRow({ chain, row }: { chain: CraftChain; row: number }) {
  const last = chain.steps.length - 1;
  return (
    <li className="flex items-start">
      {chain.steps.map((step, index) => (
        <Fragment key={step.name}>
          {index > 0 ? (
            <ChainLinkMark
              link={chain.links[index - 1]!}
              delay={row * 120 + index * 220}
            />
          ) : null}
          <Reveal
            as="figure"
            delay={row * 120 + index * 220}
            className="flex w-16 shrink-0 flex-col items-center text-center sm:w-24"
          >
            <div className="relative h-16 w-16 sm:h-24 sm:w-24">
              <div
                aria-hidden="true"
                className="absolute inset-[-18%] rounded-full bg-[radial-gradient(circle_at_50%_62%,hsl(var(--primary)/0.16),transparent_62%)]"
              />
              <Image
                src={step.sprite}
                alt=""
                fill
                sizes="96px"
                className="object-contain drop-shadow-[0_10px_12px_#050b0d]"
              />
            </div>
            <figcaption
              className="mt-2 text-xs font-medium leading-tight sm:text-sm"
              style={
                index === last
                  ? { color: RARITY_VISUALS[chain.finish].color }
                  : undefined
              }
            >
              {step.name}
            </figcaption>
          </Reveal>
        </Fragment>
      ))}
    </li>
  );
}

function ChainLinkMark({
  link,
  delay,
}: {
  link: CraftChain["links"][number];
  delay: number;
}) {
  return (
    <div className="relative mt-8 flex min-w-[26px] flex-1 flex-col items-center sm:mt-12">
      <Reveal
        effect="draw"
        delay={delay - 120}
        className="h-px w-full bg-[repeating-linear-gradient(90deg,hsl(var(--primary)/0.6)_0_6px,transparent_6px_12px)]"
      />
      <Image
        src={`/assets/skills/icons/${link.skill}.webp`}
        alt=""
        width={32}
        height={32}
        title={link.skillName}
        className="absolute -top-3.5 h-7 w-7 rounded-full bg-background p-0.5 sm:-top-4 sm:h-8 sm:w-8"
      />
      <span className="mt-6 hidden text-xs text-muted-foreground sm:block">
        {link.verb}
      </span>
      <span className="sr-only">
        {link.verb} ({link.skillName})
      </span>
    </div>
  );
}

export function Noon() {
  return (
    <section className="relative isolate overflow-hidden py-28 sm:py-40">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_55%_at_100%_60%,#d0784022,transparent_70%),radial-gradient(ellipse_40%_40%_at_0%_20%,#4b675324,transparent_70%)]"
      />
      <div
        className={cn(
          WRAP,
          "grid gap-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center",
        )}
      >
        <Story
          title={
            <>
              By noon, <span className="text-primary">the forge is hot.</span>
            </>
          }
        >
          <p className={LEAD}>
            Ore becomes an ingot. The ingot becomes a blade. The blade becomes
            yours.
          </p>
          <p className={LEAD}>
            Every sword, bow, potion and meal in Aergyle passes through a
            player&apos;s hands first. Smelt, forge, saw, brew, weave and cook
            what you gathered into the things the whole world runs on.
          </p>
        </Story>
        <ul className="flex flex-col gap-10 sm:gap-14" aria-label="Crafting chains">
          {CRAFT_CHAINS.map((chain, row) => (
            <ChainRow key={chain.steps[0]!.name} chain={chain} row={row} />
          ))}
        </ul>
      </div>
    </section>
  );
}

export function TheRoad() {
  return (
    <section className="relative isolate py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_20%_10%,#4b675330,transparent_70%)]"
      />
      <div className={WRAP}>
        <Story
          title={
            <>
              After midday,{" "}
              <span className="text-primary">the easy roads run out.</span>
            </>
          }
        >
          <p className={LEAD}>
            Every journey takes real time, and the far roads want a level
            before they let you through. Start in the walled city of
            Crownhold. Earn the Frostcrown Peaks, the violet ruins of Caldrath,
            the furnace of Mount Doom and, one day, the Farwater Keys.
          </p>
        </Story>
        <Reveal className="mt-14 sm:mt-16">
          <AtlasMap />
        </Reveal>
      </div>

      <div
        className={cn(
          WRAP,
          "mt-28 grid gap-12 sm:mt-36 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end",
        )}
      >
        <Story
          className="lg:pb-16"
          title={
            <>
              Every town has someone{" "}
              <span className="text-primary">who needs a hand.</span>
            </>
          }
        >
          <p className={LEAD}>
            Shopkeepers with rare finds that never stay long. Quests by the
            day and by the week. Town projects the whole settlement builds
            together, opening new shops for everyone once they are done.
          </p>
        </Story>
        <ul className="relative flex items-end justify-center before:absolute before:inset-x-[6%] before:bottom-12 before:h-16 before:rounded-[50%] before:bg-[radial-gradient(ellipse,#000000a0,transparent_70%)] lg:justify-end">
          {TOWNSFOLK.map((person, index) => (
            <Reveal
              as="li"
              key={person.name}
              delay={index * 90}
              className={cn(
                "group relative -mx-3 w-24 shrink-0 sm:-mx-4 sm:w-32 lg:w-36",
                index >= 4 && "hidden sm:block",
              )}
            >
              <div className="relative aspect-[2/3] w-full">
                <Image
                  src={person.sprite}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 144px, 128px"
                  className="object-contain object-bottom transition-[filter] duration-300 group-hover:brightness-110"
                />
              </div>
              <p className="mt-3 px-3 text-center text-xs font-semibold leading-tight sm:px-4 sm:text-sm">
                {person.name}
              </p>
              <p className="px-3 text-center text-xs text-muted-foreground sm:px-4">
                {person.trade}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const ORDER_BOOK = {
  asks: [
    { price: 84, quantity: 120 },
    { price: 86, quantity: 58 },
    { price: 91, quantity: 300 },
  ],
  bids: [
    { price: 79, quantity: 400 },
    { price: 77, quantity: 1200 },
    { price: 72, quantity: 75 },
  ],
};

function OrderBook() {
  return (
    <div className="w-full max-w-[420px] rounded-2xl bg-popover p-5 shadow-[0_30px_80px_-20px_#03080b]">
      <div className="flex items-center gap-4">
        <div
          className="rarity-frame relative h-14 w-14 shrink-0 rounded-xl p-1"
          data-rarity="COMMON"
          style={rarityStyle("COMMON")}
        >
          <Image
            src="/assets/items/resources/ores/sunstone-ore-atlas-v1.png"
            alt=""
            width={56}
            height={56}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold tracking-[-0.02em]">
            Sunstone Ore
          </p>
          <p className="text-xs text-muted-foreground">Order book</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm tabular-nums">
        {(
          [
            ["Selling", ORDER_BOOK.asks, "text-danger"],
            ["Buying", ORDER_BOOK.bids, "text-success"],
          ] as const
        ).map(([label, rows, tone]) => (
          <div key={label} className="rounded-xl bg-surface-inset/70 p-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <ul className="mt-2 grid gap-1.5">
              {rows.map((row) => (
                <li key={row.price} className="flex justify-between gap-2">
                  <span className={cn("font-semibold", tone)}>
                    {row.price} g
                  </span>
                  <span className="text-text-secondary">
                    ×{row.quantity.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <svg
        viewBox="0 0 200 40"
        className="mt-4 h-10 w-full"
        role="img"
        aria-label="Price trend rising over the week"
      >
        <path
          d="M0 30 L20 27 L40 31 L60 24 L80 26 L100 19 L120 22 L140 15 L160 17 L180 10 L200 12"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export function Evening() {
  return (
    <section className="relative isolate overflow-hidden lg:min-h-[820px]">
      <SceneArt
        name="market-quay-v1"
        alt="The Quay ward market of Crownhold at golden hour, crowded stalls under lanterns and ship masts behind"
        position="object-[62%_50%]"
        fallback={<MarketBackdrop />}
        shade="left"
      />
      <div
        className={cn(
          WRAP,
          "relative -mt-24 grid gap-14 pb-24 lg:mt-0 lg:min-h-[820px] lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center lg:py-32",
        )}
      >
        <Story
          title={
            <>
              Towards evening,{" "}
              <span className="text-primary">the quay gets loud.</span>
            </>
          }
        >
          <p className={LEAD}>
            One wayfarer&apos;s surplus is another&apos;s missing piece. Sell
            straight into the order book, list a rare roll at your own price,
            or post a buy order and let the goods come to you. Price history
            keeps everyone honest.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-3 text-sm text-foreground/90">
            <li className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" aria-hidden />
              Friends to travel alongside
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" aria-hidden />
              Letters and profile walls
            </li>
            <li className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" aria-hidden />A
              leaderboard to climb
            </li>
          </ul>
        </Story>
        <Reveal delay={200} className="flex justify-center lg:justify-end">
          <OrderBook />
        </Reveal>
      </div>
    </section>
  );
}

export function Dusk() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="relative flex flex-col lg:min-h-[900px]">
        <SceneArt
          name="dungeon-descent-v1"
          alt="Stairs descending into the flooded vaults beneath the ruins of Caldrath, torchlight on violet stone"
          position="object-[58%_45%]"
          fallback={<DungeonBackdrop />}
          shade="top-left"
        />
        <div className={cn(WRAP, "relative -mt-24 lg:mt-0 lg:pt-36")}>
          <Story
            title={
              <>
                At dusk,{" "}
                <span className="text-primary">some roads go underground.</span>
              </>
            }
          >
            <p className={LEAD}>
              Hunting costs you nothing but time. Dungeons are another matter:
              twelve of them from level 35 to 300, with a boss waiting in every
              one from level 130. Clear the run and keep everything. Fall, and
              you limp home with whatever stayed in your pack.
            </p>
          </Story>
        </div>
        <ul
          className={cn(
            WRAP,
            "relative mt-16 grid grid-cols-3 gap-x-3 gap-y-10 pb-6 sm:grid-cols-6 lg:mt-auto lg:pb-14",
          )}
          aria-label="Some of what waits below"
        >
          {BESTIARY.map((monster, index) => (
            <Reveal
              as="li"
              key={monster.name}
              delay={index * 80}
              className="flex flex-col items-center text-center"
            >
              <div className="relative aspect-square w-full max-w-[168px]">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-[12%] bottom-[4%] h-[18%] rounded-[50%] bg-[radial-gradient(ellipse,#000000b0,transparent_70%)]"
                />
                <Image
                  src={monster.sprite}
                  alt=""
                  fill
                  sizes="168px"
                  className="object-contain"
                />
              </div>
              <p className="mt-2 text-xs font-semibold sm:text-sm">
                {monster.name}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
      <div className={cn(WRAP, "pb-8 pt-10")}>
        <ul
          className="flex flex-wrap gap-x-5 gap-y-1 font-display text-xl font-semibold leading-snug tracking-[-0.035em] text-foreground/30 sm:gap-x-6 sm:text-3xl lg:text-4xl"
          aria-label="Dungeons"
        >
          {DUNGEON_NAMES.map((name) => (
            <li key={name} className="transition-colors duration-300 hover:text-primary">
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Spoils() {
  return (
    <section className="relative isolate py-28 sm:py-40">
      <div
        className={cn(
          WRAP,
          "grid gap-16 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center",
        )}
      >
        <Reveal className="order-2 lg:order-1">
          <RarityShowcase />
        </Reveal>
        <Story
          className="order-1 lg:order-2"
          title={
            <>
              From Worthless <span className="text-primary">to Divine.</span>
            </>
          }
        >
          <p className={LEAD}>
            Twelve tiers of rarity, and every step up multiplies what an item
            can do. Most of what you carry home will be honest work. Some of it
            will make the whole town stop and stare.
          </p>
        </Story>
      </div>
    </section>
  );
}

export function Nightfall() {
  return (
    <section className="relative isolate overflow-hidden lg:min-h-[860px]">
      <SceneArt
        name="night-camp-v1"
        alt="The wayfarer's riverside camp at night, a lantern on a pole, a line in the moonlit water and a sack of ore by the fire"
        position="object-[36%_50%]"
        fallback={<NightBackdrop />}
        shade="right"
      />
      <div
        className={cn(
          WRAP,
          "relative -mt-24 flex flex-col items-start gap-12 pb-24 lg:mt-0 lg:min-h-[860px] lg:items-end lg:justify-center lg:py-32",
        )}
      >
        <Story
          className="lg:max-w-[540px]"
          title={
            <>
              At nightfall, close the tab.{" "}
              <span className="text-primary">Your wayfarer won&apos;t.</span>
            </>
          }
        >
          <p className={LEAD}>
            Give your wayfarer a task for up to eight hours and get on with
            your life. Every swing, cast and smelt is counted while you are
            gone, and the haul is waiting the moment you come back.
          </p>
        </Story>
        <Reveal delay={200} className="w-full lg:max-w-[540px]">
          <AwayHaul />
        </Reveal>
      </div>
    </section>
  );
}

export function LastPage() {
  return (
    <section className="relative isolate overflow-hidden lg:min-h-[820px]">
      <SceneArt
        name="atlas-last-page-v1"
        alt="An open atlas by candlelight, one page painted with the known world and the facing page still blank"
        position="object-[70%_50%]"
        fallback={<AtlasBackdrop />}
        shade="left"
      />
      <div
        className={cn(
          WRAP,
          "relative -mt-24 pb-28 lg:mt-0 lg:flex lg:min-h-[820px] lg:items-center lg:py-32",
        )}
      >
        <Story
          title={
            <>
              The day ends.{" "}
              <span className="text-primary">The story doesn&apos;t.</span>
            </>
          }
        >
          <p className={LEAD}>
            Aergyle has no last page. Higher levels, new regions and stronger
            gear keep arriving, and someone is always climbing. Every name in
            this world started out with an empty pack, exactly like yours.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild className="px-6">
              <Link href="/play?mode=register">
                Write your first page{" "}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Link
              href="/play?mode=signin"
              className="rounded-md text-sm font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Sign in
            </Link>
          </div>
        </Story>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className={cn(WRAP, "flex flex-wrap items-center justify-between gap-4 pb-10 pt-6 text-sm text-muted-foreground")}>
      <span className="flex items-center gap-3">
        <Image
          src="/assets/logo/aergyle-logo.png"
          alt=""
          width={30}
          height={24}
          className="brightness-0 invert-[0.88] sepia-[0.25] opacity-70"
        />
        Aergyle · A hand-painted idle MMO
      </span>
      <nav className="flex gap-5" aria-label="Footer">
        <Link href="/play?mode=signin" className="transition-colors hover:text-foreground">
          Sign in
        </Link>
        <Link href="/play?mode=register" className="text-primary transition-colors hover:text-foreground">
          Create a wayfarer
        </Link>
      </nav>
    </footer>
  );
}
